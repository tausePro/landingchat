"use server"

import { createClient } from "@/lib/supabase/server"

const ALL_STATUSES = new Set(["", "all", "Todos los estados"])

const STATUS_ALIASES: Record<string, string> = {
    pendiente: "pending",
    confirmado: "confirmed",
    confirmada: "confirmed",
    procesando: "processing",
    enviado: "shipped",
    enviada: "shipped",
    entregado: "delivered",
    entregada: "delivered",
    cancelado: "cancelled",
    cancelada: "cancelled",
    reembolsado: "refunded",
    reembolsada: "refunded",
}

interface OrderRow {
    id: string
    created_at: string
    status: string
    total: number | string | null
    order_number: string | null
    customer_info: {
        name?: string
        full_name?: string
        email?: string
    } | null
    items: unknown
}

export interface Order {
    id: string
    created_at: string
    status: string
    total_amount: number
    currency: string
    customer: {
        full_name: string
        email: string
    } | null
    items_count: number
}

export interface GetOrdersParams {
    page?: number
    limit?: number
    status?: string
    search?: string
    from?: string
    to?: string
}

function normalizeStatusFilter(status?: string) {
    if (!status || ALL_STATUSES.has(status)) return null
    const normalized = status.trim().toLowerCase()
    return STATUS_ALIASES[normalized] || normalized
}

function toBogotaStartOfDay(date: string) {
    return new Date(`${date}T00:00:00.000-05:00`).toISOString()
}

function toBogotaEndOfDay(date: string) {
    return new Date(`${date}T23:59:59.999-05:00`).toISOString()
}

function isValidDateInput(value?: string): value is string {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function sanitizeSearchTerm(value?: string) {
    return value?.trim().replace(/[%,()]/g, "") || ""
}

export async function getOrders({ page = 1, limit = 10, status, search, from, to }: GetOrdersParams) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error("Unauthorized")

    // Get organization_id
    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) throw new Error("No organization found")

    // Build query
    let query = supabase
        .from("orders")
        .select(`
            id,
            created_at,
            status,
            order_number,
            total,
            customer_info,
            items
        `, { count: 'exact' })
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: false })

    const statusFilter = normalizeStatusFilter(status)
    if (statusFilter) {
        query = query.eq("status", statusFilter)
    }

    if (isValidDateInput(from)) {
        query = query.gte("created_at", toBogotaStartOfDay(from))
    }

    if (isValidDateInput(to)) {
        query = query.lte("created_at", toBogotaEndOfDay(to))
    }

    const searchTerm = sanitizeSearchTerm(search)
    if (searchTerm) {
        const searchFilters = [
            `order_number.ilike.%${searchTerm}%`,
            `customer_info->>name.ilike.%${searchTerm}%`,
            `customer_info->>full_name.ilike.%${searchTerm}%`,
            `customer_info->>email.ilike.%${searchTerm}%`,
        ]

        if (/^[0-9a-f-]{36}$/i.test(searchTerm)) {
            searchFilters.push(`id.eq.${searchTerm}`)
        }

        query = query.or(searchFilters.join(","))
    }

    // Pagination
    const rangeFrom = (page - 1) * limit
    const rangeTo = rangeFrom + limit - 1
    query = query.range(rangeFrom, rangeTo)

    const { data, error, count } = await query

    if (error) {
        console.error("Error fetching orders:", error)
        throw new Error("Failed to fetch orders")
    }

    const rows = (data ?? []) as OrderRow[]
    const orders: Order[] = rows.map((order) => {
        // Extract customer info from JSONB field
        const customerInfo = order.customer_info

        return {
            id: order.id,
            created_at: order.created_at,
            status: order.status,
            total_amount: typeof order.total === "number" ? order.total : Number(order.total ?? 0),
            currency: 'COP', // Default to COP as it's not in schema
            customer: customerInfo ? {
                full_name: customerInfo.name || customerInfo.full_name || 'Cliente Anónimo',
                email: customerInfo.email || ''
            } : null,
            items_count: Array.isArray(order.items) ? order.items.length : 0
        }
    })

    return {
        orders,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
    }
}
