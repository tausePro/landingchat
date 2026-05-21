"use server"

import { headers } from "next/headers"
import { createServiceClient } from "@/lib/supabase/server"
import { paymentService } from "@/lib/payments/payment-service"
import { sendSaleNotification } from "@/lib/notifications/whatsapp"
import { sendOrderConfirmationEmail, sendOrderNotificationToOwner } from "@/lib/notifications/email"
import { getTenantLocale } from "@/lib/i18n/tenant-locale"
import { calculateTaxForItems, buildProductTaxMap, type OrgTaxSettings } from "@/lib/utils/tax"
import { getPhoneVariants, normalizePhone } from "@/lib/utils/phone"
import { decrementOrderStock } from "@/lib/commerce/decrementOrderStock"
import {
    appendStorefrontAccessParam,
    createStorefrontOrderAccessToken,
    getStorefrontCustomerSession,
    setStorefrontCustomerSession,
} from "@/lib/storefrontAccess"

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
        product_id?: string
        variant_id?: string | null
        variant_title?: string | null
        name: string
        product_name?: string
        price: number
        unit_price?: number
        compare_at_price?: number | null
        quantity: number
        image?: string | null
        image_url?: string | null // Support both property names (cart store uses image_url)
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
        captured_at?: string
        utm_source?: string
        utm_medium?: string
        utm_campaign?: string
        utm_content?: string
        utm_term?: string
        utm_id?: string
        utm_source_platform?: string
        campaign_id?: string
        adset_id?: string
        ad_id?: string
        fbclid?: string
        fbc?: string
        fbp?: string
        referrer?: string
        entry_point?: "proactive_nudge"
        proactive_nudge_id?: string
        proactive_nudge_product_id?: string
        proactive_nudge_product_name?: string
        proactive_nudge_destination?: "web_chat" | "whatsapp_fallback"
    }
}

/**
 * Calculate order totals including tax and fees
 * This ensures frontend and backend use the SAME calculation logic
 */
