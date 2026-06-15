/**
 * Loader de métricas semanales del copilot (T4.3) — paso determinista,
 * SIN LLM. Compara la semana actual (últimos 7 días) contra la anterior.
 *
 * `createServiceClient()` justificado: corre desde el worker cron sin
 * sesión de usuario. CADA query filtra explícitamente por
 * `organization_id` (criterio de seguridad del spec, verificado en tests).
 *
 * Spec: .kiro/specs/copilot-merchant-loop-v0/design.md §3.2
 */

import { createServiceClient } from "@/lib/supabase/server"
import { fetchAllPages } from "@/lib/supabase/fetch-all"
import { logger } from "@/lib/logger"
import { deriveVertical, type CopilotVertical } from "./vertical"

const log = logger("copilot/metrics")

const DAY_MS = 24 * 60 * 60 * 1000

export interface WeeklyMetrics {
    weekStart: Date
    weekEnd: Date
    previousWeekStart: Date

    // Vertical del negocio: gobierna QUÉ KPIs son primarios (commerce = ventas;
    // real_estate/services = atención + citas). Fix Casa Inmobiliaria 2026-06-15.
    vertical: CopilotVertical

    orders: { count: number; revenue: number; ticketAvg: number }
    ordersPrev: { count: number; revenue: number }

    conversations: { count: number; whatsappPct: number }
    conversationsPrev: { count: number }

    // Citas/visitas: KPI primario en inmobiliaria/servicios (agendadas esta
    // semana, completadas, y agendadas la semana previa para comparar).
    appointments: { count: number; completed: number }
    appointmentsPrev: { count: number }

    cartsAbandoned: Array<{ id: string; customerName: string | null; total: number; createdAt: string }>
    inactiveCustomers: Array<{ id: string; name: string | null; lastOrderAt: string }>

    topProductsViewed: Array<{ productId: string; name: string; views: number; conversions: number }>
    topProductsConverted: Array<{ productId: string; name: string; orders: number; revenue: number }>
}

interface OrderRow {
    id: string
    total: number | null
    payment_status: string | null
    customer_id: string | null
    customer_info: { name?: string } | null
    items: Array<{ product_id?: string; product_name?: string; name?: string; quantity?: number; total_price?: number; unit_price?: number; price?: number }> | null
    created_at: string
}

interface AnalyticsEventRow {
    session_id: string | null
    event_name: string
    content_ids: string[] | null
    value: number | null
    occurred_at: string
}

function paidRevenue(orders: OrderRow[]): number {
    return orders
        .filter((order) => order.payment_status === "paid")
        .reduce((sum, order) => sum + Number(order.total ?? 0), 0)
}

/** Agrega items de órdenes pagadas por producto: {orders, revenue, name}. */
function aggregateConvertedProducts(orders: OrderRow[]) {
    const byProduct = new Map<string, { name: string; orders: number; revenue: number }>()
    for (const order of orders) {
        if (order.payment_status !== "paid") continue
        for (const item of order.items ?? []) {
            if (!item.product_id) continue
            const name = item.product_name || item.name || "Producto"
            const quantity = Number(item.quantity ?? 1)
            const lineRevenue = Number(item.total_price ?? (Number(item.unit_price ?? item.price ?? 0) * quantity))
            const current = byProduct.get(item.product_id) ?? { name, orders: 0, revenue: 0 }
            current.orders += 1
            current.revenue += lineRevenue
            byProduct.set(item.product_id, current)
        }
    }
    return byProduct
}

