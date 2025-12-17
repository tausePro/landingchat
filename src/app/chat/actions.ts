"use server"

import { createClient, createServiceClient } from "@/lib/supabase/server"
import { paymentService } from "@/lib/payments/payment-service"
import { sendSaleNotification } from "@/lib/notifications/whatsapp"
import { sendOrderConfirmationEmail, sendOrderNotificationToOwner } from "@/lib/notifications/email"

interface CreateOrderParams {
    slug: string
    customerInfo: {
        name: string
        email: string
        phone: string
        address: string
        city: string
        state: string // Departamento
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
        image?: string
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
const FALLBACK_IMAGE = 'https://landingchat.co/images/placeholder.png' // Use a valid placeholder

function transformCartItemsToOrderItems(cartItems: Array<{ id: string, name: string, price: number, quantity: number, image?: string }>) {
    return cartItems.map(item => ({
        product_id: item.id,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.price * item.quantity,
        variant_info: null,
        image_url: item.image || FALLBACK_IMAGE // Persist image URL
    }))
}

/**
 * Get shipping configuration for organization
 */
export async function getShippingConfig(slug: string) {
    const supabase = createServiceClient()

    try {
        // Get organization ID from slug
        const { data: org, error: orgError } = await supabase
            .from("organizations")
            .select("id")
            .eq("slug", slug)
            .single()

        if (orgError || !org) {
            return { success: false, error: "Organización no encontrada", config: null }
        }

        // Get shipping settings
        const { data: shippingSettings, error: shippingError } = await supabase
            .from("shipping_settings")
            .select("*")
            .eq("organization_id", org.id)
            .single()

        if (shippingError) {
            console.error("[getShippingConfig] Error:", shippingError)
            // Return default shipping if no config found
            return { 
                success: true, 
                config: {
                    default_shipping_rate: 5000, // Default 5000 COP
                    free_shipping_enabled: false,
                    free_shipping_min_amount: null,
                    free_shipping_zones: null
                }
            }
        }

        return { 
            success: true, 
            config: shippingSettings
        }
    } catch (error) {
        console.error("[getShippingConfig] Unexpected error:", error)
        return { success: false, error: "Error inesperado", config: null }
    }
}



/**
 * Get available payment gateways for organization
 */
export async function getAvailablePaymentGateways(slug: string) {
    const supabase = createServiceClient()

    try {
        // Get organization ID from slug
        const { data: org, error: orgError } = await supabase
            .from("organizations")
            .select("id")
            .eq("slug", slug)
            .single()

        if (orgError || !org) {
            return { success: false, error: "Organización no encontrada", gateways: [] }
        }

        // Get active payment gateways
        const { data: gateways, error: gatewaysError } = await supabase
            .from("payment_gateway_configs")
            .select("provider, is_active, is_test_mode")
            .eq("organization_id", org.id)
            .eq("is_active", true)

        if (gatewaysError) {
            console.error("[getAvailablePaymentGateways] Error:", gatewaysError)
            return { success: false, error: "Error al obtener pasarelas", gateways: [] }
        }

        return { 
            success: true, 
            gateways: gateways || []
        }
    } catch (error) {
        console.error("[getAvailablePaymentGateways] Unexpected error:", error)
        return { success: false, error: "Error inesperado", gateways: [] }
    }
}

export async function createOrder(params: CreateOrderParams) {
    // ⚠️ Security: Use service client to bypass RLS restrictions on orders/customers table
    // Since we blocked public anonymity access in production
    const supabase = createServiceClient()

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
                    city: params.customerInfo.city,
                    state: params.customerInfo.state
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
            // Obtener el dominio personalizado de la organización si existe
            const { data: orgDetails } = await supabase
                .from("organizations")
                .select("custom_domain, slug")
                .eq("id", org.id)
                .single()
            
            // Construir la URL base: usar dominio personalizado si existe, sino landingchat.co
            let baseUrl: string
            if (orgDetails?.custom_domain) {
                // Dominio personalizado: https://tez.com.co
                baseUrl = `https://${orgDetails.custom_domain}`
            } else {
                // Subdominio de landingchat: https://landingchat.co/store/slug
                baseUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://landingchat.co'}/store/${params.slug}`
            }

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
                returnUrl: `${baseUrl}/order/${order.id}`,
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

        // 8. Manual Payment & Success Handler
        // Send notifications (Fire and Forget)
        try {
            // Get organization details for notifications
            const { data: orgDetails } = await supabase
                .from("organizations")
                .select("name, contact_email")
                .eq("id", org.id)
                .single()

            const organizationName = orgDetails?.name || "Tu Tienda"
            const ownerEmail = orgDetails?.contact_email

            // Send WhatsApp notification to store owner
            console.log("[createOrder] Sending WhatsApp notification for order:", orderNumber)
            await sendSaleNotification(
                { organizationId: org.id },
                {
                    id: order.order_number,
                    total: params.total,
                    customerName: params.customerInfo.name,
                    items: params.items
                }
            )

            // Send email confirmation to customer
            console.log("[createOrder] Sending email confirmation to customer:", params.customerInfo.email)
            await sendOrderConfirmationEmail({
                orderNumber: order.order_number || `#${order.id.slice(0, 8)}`,
                customerName: params.customerInfo.name,
                customerEmail: params.customerInfo.email,
                total: params.total,
                items: params.items,
                paymentMethod: params.paymentMethod,
                organizationName: organizationName,
                storeUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://landingchat.co'}/store/${params.slug}`
            })

            // Send email notification to store owner
            if (ownerEmail) {
                console.log("[createOrder] Sending email notification to owner:", ownerEmail)
                await sendOrderNotificationToOwner({
                    orderNumber: order.order_number || `#${order.id.slice(0, 8)}`,
                    customerName: params.customerInfo.name,
                    customerEmail: params.customerInfo.email,
                    total: params.total,
                    items: params.items,
                    ownerEmail: ownerEmail,
                    organizationName: organizationName
                })
            } else {
                console.log("[createOrder] No owner email configured, skipping owner notification")
            }

        } catch (e) {
            console.error("Failed to send notifications:", e)
        }

        return { success: true, order }

    } catch (error) {
        console.error("[createOrder] Unexpected error:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Error inesperado al crear la orden"
        }
    }
}