export async function calculateOrderSummary(params: {
    slug: string,
    items: Array<{ id: string, product_id?: string, price: number, quantity: number }>,
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
        const productIds = params.items.map(item => item.product_id || item.id)
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

function transformCartItemsToOrderItems(cartItems: Array<{
    id: string
    product_id?: string
    variant_id?: string | null
    variant_title?: string | null
    name: string
    product_name?: string
    price: number
    unit_price?: number
    compare_at_price?: number | null
    quantity: number
    image?: string | null
    image_url?: string | null
}>) {
    return cartItems.map(item => ({
        product_id: item.product_id || item.id,
        product_name: item.product_name || item.name,
        quantity: item.quantity,
        unit_price: item.unit_price || item.price,
        total_price: (item.unit_price || item.price) * item.quantity,
        variant_info: item.variant_id || item.variant_title
            ? {
                variant_id: item.variant_id ?? null,
                variant_title: item.variant_title ?? null,
                compare_at_price: item.compare_at_price ?? null,
            }
            : null,
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
            .select("provider, is_active, is_test_mode, config")
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
                description: coupon.description || `Descuento de $${discountAmount.toLocaleString()}`,
                appliesTo: coupon.applies_to || 'all',
                targetIds: coupon.target_ids || null
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

        const normalizedEmail = params.customerInfo.email.trim().toLowerCase()
        const canonicalPhone = normalizePhone(params.customerInfo.phone)
        const phoneVariants = getPhoneVariants(params.customerInfo.phone)
        const storefrontSession = await getStorefrontCustomerSession(params.slug)
        let storefrontCustomerId: string | null = null
        type ExistingCustomer = {
            id: string
            metadata: Record<string, unknown> | null
            email: string | null
            phone: string | null
        }

        if (storefrontSession && storefrontSession.organizationId === org.id) {
            storefrontCustomerId = storefrontSession.customerId
        }

        let sessionCustomer: ExistingCustomer | null = null
        let phoneCustomer: ExistingCustomer | null = null
        let emailCustomer: ExistingCustomer | null = null

        if (storefrontCustomerId) {
            const { data: sessionCustomerData } = await supabase
                .from("customers")
                .select("id, metadata, email, phone")
                .eq("id", storefrontCustomerId)
                .eq("organization_id", org.id)
                .maybeSingle()

            if (sessionCustomerData) {
                sessionCustomer = sessionCustomerData
            }
        }

        if (normalizedEmail) {
            const { data: emailCustomerData } = await supabase
                .from("customers")
                .select("id, metadata, email, phone")
                .eq("organization_id", org.id)
                .eq("email", normalizedEmail)
                .order("created_at", { ascending: true })
                .limit(1)
                .maybeSingle()

            if (emailCustomerData) {
                emailCustomer = emailCustomerData
            }
        }

        const { data: phoneCustomers } = await supabase
            .from("customers")
            .select("id, metadata, email, phone")
            .eq("organization_id", org.id)
            .in("phone", phoneVariants)
            .order("created_at", { ascending: true })
            .limit(1)

        if (phoneCustomers?.[0]) {
            phoneCustomer = phoneCustomers[0]
        }

        const matchedCustomer = phoneCustomer ?? sessionCustomer ?? emailCustomer
        const conflictingEmailCustomer = emailCustomer && matchedCustomer && emailCustomer.id !== matchedCustomer.id
            ? emailCustomer
            : null

        const customerPayload: Record<string, unknown> = {
            organization_id: org.id,
            phone: canonicalPhone,
            full_name: params.customerInfo.name.trim(),
            document_type: params.customerInfo.document_type,
            document_number: params.customerInfo.document_number,
            person_type: params.customerInfo.person_type,
            business_name: params.customerInfo.business_name,
            metadata: {
                ...(matchedCustomer?.metadata || {}),
                address: params.customerInfo.address,
                city: params.customerInfo.city,
                state: params.customerInfo.state,
            }
        }

        if (normalizedEmail && !conflictingEmailCustomer) {
            customerPayload.email = normalizedEmail
        }

        let customer: { id: string } | null = matchedCustomer ? { id: matchedCustomer.id } : null

        if (matchedCustomer) {
            const { data: updatedCustomer, error: customerUpdateError } = await supabase
                .from("customers")
                .update(customerPayload)
                .eq("id", matchedCustomer.id)
                .eq("organization_id", org.id)
                .select("id")
                .single()

            if (customerUpdateError) {
                console.error("[createOrder] Error updating customer:", customerUpdateError)
            } else {
                customer = updatedCustomer
            }
        } else {
            const { data: createdCustomer, error: customerCreateError } = await supabase
                .from("customers")
                .insert(customerPayload)
                .select("id")
                .single()

            if (customerCreateError) {
                console.error("[createOrder] Error creating customer:", customerCreateError)

                const { data: recoveredPhoneCustomers } = await supabase
                    .from("customers")
                    .select("id")
                    .eq("organization_id", org.id)
                    .in("phone", phoneVariants)
                    .order("created_at", { ascending: true })
                    .limit(1)

                if (recoveredPhoneCustomers?.[0]) {
                    customer = recoveredPhoneCustomers[0]
                } else if (normalizedEmail) {
                    const { data: recoveredEmailCustomer } = await supabase
                        .from("customers")
                        .select("id")
                        .eq("organization_id", org.id)
                        .eq("email", normalizedEmail)
                        .order("created_at", { ascending: true })
                        .limit(1)
                        .maybeSingle()

                    if (recoveredEmailCustomer) {
                        customer = recoveredEmailCustomer
                    }
                }
            } else {
                customer = createdCustomer
            }
        }

        const resolvedCustomerId = customer?.id ?? null

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

        // Capturar IP y User-Agent reales del comprador para Meta CAPI EMQ.
        // Se persiste server-side porque el cliente puede falsificarlos.
        // Ver docs-private/META_PURCHASE_EMQ_FIX_2026-05-05.md
        const requestHeaders = await headers()
        const forwardedFor = requestHeaders.get("x-forwarded-for")
        const buyerIp =
            forwardedFor?.split(",")[0]?.trim() ||
            requestHeaders.get("x-real-ip") ||
            requestHeaders.get("cf-connecting-ip") ||
            undefined
        const buyerUserAgent = requestHeaders.get("user-agent") || undefined

        const { data: order, error: orderError } = await supabase
            .from("orders")
            .insert({
                organization_id: org.id,
                customer_id: resolvedCustomerId,
                order_number: orderNumber,
                customer_info: {
                    ...params.customerInfo,
                    name: params.customerInfo.name.trim(),
                    email: normalizedEmail || null,
                    phone: canonicalPhone,
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
                utm_data: {
                    ...(params.utmData || {}),
                    // IP/UA reales del comprador para CAPI Purchase server-side
                    ...(buyerIp ? { client_ip: buyerIp } : {}),
                    ...(buyerUserAgent ? { client_user_agent: buyerUserAgent } : {}),
                },
            })
            .select()
            .single()

        if (orderError) {
            console.error("[createOrder] Error creating order:", orderError)
            return { success: false, error: "Error al crear la orden" }
        }

        if (resolvedCustomerId) {
            await setStorefrontCustomerSession({
                slug: params.slug,
                organizationId: org.id,
                customerId: resolvedCustomerId,
            })
        }

        const orderAccessToken = createStorefrontOrderAccessToken({
            slug: params.slug,
            organizationId: org.id,
            orderId: order.id,
            customerId: order.customer_id || resolvedCustomerId,
        })

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
            const provider = params.paymentMethod as "wompi" | "epayco"
            const amountInCents = Math.round(finalTotal * 100)

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
                amount: Math.round(finalTotal * 100), // Use backend-calculated total for consistency
                currency: 'COP',
                customerEmail: params.customerInfo.email,
                customerName: params.customerInfo.name,
                customerDocument: params.customerInfo.document_number,
                customerDocumentType: params.customerInfo.document_type,
                customerPhone: params.customerInfo.phone,
                returnUrl: appendStorefrontAccessParam(`${baseUrl}/order/${order.id}`, orderAccessToken),
                paymentMethod: provider
            })

            if (!paymentResult.success) {
                // Payment initiation failed, but order was created
                return {
                    success: false,
                    error: paymentResult.error || "Error al iniciar el pago",
                    order
                }
            }

            const { error: transactionError } = await supabase
                .from("store_transactions")
                .insert({
                    organization_id: org.id,
                    order_id: order.id,
                    customer_id: order.customer_id || resolvedCustomerId,
                    amount: amountInCents,
                    currency: "COP",
                    status: "pending",
                    provider,
                    provider_transaction_id: null,
                    provider_reference: order.id,
                    provider_response: {
                        paymentUrl: paymentResult.paymentUrl,
                    },
                    payment_method: null,
                })

            if (transactionError) {
                console.error("[createOrder] Error creating pending store transaction:", transactionError)
                return {
                    success: false,
                    error: "Orden creada, pero no pudimos preparar la transacción de pago",
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
        // Fase 0.4 (Bug C): los pagos offline (manual, contraentrega, cash_on_delivery)
        // nunca pasan por webhook que decremente stock. Opción A aprobada por el
        // usuario: decrementar inmediatamente al crear la orden. Cancelaciones
        // futuras tendrán que usar `restore_product_stock` (RPC ya creada).
        // La util `decrementOrderStock` loguea internamente cada item procesado
        // y el resumen de idempotencia — no duplicamos logs aquí.
        try {
            await decrementOrderStock(supabase, order.id, org.id)
        } catch (stockErr) {
            // No fallamos la orden si el decrement falla: la orden ya existe,
            // hay que poder notificar al cliente. El warning queda en logs para
            // reconciliar manualmente.
            console.error("[createOrder] Failed to decrement stock for offline payment", stockErr)
        }

        // Send notifications (Fire and Forget)
        try {
            // Get organization details for notifications.
            // T1.3i — incluimos `locale` y `currency_code` para que los emails
            // se rendericen en el idioma y moneda del tenant. Tantor's House
            // recibe emails en inglés con precios en USD; tenants legacy quedan
            // en es-CO/COP por default vía `getTenantLocale()`.
            const { data: orgDetails } = await supabase
                .from("organizations")
                .select("name, contact_email, custom_domain, locale, currency_code")
                .eq("id", org.id)
                .single()

            const organizationName = orgDetails?.name || "Tu Tienda"
            const ownerEmail = orgDetails?.contact_email
            const tenantLocale = getTenantLocale(orgDetails)
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://landingchat.co'

            let storeUrl: string
            if (orgDetails?.custom_domain) {
                storeUrl = `https://${orgDetails.custom_domain}`
            } else if (appUrl.includes('localhost') || appUrl.includes('127.0.0.1')) {
                storeUrl = `${appUrl}/store/${params.slug}`
            } else {
                storeUrl = `https://${params.slug}.landingchat.co`
            }

            const orderUrl = appendStorefrontAccessParam(`${storeUrl}/order/${order.id}`, orderAccessToken)

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
                storeUrl,
                orderUrl,
                locale: tenantLocale.locale,
                currency: tenantLocale.currency,
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
                    organizationName: organizationName,
                    locale: tenantLocale.locale,
                    currency: tenantLocale.currency,
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
