import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { AnalyticsCharts } from "./components/analytics-charts"
import { TrafficSources } from "./components/traffic-sources"
import { ConversionFunnelV2, type FunnelProduct, type FunnelStage } from "./components/conversion-funnel-v2"
import { SalesSources } from "./components/sales-sources"
import { MetaAdsCard } from "./components/meta-ads-card"
import { TopProductsCard } from "./components/top-products-card"
import { RevenueByChannelCard } from "./components/revenue-by-channel-card"
import { AiPerformanceCard } from "./components/ai-performance-card"
import { formatBogotaDayKey } from "@/lib/utils/date"
import { CampaignPerformanceCard, type CampaignPerformance } from "./components/campaign-performance-card"
import { CheckoutIntelligenceCard, type CheckoutIntelligence } from "./components/checkout-intelligence-card"
import { ProactiveNudgeCard, type ProactiveNudgeAnalytics } from "./components/proactive-nudge-card"

export const dynamic = 'force-dynamic'

type AnalyticsEventRow = {
    event_name: string
    session_id: string | null
    order_id: string | null
    content_ids: string[] | null
    value: number | string | null
    properties: Record<string, unknown> | null
    occurred_at: string
}

type AnalyticsAttribution = {
    utmSource?: string
    utmCampaign?: string
    utmSourcePlatform?: string
    campaignId?: string
    fbclid?: string
    fbc?: string
    fbp?: string
    entryPoint?: string
    proactiveNudgeId?: string
}

