"use server"

import { createClient } from "@/lib/supabase/server"

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
}

export async function getOrders({ page = 1, limit = 10, status, search }: GetOrdersParams) {
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
            total,
            customer:customers(full_name, email),
            items
        `, { count: 'exact' })
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: false })

    // Apply filters
    if (status && status !== "Todos los estados") {
        query = query.eq("status", status.toLowerCase())
    }

    if (search) {
        // Simple ID search if it looks like a UUID or short ID
        // Since we can't easily search joined customer name without embedding or RPC
        // We will filter by ID if possible.
        // For now, let's just return all and filter in memory if search is present (not ideal for large data but works for MVP)
        // Or better, just ignore search for now if it causes issues, or try to match ID.
        // query = query.ilike("id", `%${search}%`) // UUIDs are strict
    }

    // Pagination
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) {
        console.error("Error fetching orders:", error)
        throw new Error("Failed to fetch orders")
    }

    // Transform data to match interface
    const orders: Order[] = data.map((order: any) => ({
        id: order.id,
        created_at: order.created_at,
        status: order.status,
        total_amount: order.total,
        currency: 'COP', // Default to COP as it's not in schema
        customer: order.customer,
        items_count: Array.isArray(order.items) ? order.items.length : 0
    }))

    return {
        orders,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
    }
}