export async function loadWeeklyMetrics(organizationId: string, now: Date = new Date()): Promise<WeeklyMetrics> {
    const supabase = createServiceClient()

    const weekEnd = now
    const weekStart = new Date(now.getTime() - 7 * DAY_MS)
    const previousWeekStart = new Date(now.getTime() - 14 * DAY_MS)
    const inactiveCutoff = new Date(now.getTime() - 21 * DAY_MS)
    const lookback90d = new Date(now.getTime() - 90 * DAY_MS)

    // Vertical del negocio (Casa Inmobiliaria fix): determina qué KPIs son
    // primarios. Sin org → commerce por defecto (compat).
    const { data: orgRow } = await supabase
        .from("organizations")
        .select("industry, enabled_modules")
        .eq("id", organizationId)
        .single()
    const vertical = deriveVertical(orgRow ?? {})

    const orderSelect = "id, total, payment_status, customer_id, customer_info, items, created_at"

    // Auditoría 2026-06-12: PostgREST capa toda respuesta en 1000 filas —
    // el .limit(5000) de analytics_events entregaba máximo 1000 EN SILENCIO
    // y los .limit(1000) subestimaban métricas de tenants grandes. Toda
    // query pagina con fetchAllPages (las métricas del insight deben ser
    // exactas: el composer se las dicta al merchant).
    const [currentOrdersRes, prevOrdersRes, currentChatsRes, prevChatsRes, eventsRes, historyOrdersRes] = await Promise.all([
        fetchAllPages<OrderRow>((from, to) => supabase
            .from("orders")
            .select(orderSelect)
            .eq("organization_id", organizationId)
            .gte("created_at", weekStart.toISOString())
            .lt("created_at", weekEnd.toISOString())
            .range(from, to)),
        fetchAllPages<OrderRow>((from, to) => supabase
            .from("orders")
            .select(orderSelect)
            .eq("organization_id", organizationId)
            .gte("created_at", previousWeekStart.toISOString())
            .lt("created_at", weekStart.toISOString())
            .range(from, to)),
        fetchAllPages<{ id: string; channel: string | null }>((from, to) => supabase
            .from("chats")
            .select("id, channel")
            .eq("organization_id", organizationId)
            .gte("created_at", weekStart.toISOString())
            .lt("created_at", weekEnd.toISOString())
            .range(from, to)),
        fetchAllPages<{ id: string }>((from, to) => supabase
            .from("chats")
            .select("id")
            .eq("organization_id", organizationId)
            .gte("created_at", previousWeekStart.toISOString())
            .lt("created_at", weekStart.toISOString())
            .range(from, to)),
        fetchAllPages<AnalyticsEventRow>((from, to) => supabase
            .from("analytics_events")
            .select("session_id, event_name, content_ids, value, occurred_at")
            .eq("organization_id", organizationId)
            .in("event_name", ["view_content", "add_to_cart", "checkout_order_created", "purchase"])
            .gte("occurred_at", weekStart.toISOString())
            .lt("occurred_at", weekEnd.toISOString())
            .range(from, to), { maxRows: 20_000 }),
        fetchAllPages<{ customer_id: string | null; customer_info: { name?: string } | null; created_at: string }>((from, to) => supabase
            .from("orders")
            .select("customer_id, customer_info, created_at")
            .eq("organization_id", organizationId)
            .gte("created_at", lookback90d.toISOString())
            .order("created_at", { ascending: false })
            .range(from, to)),
    ])

    for (const [name, result] of [["orders", currentOrdersRes], ["events", eventsRes], ["history", historyOrdersRes]] as const) {
        if (result.truncated) {
            log.warn("weekly metrics truncated at maxRows", { organizationId, query: name })
        }
    }

    const currentOrders = currentOrdersRes.rows
    const prevOrders = prevOrdersRes.rows
    const currentChats = currentChatsRes.rows
    const prevChats = prevChatsRes.rows
    const events = eventsRes.rows
    const historyOrders = historyOrdersRes.rows

    // --- Órdenes ---
    const revenue = paidRevenue(currentOrders)
    const paidCount = currentOrders.filter((order) => order.payment_status === "paid").length
    const orders = {
        count: currentOrders.length,
        revenue,
        ticketAvg: paidCount > 0 ? Math.round(revenue / paidCount) : 0,
    }
    const ordersPrev = { count: prevOrders.length, revenue: paidRevenue(prevOrders) }

    // --- Conversaciones ---
    const whatsappChats = currentChats.filter((chat) => chat.channel === "whatsapp").length
    const conversations = {
        count: currentChats.length,
        whatsappPct: currentChats.length > 0 ? Math.round((whatsappChats / currentChats.length) * 100) : 0,
    }
    const conversationsPrev = { count: prevChats.length }

    // --- Citas/visitas (KPI primario inmobiliaria/servicios) ---
    // counts head:true (inmunes al cap de 1000). Guard: si la tabla/columna
    // falla, citas = 0 (no rompe el insight de un commerce sin citas).
    let appointments = { count: 0, completed: 0 }
    let appointmentsPrev = { count: 0 }
    try {
        const [apptCur, apptDone, apptPrev] = await Promise.all([
            supabase.from("appointments").select("*", { count: "exact", head: true })
                .eq("organization_id", organizationId).gte("created_at", weekStart.toISOString()),
            supabase.from("appointments").select("*", { count: "exact", head: true })
                .eq("organization_id", organizationId).eq("status", "completed").gte("created_at", weekStart.toISOString()),
            supabase.from("appointments").select("*", { count: "exact", head: true })
                .eq("organization_id", organizationId).gte("created_at", previousWeekStart.toISOString()).lt("created_at", weekStart.toISOString()),
        ])
        appointments = { count: apptCur.count ?? 0, completed: apptDone.count ?? 0 }
        appointmentsPrev = { count: apptPrev.count ?? 0 }
    } catch (error) {
        log.warn("appointments metrics unavailable", { organizationId, error: error instanceof Error ? error.message : "unknown" })
    }

    // --- Carritos abandonados (heurística por sesión de analytics) ---
    // Sesiones con add_to_cart pero SIN checkout_order_created/purchase en la semana.
    const convertedSessions = new Set(
        events
            .filter((event) => event.event_name === "checkout_order_created" || event.event_name === "purchase")
            .map((event) => event.session_id)
            .filter(Boolean)
    )
    const abandonedBySession = new Map<string, { total: number; createdAt: string }>()
    for (const event of events) {
        if (event.event_name !== "add_to_cart" || !event.session_id) continue
        if (convertedSessions.has(event.session_id)) continue
        const existing = abandonedBySession.get(event.session_id)
        abandonedBySession.set(event.session_id, {
            total: Math.max(existing?.total ?? 0, Number(event.value ?? 0)),
            createdAt: existing?.createdAt ?? event.occurred_at,
        })
    }
    const cartsAbandoned = Array.from(abandonedBySession.entries())
        .sort((a, b) => b[1].createdAt.localeCompare(a[1].createdAt))
        .slice(0, 10)
        .map(([sessionId, data]) => ({
            id: sessionId,
            customerName: null,
            total: data.total,
            createdAt: data.createdAt,
        }))

    // --- Clientes inactivos (última orden hace >21 días, ventana 90d) ---
    const lastOrderByCustomer = new Map<string, { name: string | null; lastOrderAt: string }>()
    for (const order of historyOrders) {
        if (!order.customer_id || lastOrderByCustomer.has(order.customer_id)) continue
        lastOrderByCustomer.set(order.customer_id, {
            name: order.customer_info?.name ?? null,
            lastOrderAt: order.created_at,
        })
    }
    const inactiveCustomers = Array.from(lastOrderByCustomer.entries())
        .filter(([, data]) => new Date(data.lastOrderAt) < inactiveCutoff)
        .sort((a, b) => b[1].lastOrderAt.localeCompare(a[1].lastOrderAt))
        .slice(0, 10)
        .map(([id, data]) => ({ id, name: data.name, lastOrderAt: data.lastOrderAt }))

    // --- Top productos vistos (view_content → content_ids) ---
    const viewsByProduct = new Map<string, number>()
    for (const event of events) {
        if (event.event_name !== "view_content") continue
        for (const productId of event.content_ids ?? []) {
            viewsByProduct.set(productId, (viewsByProduct.get(productId) ?? 0) + 1)
        }
    }
    const convertedProducts = aggregateConvertedProducts(currentOrders)
    const topViewedIds = Array.from(viewsByProduct.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)

    // Nombres de los productos vistos (los convertidos ya traen nombre del item)
    const idsNeedingName = topViewedIds.map(([productId]) => productId)
    let productNames = new Map<string, string>()
    if (idsNeedingName.length > 0) {
        const { data: productRows } = await supabase
            .from("products")
            .select("id, name")
            .eq("organization_id", organizationId)
            .in("id", idsNeedingName)
        productNames = new Map(((productRows ?? []) as Array<{ id: string; name: string }>).map((row) => [row.id, row.name]))
    }

    const topProductsViewed = topViewedIds.map(([productId, views]) => ({
        productId,
        name: productNames.get(productId) ?? convertedProducts.get(productId)?.name ?? "Producto",
        views,
        conversions: convertedProducts.get(productId)?.orders ?? 0,
    }))

    const topProductsConverted = Array.from(convertedProducts.entries())
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .slice(0, 5)
        .map(([productId, data]) => ({ productId, name: data.name, orders: data.orders, revenue: data.revenue }))

    return {
        weekStart,
        weekEnd,
        previousWeekStart,
        vertical,
        orders,
        ordersPrev,
        conversations,
        conversationsPrev,
        appointments,
        appointmentsPrev,
        cartsAbandoned,
        inactiveCustomers,
        topProductsViewed,
        topProductsConverted,
    }
}
