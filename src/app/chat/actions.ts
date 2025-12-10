"use server"

import { createClient } from "@/lib/supabase/server"
import { paymentService } from "@/lib/payments/payment-service"

interface CreateOrderParams {
    slug: string
    customerInfo: {
        name: string
        email: string
        phone: string
        address: string
        city: string
        // Tax/Invoicing fields
        document_type: string
        document_number: string
        person_type: string
        business_name?: string
    }
    items: Array<{
        id: string
        name: string
        price: number
        quantity: number
    }>
    subtotal: number
    shippingCost: number
    total: number
    paymentMethod: string
}

/**
 * Generate unique order number
 * Format: ORD-YYYYMMDD-XXX
 */
function generateOrderNumber(): string {
    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    return `ORD-${year}${month}${day}-${random}`
}

/**
 * Transform cart items to order items format
 */
function transformCartItemsToOrderItems(cartItems: Array<{id: string, name: string, price: number, quantity: number}>) {
    return cartItems.map(item => ({
        product_id: item.id,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.price * item.quantity,
        variant_info: null
    }))
}

export async function createOrder(params: CreateOrderParams) {
    const supabase = await createClient()

    try {
        // 1. Get Organization ID from Slug
        const { data: org, error: orgError } = await supabase
            .from("organizations")
            .select("id")
            .eq("slug", params.slug)
            .single()

        if (orgError || !org) {
            return { success: false, error: "Organización no encontrada" }
        }

        // 2. Create/Update Customer (Upsert by email)
        const { data: customer, error: customerError } = await supabase
            .from("customers")
            .upsert({
                organization_id: org.id,
                email: params.customerInfo.email,
                phone: params.customerInfo.phone,
                full_name: params.customerInfo.name,
                // Tax/Invoicing fields
                document_type: params.customerInfo.document_type,
                document_number: params.customerInfo.document_number,
                person_type: params.customerInfo.person_type,
                business_name: params.customerInfo.business_name,
                metadata: {
                    address: params.customerInfo.address,
                    city: params.customerInfo.city
                }
            }, { onConflict: 'organization_id, email' })
            .select()
            .single()

        if (customerError) {
            console.error("[createOrder] Error creating customer:", customerError)
            // Continue with order creation even if customer upsert fails
        }

        // 3. Generate unique order number
        const orderNumber = generateOrderNumber()

        // 4. Calculate tax (IVA 19% included in total)
        // Formula: tax = total / 1.19 * 0.19
        const calculatedTax = Math.round((params.total / 1.19 * 0.19) * 100) / 100

        // 5. Transform cart items to order items format
        const orderItems = transformCartItemsToOrderItems(params.items)

        // 6. Create Order
        const { data: order, error: orderError } = await supabase
            .from("orders")
            .insert({
                organization_id: org.id,
                customer_id: customer?.id,
                order_number: orderNumber,
                customer_info: params.customerInfo, // Store complete customer info including tax fields
                items: orderItems,
                subtotal: params.subtotal,
                shipping_cost: params.shippingCost,
                tax: calculatedTax,
                total: params.total,
                status: 'pending',
                payment_status: 'pending',
                payment_method: params.paymentMethod,
            })
            .select()
            .single()

        if (orderError) {
            console.error("[createOrder] Error creating order:", orderError)
            return { success: false, error: "Error al crear la orden" }
        }

        // 7. If payment method is not manual, initiate payment
        if (params.paymentMethod !== 'manual') {
            const paymentResult = await paymentService.initiatePayment({
                orderId: order.id,
                organizationId: org.id,
                amount: Math.round(params.total * 100), // Convert to cents
                currency: 'COP',
                customerEmail: params.customerInfo.email,
                customerName: params.customerInfo.name,
                customerDocument: params.customerInfo.document_number,
                customerDocumentType: params.customerInfo.document_type,
                customerPhone: params.customerInfo.phone,
                returnUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://landingchat.co'}/store/${params.slug}/order/${order.id}`,
                paymentMethod: params.paymentMethod as "wompi" | "epayco"
            })

            if (!paymentResult.success) {
                // Payment initiation failed, but order was created
                return {
                    success: false,
                    error: paymentResult.error || "Error al iniciar el pago",
                    order
                }
            }

            return {
                success: true,
                order,
                paymentUrl: paymentResult.paymentUrl
            }
        }

        // Manual payment - no payment URL needed
        return { success: true, order }

    } catch (error) {
        console.error("[createOrder] Unexpected error:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Error inesperado al crear la orden"
        }
    }
}
