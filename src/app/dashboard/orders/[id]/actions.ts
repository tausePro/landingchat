"use server"

import { createClient } from "@/lib/supabase/server"

export interface OrderDetail {
    id: string
    created_at: string
    updated_at: string
    status: string
    total: number
    subtotal: number
    tax: number
    shipping_cost: number
    notes: string | null
    customer: {
        id: string
        full_name: string
        email: string | null
        phone: string | null
    } | null
    items: Array<{
        id: string
        product_id: string
        product_name: string
        quantity: number
        unit_price: number
        total_price: number
        variant_info: any
    }>
    shipping_address: any
    billing_address: any
}

export async function getOrderDetail(orderId: string): Promise<OrderDetail | null> {
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

    // Fetch order - don't join customers, use customer_info instead
    const { data: order, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .eq("organization_id", profile.organization_id)
        .single()

    if (error) {
        console.error("[getOrderDetail] Error fetching order:", error)
        return null
    }

    if (!order) {
        console.error("[getOrderDetail] Order not found:", orderId)
        return null
    }

    console.log("[getOrderDetail] Order found:", {
        id: order.id,
        status: order.status,
        total: order.total,
        hasItems: Array.isArray(order.items),
        itemsCount: Array.isArray(order.items) ? order.items.length : 0,
        hasCustomerInfo: !!order.customer_info
    })

    // Extract customer info from JSONB field
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const customerInfo = order.customer_info as any
    
    return {
        id: order.id,
        created_at: order.created_at,
        updated_at: order.updated_at || order.created_at,
        status: order.status,
        total: order.total || 0,
        subtotal: order.subtotal || 0,
        tax: order.tax || 0,
        shipping_cost: order.shipping_cost || 0,
        notes: order.notes || null,
        customer: customerInfo ? {
            id: order.customer_id || 'anonymous',
            full_name: customerInfo.name || customerInfo.full_name || 'Cliente anónimo',
            email: customerInfo.email || null,
            phone: customerInfo.phone || null
        } : null,
        items: Array.isArray(order.items) ? order.items : [],
        shipping_address: order.shipping_address || null,
        billing_address: null
    }
}

export async function updateOrderStatus(orderId: string, newStatus: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error("Unauthorized")

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) throw new Error("No organization found")

    const { error } = await supabase
        .from("orders")
        .update({
            status: newStatus,
            updated_at: new Date().toISOString()
        })
        .eq("id", orderId)
        .eq("organization_id", profile.organization_id)

    if (error) {
        console.error("Error updating order status:", error)
        throw new Error("Failed to update order status")
    }

    return { success: true }
}
