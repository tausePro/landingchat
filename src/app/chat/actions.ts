"use server"

import { createClient } from "@/lib/supabase/server"

interface CreateOrderParams {
    slug: string
    customerInfo: {
        name: string
        email: string
        phone: string
        address: string
        city: string
    }
    items: any[]
    subtotal: number
    shippingCost: number
    total: number
    paymentMethod: string
}

export async function createOrder(params: CreateOrderParams) {
    const supabase = await createClient()

    // 1. Get Organization ID from Slug
    const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select("id")
        .eq("slug", params.slug)
        .single()

    if (orgError || !org) {
        return { success: false, error: "Organization not found" }
    }

    // 2. Create/Update Customer (Upsert by email)
    // We use the organization_id and email as unique constraint if defined, 
    // or just insert. The schema has UNIQUE(organization_id, email).
    const { data: customer, error: customerError } = await supabase
        .from("customers")
        .upsert({
            organization_id: org.id,
            email: params.customerInfo.email,
            phone: params.customerInfo.phone,
            full_name: params.customerInfo.name,
            metadata: {
                address: params.customerInfo.address,
                city: params.customerInfo.city
            }
        }, { onConflict: 'organization_id, email' })
        .select()
        .single()

    if (customerError) {
        console.error("Error creating customer:", customerError)
        // Continue even if customer creation fails? Maybe not.
        // But for now let's proceed with order creation using the info provided.
    }

    // 3. Create Order
    const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
            organization_id: org.id,
            customer_id: customer?.id, // Link if customer created
            customer_info: params.customerInfo,
            items: params.items,
            subtotal: params.subtotal,
            shipping_cost: params.shippingCost,
            total: params.total,
            status: 'pending',
            payment_method: params.paymentMethod,
            // chat_id: ??? // We don't have chat_id passed yet, maybe add later
        })
        .select()
        .single()

    if (orderError) {
        console.error("Error creating order:", orderError)
        return { success: false, error: "Failed to create order" }
    }

    return { success: true, order }
}