type AnalyticsOrderItem = {
    productId: string
    productName: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getStringValue(record: Record<string, unknown>, key: string): string | undefined {
    const value = record[key]
    return typeof value === "string" && value.length > 0 ? value : undefined
}

function toNumber(value: unknown): number {
    if (typeof value === "number") return value
    if (typeof value === "string") {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : 0
    }
    return 0
}

function getAttribution(properties: Record<string, unknown> | null): AnalyticsAttribution | null {
    if (!properties || !isRecord(properties.attribution)) return null

    return {
        utmSource: getStringValue(properties.attribution, "utmSource"),
        utmCampaign: getStringValue(properties.attribution, "utmCampaign"),
        utmSourcePlatform: getStringValue(properties.attribution, "utmSourcePlatform"),
        campaignId: getStringValue(properties.attribution, "campaignId"),
        fbclid: getStringValue(properties.attribution, "fbclid"),
        fbc: getStringValue(properties.attribution, "fbc"),
        fbp: getStringValue(properties.attribution, "fbp"),
        entryPoint: getStringValue(properties.attribution, "entryPoint"),
        proactiveNudgeId: getStringValue(properties.attribution, "proactiveNudgeId"),
    }
}

function getOrderItems(items: unknown): AnalyticsOrderItem[] {
    if (!Array.isArray(items)) return []

    return items.reduce<AnalyticsOrderItem[]>((acc, item) => {
        if (!isRecord(item)) return acc

        const productId = getStringValue(item, "product_id") || getStringValue(item, "productId") || getStringValue(item, "id")
        if (!productId) return acc

        acc.push({
            productId,
            productName: getStringValue(item, "product_name") || getStringValue(item, "name") || `Producto ${productId.slice(0, 8)}`,
        })
        return acc
    }, [])
}

async function getAnalyticsData() {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
        redirect("/login")
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) {
        redirect("/onboarding")
    }

    const orgId = profile.organization_id

    // Get orders data for conversion metrics
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Filtrar por status válidos (mismo criterio que dashboard-actions.ts)
    const validStatuses = ["pending", "confirmed", "processing", "shipped", "delivered", "completed"]

    // Fetch org, orders, chats, products and analytics events in parallel
    // Messages se fetchean después en batches (necesitan chatIds primero)
    const [orgResult, ordersResult, chatsResult, productsResult, analyticsEventsResult] = await Promise.all([
        supabase
            .from("organizations")
            .select("id, name, slug, tracking_config")
            .eq("id", orgId)
            .single(),
        supabase
            .from("orders")
            .select("id, total, created_at, status, payment_status, source_channel, chat_id, utm_data, items")
            .eq("organization_id", orgId)
            .in("status", validStatuses)
            .gte("created_at", thirtyDaysAgo.toISOString())
            .order("created_at", { ascending: true }),
        supabase
            .from("chats")
            .select("id, created_at, channel")
            .eq("organization_id", orgId)
            .gte("created_at", thirtyDaysAgo.toISOString()),
        supabase
            .from("products")
            .select("id, name, stock, image_url, is_active")
            .eq("organization_id", orgId),
        supabase
            .from("analytics_events")
            .select("event_name, session_id, order_id, content_ids, value, properties, occurred_at")
            .eq("organization_id", orgId)
            .gte("occurred_at", thirtyDaysAgo.toISOString()),
    ])

    const org = orgResult.data
    const orders = ordersResult.data
    const chats = chatsResult.data
    const products = productsResult.data
    const analyticsEvents = (analyticsEventsResult.data || []) as AnalyticsEventRow[]

    if (!org) {
        redirect("/onboarding")
    }

    // Calculate metrics (misma lógica que dashboard-actions.ts)
    const totalOrders = orders?.length || 0
    const totalRevenue = orders?.reduce((sum, o) => sum + (o.total || 0), 0) || 0
    const totalChats = chats?.length || 0
    // Conversión = órdenes / chats (no solo pagadas, igual que dashboard)
    const conversionRate = totalChats > 0 ? ((totalOrders / totalChats) * 100).toFixed(1) : "0"

    // Group orders by day for chart.
    // Sin timezone explícita las ventas hechas entre 19:00 y 23:59 hora local
    // aparecían corridas al día siguiente UTC, distorsionando la curva.
    const ordersByDay = orders?.reduce((acc, order) => {
        const date = formatBogotaDayKey(order.created_at)
        acc[date] = (acc[date] || 0) + 1
        return acc
    }, {} as Record<string, number>) || {}

    const revenueByDay = orders?.reduce((acc, order) => {
        const date = formatBogotaDayKey(order.created_at)
        acc[date] = (acc[date] || 0) + (order.total || 0)
        return acc
    }, {} as Record<string, number>) || {}

    // Chat channels breakdown
    const chatsByChannel = chats?.reduce((acc, chat) => {
        const channel = chat.channel || 'web'
        acc[channel] = (acc[channel] || 0) + 1
        return acc
    }, {} as Record<string, number>) || {}

    // Origen de ventas real (basado en source_channel y utm_data)
    const ordersBySource = orders?.reduce((acc, order) => {
        let source = 'direct' // Por defecto: venta directa

        if (order.source_channel === 'chat' || order.chat_id) {
            source = 'chat'
        } else if (order.utm_data && typeof order.utm_data === 'object') {
            const utmData = order.utm_data as Record<string, unknown>
            const utmSource = (utmData.utm_source as string)?.toLowerCase() || ''
            if (utmSource.includes('facebook') || utmSource.includes('instagram') || utmSource.includes('meta') || utmSource.includes('fb') || utmSource.includes('ig')) {
                source = 'meta_ads'
            } else if (utmSource.includes('google')) {
                source = 'google_ads'
            } else if (utmSource) {
                source = 'campaign'
            }
        } else if (order.source_channel === 'whatsapp') {
            source = 'whatsapp'
        }

        acc[source] = (acc[source] || 0) + 1
        return acc
    }, {} as Record<string, number>) || {}

    // Órdenes que realmente vinieron del chat
    const ordersFromChat = orders?.filter(o => o.source_channel === 'chat' || o.chat_id)?.length || 0

    // Conversión real del chat (solo órdenes que vinieron del chat / total chats)
    const chatConversionRate = totalChats > 0 ? ((ordersFromChat / totalChats) * 100).toFixed(1) : "0"

    const productNameById = new Map<string, string>()
    ;(products || []).forEach(product => {
        productNameById.set(product.id, product.name)
    })

    const orderItemsByOrderId = new Map<string, AnalyticsOrderItem[]>()
    orders?.forEach(order => {
        const orderItems = getOrderItems(order.items)
        orderItemsByOrderId.set(order.id, orderItems)
        orderItems.forEach(item => {
            if (!productNameById.has(item.productId)) {
                productNameById.set(item.productId, item.productName)
            }
        })
    })

    const getEventProductIds = (event: AnalyticsEventRow) => {
        const contentIds = event.content_ids?.filter((id): id is string => typeof id === "string" && id.length > 0) || []
        if (contentIds.length > 0) return contentIds
        if (!event.order_id) return []
        return orderItemsByOrderId.get(event.order_id)?.map(item => item.productId) || []
    }

    const getEventProductName = (event: AnalyticsEventRow, productId: string) => {
        const contentName = event.content_ids?.length === 1 && event.properties
            ? getStringValue(event.properties, "contentName")
            : undefined

        return productNameById.get(productId) || contentName || `Producto ${productId.slice(0, 8)}`
    }

    const getFunnelProducts = (eventNames: string[]): FunnelProduct[] => {
        const productStats = new Map<string, FunnelProduct>()

        analyticsEvents
            .filter(event => eventNames.includes(event.event_name))
            .forEach(event => {
                const productIds = Array.from(new Set(getEventProductIds(event)))

                productIds.forEach(productId => {
                    const current = productStats.get(productId)
                    if (current) {
                        current.count += 1
                    } else {
                        productStats.set(productId, {
                            productId,
                            productName: getEventProductName(event, productId),
                            count: 1,
                        })
                    }
                })
            })

        return Array.from(productStats.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 3)
    }

    const campaignStats = new Map<string, CampaignPerformance>()
    analyticsEvents.forEach(event => {
        const attribution = getAttribution(event.properties)
        if (!attribution) return

        const sourceText = `${attribution.utmSource || ""} ${attribution.utmSourcePlatform || ""}`.toLowerCase()
        const isMetaCampaign = sourceText.includes("facebook")
            || sourceText.includes("instagram")
            || sourceText.includes("meta")
            || sourceText.includes("fb")
            || sourceText.includes("ig")
            || Boolean(attribution.fbclid || attribution.fbc || attribution.fbp)

        if (!isMetaCampaign) return

        const campaignName = attribution.utmCampaign || attribution.campaignId || "Meta sin campaña"
        const source = attribution.utmSource || attribution.utmSourcePlatform || "Meta"
        const key = `${source}:${campaignName}`
        const current = campaignStats.get(key) || {
            campaignName,
            source,
            visits: 0,
            productViews: 0,
            addToCart: 0,
            checkouts: 0,
            purchases: 0,
            revenue: 0,
        }

        if (event.event_name === "page_view") current.visits += 1
        if (event.event_name === "view_content") current.productViews += 1
        if (event.event_name === "add_to_cart") current.addToCart += 1
        if (event.event_name === "checkout_started") current.checkouts += 1
        if (event.event_name === "purchase") {
            current.purchases += 1
            current.revenue += toNumber(event.value)
        }

        campaignStats.set(key, current)
    })

    const campaignPerformance = Array.from(campaignStats.values())
        .sort((a, b) => b.revenue - a.revenue || b.purchases - a.purchases || b.visits - a.visits)
        .slice(0, 5)

    const uniqueEventCount = (eventNames: string[]) => {
        const events = analyticsEvents.filter(event => eventNames.includes(event.event_name))
        const uniqueKeys = new Set(events.map((event, index) => event.session_id || event.order_id || `${event.event_name}-${index}`))
        return uniqueKeys.size
    }

    const checkoutStageInputs = [
        { label: "Inició checkout", eventNames: ["checkout_started"], icon: "shopping_cart_checkout" },
        { label: "Completó datos", eventNames: ["checkout_contact_submitted"], icon: "assignment_turned_in" },
        { label: "Seleccionó pago", eventNames: ["checkout_payment_method_selected"], icon: "credit_card" },
        { label: "Orden creada", eventNames: ["checkout_order_created"], icon: "receipt_long" },
        { label: "Redirección o instrucciones", eventNames: ["checkout_payment_redirect_started", "checkout_payment_instructions_shown"], icon: "payments" },
        { label: "Compra pagada", eventNames: ["purchase"], icon: "task_alt" },
    ]
    const checkoutStages = checkoutStageInputs.map((stage, index) => {
        const value = uniqueEventCount(stage.eventNames)
        const previousValue = index === 0 ? value : uniqueEventCount(checkoutStageInputs[index - 1].eventNames)
        const dropOffFromPrevious = index === 0 ? 0 : Math.max(previousValue - value, 0)

        return {
            label: stage.label,
            value,
            icon: stage.icon,
            dropOffFromPrevious,
            dropOffRate: previousValue > 0 ? (dropOffFromPrevious / previousValue) * 100 : 0,
        }
    })
    const biggestCheckoutLeak = checkoutStages.slice(1).reduce<CheckoutIntelligence["biggestLeak"]>((current, stage, index) => {
        const previous = checkoutStages[index]

        if (!current || stage.dropOffRate > current.percentage) {
            return {
                from: previous.label,
                to: stage.label,
                lost: stage.dropOffFromPrevious,
                percentage: stage.dropOffRate,
            }
        }

        return current
    }, null)
    const checkoutIssues = [
        {
            label: "Datos de contacto rechazados",
            count: uniqueEventCount(["checkout_contact_validation_failed"]),
            detail: "Sesiones bloqueadas por validación de datos.",
            icon: "assignment_late",
            severity: "warning" as const,
        },
        {
            label: "Envío no disponible",
            count: uniqueEventCount(["checkout_shipping_unavailable"]),
            detail: "Sesiones donde la ciudad o zona no pudo continuar.",
            icon: "local_shipping",
            severity: "warning" as const,
        },
        {
            label: "Orden no creada",
            count: uniqueEventCount(["checkout_order_create_failed"]),
            detail: "Intentos que no llegaron a crear orden.",
            icon: "receipt_long",
            severity: "danger" as const,
        },
        {
            label: "Pasarela no abrió",
            count: uniqueEventCount(["checkout_gateway_load_failed"]),
            detail: "Órdenes creadas con fallo al iniciar pago.",
            icon: "credit_card_off",
            severity: "danger" as const,
        },
        {
            label: "Pago fallido",
            count: uniqueEventCount(["payment_failed"]),
            detail: "Pagos reportados como fallidos.",
            icon: "error",
            severity: "danger" as const,
        },
        {
            label: "Pago pendiente",
            count: uniqueEventCount(["payment_pending"]),
            detail: "Usuarios que aún no completan confirmación de pago.",
            icon: "pending",
            severity: "warning" as const,
        },
    ].filter(issue => issue.count > 0)
    const checkoutProductStats = new Map<string, { productName: string; checkouts: number; purchases: number }>()
    analyticsEvents.forEach(event => {
        if (event.event_name !== "checkout_started" && event.event_name !== "purchase") return

        const productIds = Array.from(new Set(getEventProductIds(event)))
        productIds.forEach(productId => {
            const current = checkoutProductStats.get(productId) || {
                productName: getEventProductName(event, productId),
                checkouts: 0,
                purchases: 0,
            }

            if (event.event_name === "checkout_started") current.checkouts += 1
            if (event.event_name === "purchase") current.purchases += 1
            checkoutProductStats.set(productId, current)
        })
    })
    const checkoutProductRisks = Array.from(checkoutProductStats.entries())
        .map(([productId, stats]) => ({
            productId,
            productName: stats.productName,
            checkouts: stats.checkouts,
            purchases: stats.purchases,
            dropOffRate: stats.checkouts > 0 ? (Math.max(stats.checkouts - stats.purchases, 0) / stats.checkouts) * 100 : 0,
        }))
        .filter(product => product.checkouts > product.purchases)
        .sort((a, b) => b.dropOffRate - a.dropOffRate || b.checkouts - a.checkouts)
        .slice(0, 5)
    const checkoutStarted = checkoutStages[0]?.value || 0
    const checkoutPurchases = checkoutStages[checkoutStages.length - 1]?.value || 0
    const checkoutIntelligence: CheckoutIntelligence = {
        started: checkoutStarted,
        purchases: checkoutPurchases,
        checkoutToPurchaseRate: checkoutStarted > 0 ? (checkoutPurchases / checkoutStarted) * 100 : 0,
        biggestLeak: biggestCheckoutLeak,
        stages: checkoutStages,
        issues: checkoutIssues,
        productRisks: checkoutProductRisks,
    }

    const proactiveNudgeEvents = analyticsEvents.filter(event =>
        event.event_name === "proactive_nudge_shown"
        || event.event_name === "proactive_nudge_clicked"
        || event.event_name === "proactive_nudge_dismissed"
        || event.event_name === "proactive_nudge_chat_started"
    )
    const proactiveNudgeProductStats = new Map<string, {
        productName: string
        shown: number
        clicked: number
        dismissed: number
    }>()
    let proactiveNudgeShown = 0
    let proactiveNudgeClicked = 0
    let proactiveNudgeDismissed = 0
    let proactiveNudgeChatsStarted = 0
    let proactiveNudgeWebChatClicks = 0
    let proactiveNudgeWhatsappClicks = 0
    const proactiveNudgeChatIds = new Set<string>()

    proactiveNudgeEvents.forEach(event => {
        if (event.event_name === "proactive_nudge_shown") proactiveNudgeShown += 1
        if (event.event_name === "proactive_nudge_clicked") proactiveNudgeClicked += 1
        if (event.event_name === "proactive_nudge_dismissed") proactiveNudgeDismissed += 1
        if (event.event_name === "proactive_nudge_chat_started") proactiveNudgeChatsStarted += 1

        const destination = event.properties ? getStringValue(event.properties, "destination") : undefined
        const chatId = event.properties ? getStringValue(event.properties, "chatId") : undefined
        if (event.event_name === "proactive_nudge_clicked" && destination === "web_chat") proactiveNudgeWebChatClicks += 1
        if (event.event_name === "proactive_nudge_clicked" && destination === "whatsapp_fallback") proactiveNudgeWhatsappClicks += 1
        if (event.event_name === "proactive_nudge_chat_started" && chatId) proactiveNudgeChatIds.add(chatId)

        const productIds = Array.from(new Set(getEventProductIds(event)))
        productIds.forEach(productId => {
            const current = proactiveNudgeProductStats.get(productId) || {
                productName: getEventProductName(event, productId),
                shown: 0,
                clicked: 0,
                dismissed: 0,
            }

            if (event.event_name === "proactive_nudge_shown") current.shown += 1
            if (event.event_name === "proactive_nudge_clicked") current.clicked += 1
            if (event.event_name === "proactive_nudge_dismissed") current.dismissed += 1
            proactiveNudgeProductStats.set(productId, current)
        })
    })
    const proactiveNudgeOrders = (orders || []).filter(order => {
        const utmData = isRecord(order.utm_data) ? order.utm_data : null
        const orderEntryPoint = utmData ? getStringValue(utmData, "entry_point") : undefined

        return orderEntryPoint === "proactive_nudge"
            || Boolean(order.chat_id && proactiveNudgeChatIds.has(order.chat_id))
    })
    const proactiveNudgeRevenue = proactiveNudgeOrders.reduce((sum, order) => sum + (order.total || 0), 0)

    const proactiveNudgeAnalytics: ProactiveNudgeAnalytics = {
        shown: proactiveNudgeShown,
        clicked: proactiveNudgeClicked,
        dismissed: proactiveNudgeDismissed,
        chatsStarted: proactiveNudgeChatsStarted,
        orders: proactiveNudgeOrders.length,
        revenue: proactiveNudgeRevenue,
        ctr: proactiveNudgeShown > 0 ? (proactiveNudgeClicked / proactiveNudgeShown) * 100 : 0,
        chatStartRate: proactiveNudgeWebChatClicks > 0 ? (proactiveNudgeChatsStarted / proactiveNudgeWebChatClicks) * 100 : 0,
        orderRate: proactiveNudgeChatsStarted > 0 ? (proactiveNudgeOrders.length / proactiveNudgeChatsStarted) * 100 : 0,
        webChatClicks: proactiveNudgeWebChatClicks,
        whatsappClicks: proactiveNudgeWhatsappClicks,
        topProducts: Array.from(proactiveNudgeProductStats.entries())
            .map(([productId, stats]) => ({
                productId,
                productName: stats.productName,
                shown: stats.shown,
                clicked: stats.clicked,
                dismissed: stats.dismissed,
                ctr: stats.shown > 0 ? (stats.clicked / stats.shown) * 100 : 0,
            }))
            .sort((a, b) => b.clicked - a.clicked || b.shown - a.shown || b.ctr - a.ctr)
            .slice(0, 5),
    }

    const paidOrders = orders?.filter(order => order.payment_status === "paid").length || 0
    const fallbackPaidOrders = paidOrders || totalOrders
    const funnelStages: FunnelStage[] = [
        {
            label: "Visitas tienda",
            value: uniqueEventCount(["page_view"]) || totalChats,
            icon: "visibility",
            color: "bg-blue-500",
        },
        {
            label: "Producto visto",
            value: uniqueEventCount(["view_content"]),
            icon: "inventory_2",
            color: "bg-cyan-500",
            products: getFunnelProducts(["view_content"]),
        },
        {
            label: "Agregó al carrito",
            value: uniqueEventCount(["add_to_cart"]),
            icon: "add_shopping_cart",
            color: "bg-indigo-500",
            products: getFunnelProducts(["add_to_cart"]),
        },
        {
            label: "Inició checkout",
            value: uniqueEventCount(["checkout_started"]),
            icon: "shopping_cart_checkout",
            color: "bg-purple-500",
            products: getFunnelProducts(["checkout_started"]),
        },
        {
            label: "Completó datos",
            value: uniqueEventCount(["checkout_contact_submitted"]),
            icon: "assignment_turned_in",
            color: "bg-amber-500",
            products: getFunnelProducts(["checkout_contact_submitted"]),
        },
        {
            label: "Orden creada",
            value: uniqueEventCount(["checkout_order_created"]) || totalOrders,
            icon: "receipt_long",
            color: "bg-orange-500",
            products: getFunnelProducts(["checkout_order_created"]),
        },
        {
            label: "Compra pagada",
            value: uniqueEventCount(["purchase"]) || fallbackPaidOrders,
            icon: "payments",
            color: "bg-green-500",
            products: getFunnelProducts(["purchase"]),
        },
    ]

    const criticalDropOff = funnelStages.slice(1).reduce<{
        from: string
        to: string
        lost: number
        percentage: number
    } | null>((current, stage, index) => {
        const previous = funnelStages[index]
        const lost = Math.max(previous.value - stage.value, 0)
        const percentage = previous.value > 0 ? (lost / previous.value) * 100 : 0

        if (!current || percentage > current.percentage) {
            return {
                from: previous.label,
                to: stage.label,
                lost,
                percentage,
            }
        }

        return current
    }, null)

    // ============================================================
    // Top Products (de items JSONB en orders)
    // ============================================================
    const productStats: Record<string, { productName: string; totalRevenue: number; totalUnits: number }> = {}
    orders?.forEach(order => {
        const items = order.items as Array<{
            product_id?: string
            product_name?: string
            name?: string
            total_price?: number
            price?: number
            quantity?: number
        }> | null
        items?.forEach(item => {
            const pid = item.product_id || 'unknown'
            const name = item.product_name || item.name || 'Producto'
            const revenue = item.total_price || (item.price || 0) * (item.quantity || 1)
            if (!productStats[pid]) {
                productStats[pid] = { productName: name, totalRevenue: 0, totalUnits: 0 }
            }
            productStats[pid].totalRevenue += revenue
            productStats[pid].totalUnits += item.quantity || 1
        })
    })
    const topProducts = Object.entries(productStats)
        .map(([productId, stats]) => ({ productId, ...stats }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 5)

    // Productos con stock bajo (<=5 unidades)
    const lowStockProducts = (products || [])
        .filter(p => p.stock <= 5)
        .sort((a, b) => a.stock - b.stock)
        .map(p => ({ id: p.id, name: p.name, stock: p.stock, imageUrl: p.image_url }))

    // ============================================================
    // Revenue por canal (no solo conteo, sino $ por fuente)
    // ============================================================
    const revenueBySource: Record<string, { revenue: number; orders: number }> = {}
    orders?.forEach(order => {
        let source = 'direct'
        if (order.source_channel === 'chat' || order.chat_id) {
            source = 'chat'
        } else if (order.utm_data && typeof order.utm_data === 'object') {
            const utmData = order.utm_data as Record<string, unknown>
            const utmSource = (utmData.utm_source as string)?.toLowerCase() || ''
            if (utmSource.includes('facebook') || utmSource.includes('instagram') || utmSource.includes('meta') || utmSource.includes('fb') || utmSource.includes('ig')) {
                source = 'meta_ads'
            } else if (utmSource.includes('google')) {
                source = 'google_ads'
            } else if (utmSource) {
                source = 'campaign'
            }
        } else if (order.source_channel === 'whatsapp') {
            source = 'whatsapp'
        }
        if (!revenueBySource[source]) {
            revenueBySource[source] = { revenue: 0, orders: 0 }
        }
        revenueBySource[source].revenue += order.total || 0
        revenueBySource[source].orders += 1
    })

    // ============================================================
    // AI Performance: mensajes por chat (query adicional)
    // ============================================================
    const chatIds = chats?.map(c => c.id) || []
    let messagesData: Array<{ chat_id: string; sender_type: string; metadata: Record<string, unknown> | null }> = []
    if (chatIds.length > 0) {
        // Fetch messages en batches si hay muchos chats
        const batchSize = 100
        for (let i = 0; i < chatIds.length; i += batchSize) {
            const batch = chatIds.slice(i, i + batchSize)
            const { data } = await supabase
                .from("messages")
                .select("chat_id, sender_type, metadata")
                .in("chat_id", batch)
            if (data) messagesData = messagesData.concat(data)
        }
    }

    const totalMessages = messagesData.length
    // sender_type reales: "user" (cliente), "bot" (agente AI), "agent" (humano desde dashboard)
    const messagesByType = {
        user: messagesData.filter(m => m.sender_type === 'user' || m.sender_type === 'customer').length,
        assistant: messagesData.filter(m => m.sender_type === 'bot' || m.sender_type === 'agent').length,
        tool: 0, // Se calcula abajo desde metadata.tools_used
    }
    const avgMessagesPerChat = totalChats > 0 ? Math.round(totalMessages / totalChats) : 0

    // Chats que generaron orden
    const chatIdsWithOrder = new Set(orders?.filter(o => o.chat_id).map(o => o.chat_id) || [])
    const chatsWithOrder = chatIdsWithOrder.size

    // Top herramientas usadas (extraer de metadata.tools_used en mensajes del bot)
    const toolCounts: Record<string, number> = {}
    let totalToolCalls = 0
    messagesData.forEach(m => {
        if (m.sender_type === 'bot' && m.metadata) {
            const toolsUsed = m.metadata.tools_used as string[] | undefined
            if (toolsUsed && Array.isArray(toolsUsed)) {
                toolsUsed.forEach(tool => {
                    toolCounts[tool] = (toolCounts[tool] || 0) + 1
                    totalToolCalls++
                })
            }
        }
    })
    messagesByType.tool = totalToolCalls
    const topTools = Object.entries(toolCounts)
        .map(([tool, count]) => ({ tool, count }))
        .sort((a, b) => b.count - a.count)

    // Conversión por canal
    const webChats = chats?.filter(c => !c.channel || c.channel === 'web') || []
    const waChats = chats?.filter(c => c.channel === 'whatsapp') || []
    const webChatIds = new Set(webChats.map(c => c.id))
    const waChatIds = new Set(waChats.map(c => c.id))
    const webOrders = orders?.filter(o => o.chat_id && webChatIds.has(o.chat_id)).length || 0
    const waOrders = orders?.filter(o => o.chat_id && waChatIds.has(o.chat_id)).length || 0

    return {
        organization: org,
        metrics: {
            totalOrders,
            totalRevenue,
            totalChats,
            conversionRate,
            averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
            ordersFromChat,
            chatConversionRate,
        },
        charts: {
            ordersByDay: Object.entries(ordersByDay).map(([date, count]) => ({ date, orders: count })),
            revenueByDay: Object.entries(revenueByDay).map(([date, revenue]) => ({ date, revenue })),
        },
        chatsByChannel,
        ordersBySource,
        trackingEnabled: {
            posthog: Boolean(org.tracking_config?.posthog_enabled),
            metaPixel: Boolean(org.tracking_config?.meta_pixel_id),
            metaCapi: Boolean(org.tracking_config?.meta_capi_access_token || org.tracking_config?.meta_access_token),
            firstParty: true,
        },
        funnel: {
            stages: funnelStages,
            criticalDropOff,
        },
        campaignPerformance,
        checkoutIntelligence,
        proactiveNudgeAnalytics,
        topProducts,
        lowStockProducts,
        revenueBySource,
        aiPerformance: {
            totalChats,
            chatsWithOrder,
            chatConversionRate,
            totalMessages,
            avgMessagesPerChat,
            messagesByType,
            topTools,
            channelBreakdown: {
                web: { chats: webChats.length, orders: webOrders },
                whatsapp: { chats: waChats.length, orders: waOrders },
            },
        },
    }
}

export default async function AnalyticsPage() {
    const data = await getAnalyticsData()

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
        }).format(amount)
    }

    return (
        <DashboardLayout>
            <div className="space-y-8">
                <div>
                    <h1 className="text-3xl font-bold text-text-light-primary dark:text-text-dark-primary">
                        Analytics
                    </h1>
                    <p className="text-text-light-secondary dark:text-text-dark-secondary mt-2">
                        Métricas de rendimiento de tu tienda en los últimos 30 días
                    </p>
                </div>

                {/* Tracking Status */}
                <div className="flex gap-2 flex-wrap">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${data.trackingEnabled.posthog
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        }`}>
                        <span className={`w-2 h-2 rounded-full mr-2 ${data.trackingEnabled.posthog ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                        PostHog {data.trackingEnabled.posthog ? 'Activo' : 'Inactivo'}
                    </span>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${data.trackingEnabled.metaPixel
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        }`}>
                        <span className={`w-2 h-2 rounded-full mr-2 ${data.trackingEnabled.metaPixel ? 'bg-blue-500' : 'bg-gray-400'}`}></span>
                        Meta Pixel {data.trackingEnabled.metaPixel ? 'Activo' : 'Inactivo'}
                    </span>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${data.trackingEnabled.metaCapi
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        }`}>
                        <span className={`w-2 h-2 rounded-full mr-2 ${data.trackingEnabled.metaCapi ? 'bg-purple-500' : 'bg-gray-400'}`}></span>
                        Meta CAPI {data.trackingEnabled.metaCapi ? 'Activo' : 'Inactivo'}
                    </span>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                        <span className="w-2 h-2 rounded-full mr-2 bg-emerald-500"></span>
                        First-party Activo
                    </span>
                </div>

                {/* KPI Cards */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Ingresos (30d)</CardTitle>
                            <span className="material-symbols-outlined text-green-500">payments</span>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(data.metrics.totalRevenue)}</div>
                            <p className="text-xs text-muted-foreground">
                                {data.metrics.totalOrders} órdenes
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Conversaciones</CardTitle>
                            <span className="material-symbols-outlined text-blue-500">chat</span>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{data.metrics.totalChats}</div>
                            <p className="text-xs text-muted-foreground">
                                Chats iniciados
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Tasa de Conversión</CardTitle>
                            <span className="material-symbols-outlined text-purple-500">trending_up</span>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{data.metrics.conversionRate}%</div>
                            <p className="text-xs text-muted-foreground">
                                Chat → Compra
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Ticket Promedio</CardTitle>
                            <span className="material-symbols-outlined text-orange-500">shopping_cart</span>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(data.metrics.averageOrderValue)}</div>
                            <p className="text-xs text-muted-foreground">
                                Por orden
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Charts */}
                <div className="grid gap-6 lg:grid-cols-2">
                    <AnalyticsCharts
                        ordersByDay={data.charts.ordersByDay}
                        revenueByDay={data.charts.revenueByDay}
                    />
                    <TrafficSources chatsByChannel={data.chatsByChannel} />
                </div>

                {/* Conversion Funnel + Sales Sources */}
                <div className="grid gap-6 lg:grid-cols-2">
                    <ConversionFunnelV2
                        stages={data.funnel.stages}
                        criticalDropOff={data.funnel.criticalDropOff}
                    />
                    <CampaignPerformanceCard campaigns={data.campaignPerformance} />
                </div>

                <CheckoutIntelligenceCard intelligence={data.checkoutIntelligence} />

                <ProactiveNudgeCard analytics={data.proactiveNudgeAnalytics} />

                <div className="grid gap-6 lg:grid-cols-2">
                    <SalesSources
                        ordersBySource={data.ordersBySource}
                        totalOrders={data.metrics.totalOrders}
                    />
                    <RevenueByChannelCard
                        revenueBySource={data.revenueBySource}
                        totalRevenue={data.metrics.totalRevenue}
                    />
                </div>

                {/* Top Products + Revenue by Channel */}
                <div className="grid gap-6 lg:grid-cols-2">
                    <TopProductsCard
                        topProducts={data.topProducts}
                        lowStockProducts={data.lowStockProducts}
                    />
                    <MetaAdsCard />
                </div>

                {/* AI Performance */}
                <AiPerformanceCard {...data.aiPerformance} />
            </div>
        </DashboardLayout>
    )
}
