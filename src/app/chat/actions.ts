"use server"

import { createClient, createServiceClient } from "@/lib/supabase/server"
import { paymentService } from "@/lib/payments/payment-service"
import { sendSaleNotification } from "@/lib/notifications/whatsapp"
import { sendOrderConfirmationEmail, sendOrderNotificationToOwner } from "@/lib/notifications/email"
import { calculateTaxForItems, buildProductTaxMap, type OrgTaxSettings } from "@/lib/utils/tax"

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
        image_url?: string // Support both property names (cart store uses image_url)
    }>
    subtotal: number
    shippingCost: number
    total: number
    paymentMethod: string
    couponCode?: string
    discountAmount?: number
    // Tracking fields
    sourceChannel?: "web" | "chat" | "whatsapp"
    chatId?: string
    utmData?: {
        utm_source?: string
        utm_medium?: string
        utm_campaign?: string
        utm_content?: string
        utm_term?: string
        referrer?: string
    }
}


/**
 * Calculate order totals including tax and fees
 * This ensures frontend and backend use the SAME calculation logic
 */
export async function calculateOrderSummary(params: {
    slug: string,
    items: Array<{ id: string, price: number, quantity: number }>,
    paymentMethod?: string,
    shippingCost?: number
}) {
    const supabase = await createServiceClient()

    try {
        // 1. Get Organization (for tax settings)
        const { data: org, error: orgError } = await supabase
            .from("organizations")
            .select("id, tax_enabled, tax_rate, prices_include_tax")
            .eq("slug", params.slug)
            .single()

        if (orgError || !org) return { success: false, error: "Organización no encontrada" }

        // 2. Get Product Tax Rates & Calculate Tax
        const productIds = params.items.map(item => item.id)
        const { data: products } = await supabase
            .from("products")
            .select("id, tax_rate")
            .in("id", productIds)

        const productTaxMap = buildProductTaxMap(products)
        const taxResult = calculateTaxForItems(
            params.items,
            productTaxMap,
            { tax_enabled: org.tax_enabled, tax_rate: org.tax_rate, prices_include_tax: org.prices_include_tax }
        )
        const calculatedTax = taxResult.totalTax

        // 3. Calculate Payment Fee
        let paymentMethodFee = 0
        if (params.paymentMethod === 'contraentrega' || params.paymentMethod === 'cash_on_delivery') {
            const { data: manualPayment } = await supabase
                .from("manual_payment_methods")
                .select("cod_enabled, cod_additional_cost")
                .eq("organization_id", org.id)
                .single()

            if (manualPayment?.cod_enabled) {
                paymentMethodFee = manualPayment.cod_additional_cost || 0
            }
        }

        // 4. Calculate Final Total
        const subtotal = params.items.reduce((acc, item) => acc + (item.price * item.quantity), 0)
        let total = subtotal

        // Si precios NO incluyen IVA, sumar el impuesto al total
        // Si precios incluyen IVA, el tax ya está en el subtotal
        if (!org.prices_include_tax) {
            total += calculatedTax
        }

        total += (params.shippingCost || 0) + paymentMethodFee

        return {
            success: true,
            subtotal,
            baseSubtotal: taxResult.baseSubtotal,
            tax: calculatedTax,
            shipping: params.shippingCost || 0,
            paymentMethodFee,
            total,
            pricesIncludeTax: org.prices_include_tax
        }

    } catch (error) {
        console.error("Error calculating summary:", error)
        return { success: false, error: "Error de cálculo" }
    }
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

function transformCartItemsToOrderItems(cartItems: Array<{ id: string, name: string, price: number, quantity: number, image?: string, image_url?: string }>) {
    return cartItems.map(item => ({
        product_id: item.id,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.price * item.quantity,
        variant_info: null,
        // Support both 'image' and 'image_url' property names (cart store uses image_url)
        image_url: item.image_url || item.image || FALLBACK_IMAGE
    }))
}

/**
 * Get shipping configuration for organization
 */
export async function getShippingConfig(slug: string) {
    const supabase = await createServiceClient()

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
                    default_shipping_rate: 0,
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
    const supabase = await createServiceClient()

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

/**
 * Get manual payment methods info for organization (bank transfer, Nequi, COD)
 */
export async function getManualPaymentInfo(slug: string) {
    const supabase = await createServiceClient()

    try {
        // Get organization ID from slug
        const { data: org, error: orgError } = await supabase
            .from("organizations")
            .select("id")
            .eq("slug", slug)
            .single()

        if (orgError || !org) {
            return { success: false, error: "Organización no encontrada", data: null }
        }

        // Get manual payment methods config
        const { data: manualPayment, error: manualError } = await supabase
            .from("manual_payment_methods")
            .select("*")
            .eq("organization_id", org.id)
            .single()

        if (manualError && manualError.code !== "PGRST116") {
            console.error("[getManualPaymentInfo] Error:", manualError)
            return { success: false, error: "Error al obtener métodos manuales", data: null }
        }

        return {
            success: true,
            data: manualPayment || null
        }
    } catch (error) {
        console.error("[getManualPaymentInfo] Unexpected error:", error)
        return { success: false, error: "Error inesperado", data: null }
    }
}


/**
 * Validate a coupon code for a given organization and subtotal
 */
export async function validateCoupon(slug: string, code: string, subtotal: number) {
    const supabase = await createServiceClient()

    try {
        const { data: org } = await supabase
            .from("organizations")
            .select("id")
            .eq("slug", slug)
            .single()

        if (!org) return { success: false, error: "Organización no encontrada" }

        const { data: coupon, error } = await supabase
            .from("coupons")
            .select("*")
            .eq("organization_id", org.id)
            .eq("code", code.toUpperCase())
            .eq("is_active", true)
            .single()

        if (error || !coupon) {
            return { success: false, error: "Código de descuento inválido" }
        }

        const now = new Date()

        if (coupon.valid_from && new Date(coupon.valid_from) > now) {
            return { success: false, error: "Este código aún no está vigente" }
        }

        if (coupon.valid_until && new Date(coupon.valid_until) < now) {
            return { success: false, error: "Este código ha expirado" }
        }

        if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
            return { success: false, error: "Este código ya alcanzó su límite de usos" }
        }

        if (coupon.min_purchase_amount && subtotal < Number(coupon.min_purchase_amount)) {
            return {
                success: false,
                error: `Compra mínima de $${Number(coupon.min_purchase_amount).toLocaleString()} requerida`
            }
        }

        let discountAmount = 0
        if (coupon.type === "percentage") {
            discountAmount = subtotal * (Number(coupon.value) / 100)
            if (coupon.max_discount_amount && discountAmount > Number(coupon.max_discount_amount)) {
                discountAmount = Number(coupon.max_discount_amount)
            }
        } else if (coupon.type === "fixed") {
            discountAmount = Math.min(Number(coupon.value), subtotal)
        } else if (coupon.type === "free_shipping") {
            return {
                success: true,
                coupon: {
                    code: coupon.code,
                    type: coupon.type as string,
                    value: 0,
                    discountAmount: 0,
                    maxDiscountAmount: null,
                    freeShipping: true,
                    description: coupon.description || "Envío gratis"
                }
            }
        }

        discountAmount = Math.round(discountAmount)

        return {
            success: true,
            coupon: {
                code: coupon.code,
                type: coupon.type as string,
                value: Number(coupon.value),
                discountAmount,
                maxDiscountAmount: coupon.max_discount_amount ? Number(coupon.max_discount_amount) : null,
                freeShipping: false,
                description: coupon.description || `Descuento de $${discountAmount.toLocaleString()}`
            }
        }
    } catch (error) {
        console.error("[validateCoupon] Error:", error)
        return { success: false, error: "Error al validar cupón" }
    }
}

export async function createOrder(params: CreateOrderParams) {
    // ⚠️ Security: Use service client to bypass RLS restrictions on orders/customers table
    // Since we blocked public anonymity access in production
    const supabase = await createServiceClient()

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

        // 4. Calculate Taxes and Fees
        let paymentMethodFee = 0

        // 4.1 Get Organization Tax Settings
        const { data: orgSettings } = await supabase
            .from("organizations")
            .select("tax_enabled, tax_rate, prices_include_tax")
            .eq("id", org.id)
            .single()

        // 4.2 Get COD Fee if applicable
        if (params.paymentMethod === 'contraentrega' || params.paymentMethod === 'cash_on_delivery') {
            const manualPaymentInfo = await getManualPaymentInfo(params.slug)
            if (manualPaymentInfo.success && manualPaymentInfo.data?.cod_enabled) {
                paymentMethodFee = manualPaymentInfo.data.cod_additional_cost || 0
            }
        }

        // 4.3 Calculate Tax per Item (función centralizada)
        const productIds = params.items.map(item => item.id)
        const { data: products } = await supabase
            .from("products")
            .select("id, tax_rate")
            .in("id", productIds)

        const productTaxMap = buildProductTaxMap(products)
        const orgTaxSettings: OrgTaxSettings = {
            tax_enabled: orgSettings?.tax_enabled ?? false,
            tax_rate: orgSettings?.tax_rate ?? 0,
            prices_include_tax: orgSettings?.prices_include_tax ?? false,
        }
        const taxResult = calculateTaxForItems(params.items, productTaxMap, orgTaxSettings)
        const calculatedTax = taxResult.totalTax

        // 5. Transform cart items to order items format
        const orderItems = transformCartItemsToOrderItems(params.items)

        // 6. Create Order
        // Recalculate total to ensure consistency
        // If prices include tax, subtotal already includes it, so don't add it again to total
        // If prices exclude tax, add it.
        // HOWEVER: The frontend passes 'subtotal' and 'total'. 
        // We should respect the frontend 'subtotal' as the base price sum.
        // But we must correct the 'total' with our calculated tax and fees for security.

        let finalTotal = params.subtotal
        const discountAmount = params.discountAmount || 0

        if (!orgSettings?.prices_include_tax) {
            finalTotal += calculatedTax
        }

        finalTotal -= discountAmount
        finalTotal += params.shippingCost + paymentMethodFee

        // If there's a small difference (rounding) vs frontend, prefer backend calc? 
        // Or just trust backend calc is safer. 
        // For now, let's use our calculated finalTotal.

        const { data: order, error: orderError } = await supabase
            .from("orders")
            .insert({
                organization_id: org.id,
                customer_id: customer?.id,
                order_number: orderNumber,
                customer_info: {
                    ...params.customerInfo,
                    payment_method_fee: paymentMethodFee > 0 ? paymentMethodFee : undefined,
                    coupon_code: params.couponCode || undefined,
                    discount_amount: discountAmount > 0 ? discountAmount : undefined
                },
                items: orderItems,
                subtotal: params.subtotal,
                shipping_cost: params.shippingCost,
                tax: calculatedTax,
                total: finalTotal,
                status: 'pending',
                payment_status: 'pending',
                payment_method: params.paymentMethod,
                // Tracking fields
                source_channel: params.sourceChannel || 'web',
                chat_id: params.chatId || null,
                utm_data: params.utmData || {},
            })
            .select()
            .single()

        if (orderError) {
            console.error("[createOrder] Error creating order:", orderError)
            return { success: false, error: "Error al crear la orden" }
        }

        // Increment coupon usage if coupon was applied
        if (params.couponCode) {
            try {
                // Get current coupon to increment
                const { data: couponData } = await supabase
                    .from("coupons")
                    .select("id, current_uses")
                    .eq("organization_id", org.id)
                    .eq("code", params.couponCode.toUpperCase())
                    .single()

                if (couponData) {
                    await supabase
                        .from("coupons")
                        .update({ current_uses: (couponData.current_uses || 0) + 1 })
                        .eq("id", couponData.id)
                }
            } catch (e) {
                console.error("[createOrder] Error incrementing coupon usage:", e)
            }
        }

        // 7. If payment method requires online gateway, initiate payment
        // Skip for offline methods: manual (bank transfer/Nequi) and contraentrega (cash on delivery)
        const offlinePaymentMethods = ['manual', 'contraentrega', 'cash_on_delivery']
        if (!offlinePaymentMethods.includes(params.paymentMethod)) {
            // Obtener el dominio personalizado de la organización si existe
            const { data: orgDetails } = await supabase
                .from("organizations")
                .select("custom_domain, slug")
                .eq("id", org.id)
                .single()

            // Construir la URL base según el tipo de dominio
            let baseUrl: string
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://landingchat.co'
            if (orgDetails?.custom_domain) {
                // Dominio personalizado: https://tez.com.co
                baseUrl = `https://${orgDetails.custom_domain}`
            } else if (appUrl.includes('localhost') || appUrl.includes('127.0.0.1')) {
                // Desarrollo local: http://localhost:3000/store/slug
                baseUrl = `${appUrl}/store/${params.slug}`
            } else {
                // Producción: usar subdominio → https://qp.landingchat.co
                baseUrl = `https://${params.slug}.landingchat.co`
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
