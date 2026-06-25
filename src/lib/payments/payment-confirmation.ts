import type { SupabaseClient } from "@supabase/supabase-js"
import { trackServerPurchase } from "@/lib/analytics/meta-conversions-api"
import { decrementOrderStock } from "@/lib/commerce/decrementOrderStock"
import { logger } from "@/lib/logger"
import { getTenantLocale } from "@/lib/i18n/tenant-locale"
import { sendOrderPaidEmail } from "@/lib/notifications/email"
import type { PaymentStatus, TransactionStatus } from "@/types/payment"

/**
 * Construye la URL absoluta del storefront del tenant.
 *
 * Replica la lógica de `createOrder` en `src/app/chat/actions.ts`:
 *   - Si tiene `custom_domain` → `https://{custom_domain}`
 *   - Localhost dev → `{appUrl}/store/{slug}`
 *   - Producción default → `https://{slug}.landingchat.co`
 *
 * Hoy inline porque solo lo usamos aquí. Si en futuro lo necesita otro
 * módulo, mover a `src/lib/utils/store-urls.ts` como helper compartido.
 */
function buildStoreUrl(org: { slug?: string | null; custom_domain?: string | null }): string {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://landingchat.co"
    const slug = org.slug || ""
    if (org.custom_domain) return `https://${org.custom_domain}`
    if (appUrl.includes("localhost") || appUrl.includes("127.0.0.1")) {
        return `${appUrl}/store/${slug}`
    }
    return `https://${slug}.landingchat.co`
}

const log = logger("payments/payment-confirmation")

type OrderStatus = "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded"

interface OrderPaymentState {
    id: string
    organization_id: string
    order_number?: string | null
    status?: string | null
    payment_status?: PaymentStatus | null
    payment_method?: string | null
    total?: number | string | null
    items?: unknown
    customer_info?: unknown
    utm_data?: unknown
    customers?: CustomerRow | CustomerRow[] | null
    /** T1.6 — organization data joined para resolver locale/currency. */
    organizations?: OrganizationRow | OrganizationRow[] | null
}

interface OrganizationRow {
    name?: string | null
    slug?: string | null
    custom_domain?: string | null
    locale?: string | null
    currency_code?: string | null
    country_code?: string | null
}

interface CustomerInfo {
    name?: string | null
    email?: string | null
    phone?: string | null
    city?: string | null
    state?: string | null
}

interface CustomerRow {
    name?: string | null
    email?: string | null
    phone?: string | null
}

interface OrderItemJsonb {
    product_id?: string | null
    product_name?: string | null
    quantity?: number | null
    unit_price?: number | null
}

interface AttributionData {
    fbc?: string
    fbp?: string
    clientIpAddress?: string
    clientUserAgent?: string
}

export interface ApplyPaymentStatusParams {
    supabase: SupabaseClient
    organizationId: string
    orderId: string
    transactionStatus: TransactionStatus
    source: string
}

export interface ApplyPaymentStatusResult {
    success: boolean
    paymentStatus: PaymentStatus
    orderStatus?: OrderStatus
    orderUpdated: boolean
    sideEffectsRan: boolean
    reason?: string
    error?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}

function optionalString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined
}

function mapTransactionStatusToPaymentStatus(status: TransactionStatus): PaymentStatus {
    if (status === "approved") return "paid"
    if (status === "declined" || status === "error") return "failed"
    if (status === "voided") return "refunded"
    return "pending"
}

function mapTransactionStatusToOrderStatus(status: TransactionStatus): OrderStatus | undefined {
    if (status === "approved") return "confirmed"
    if (status === "declined" || status === "error") return "cancelled"
    return undefined
}

function getCustomer(value: CustomerRow | CustomerRow[] | null | undefined): CustomerRow | null {
    if (Array.isArray(value)) return value[0] || null
    return value || null
}

/** Normaliza el join `organizations(...)` (puede venir array o single). */
function getOrganization(value: OrganizationRow | OrganizationRow[] | null | undefined): OrganizationRow | null {
    if (Array.isArray(value)) return value[0] || null
    return value || null
}

function getCustomerInfo(value: unknown): CustomerInfo | null {
    return isRecord(value) ? value as CustomerInfo : null
}

function getOrderItems(value: unknown): OrderItemJsonb[] {
    if (!Array.isArray(value)) return []
    return value.filter((item): item is OrderItemJsonb => isRecord(item))
}

function getAttributionData(value: unknown): AttributionData {
    if (!isRecord(value)) return {}
    return {
        fbc: optionalString(value.fbc) || optionalString(value._fbc),
        fbp: optionalString(value.fbp) || optionalString(value._fbp),
        clientIpAddress: optionalString(value.client_ip) || optionalString(value.client_ip_address),
        clientUserAgent: optionalString(value.client_user_agent) || optionalString(value.user_agent),
    }
}

async function runPaidOrderSideEffects(params: {
    supabase: SupabaseClient
    organizationId: string
    order: OrderPaymentState
}) {
    const itemsJsonb = getOrderItems(params.order.items)
    const customer = getCustomer(params.order.customers)
    const customerInfo = getCustomerInfo(params.order.customer_info)
    const attribution = getAttributionData(params.order.utm_data)
    // T1.6 — resolvemos locale + currency + country desde la org joined.
    // Si por alguna razón no vino la org (fallback ultra-defensivo), usamos
    // el default es-CO/COP/CO de `getTenantLocale`.
    const organization = getOrganization(params.order.organizations)
    const tenantLocale = getTenantLocale({
        locale: organization?.locale,
        currency_code: organization?.currency_code,
        country_code: organization?.country_code,
    })

    const decrementResult = await decrementOrderStock(
        params.supabase,
        params.order.id,
        params.organizationId,
    )

    log.info("Stock decrement result", {
        orderId: params.order.id,
        skipped: decrementResult.skipped,
        reason: decrementResult.reason,
        itemsProcessed: decrementResult.items.length,
        oversaleDetected: decrementResult.items.some((item) => !item.wasSufficient),
    })

    // Comisión de afiliado tenant (si el cliente fue referido). Idempotente, no bloquea.
    const { generateAffiliateCommissionForOrder } = await import("@/lib/affiliates/commissions")
    await generateAffiliateCommissionForOrder({ orderId: params.order.id, organizationId: params.organizationId })

    try {
        const { sendSaleNotification } = await import("@/lib/notifications/whatsapp")
        await sendSaleNotification(
            { organizationId: params.organizationId },
            {
                id: params.order.order_number || params.order.id,
                total: Number(params.order.total || 0),
                customerName: customer?.name || customerInfo?.name || "Cliente",
                items: itemsJsonb
                    .filter((item) => typeof item.quantity === "number" && item.quantity > 0)
                    .map((item) => ({
                        name: item.product_name || "Producto",
                        quantity: item.quantity as number,
                    })),
            }
        )
    } catch (error) {
        log.error("Error sending sale notification", {
            orderId: params.order.id,
            error: error instanceof Error ? error.message : String(error),
        })
    }

    try {
        await trackServerPurchase(
            params.organizationId,
            {
                id: params.order.id,
                orderNumber: params.order.order_number || undefined,
                total: Number(params.order.total || 0),
                currency: tenantLocale.currency,  // T1.6 — USD para Tantor, COP para CO
                items: itemsJsonb
                    .filter((item) => typeof item.product_id === "string" && typeof item.quantity === "number" && item.quantity > 0)
                    .map((item) => ({
                        productId: item.product_id as string,
                        quantity: item.quantity as number,
                        unitPrice: typeof item.unit_price === "number" ? item.unit_price : undefined,
                    })),
                customerEmail: customer?.email || customerInfo?.email || undefined,
                customerPhone: customer?.phone || customerInfo?.phone || undefined,
                customerName: customer?.name || customerInfo?.name || undefined,
                customerCity: customerInfo?.city || undefined,
                customerState: customerInfo?.state || undefined,
                fbc: attribution.fbc,
                fbp: attribution.fbp,
                clientIpAddress: attribution.clientIpAddress,
                clientUserAgent: attribution.clientUserAgent,
            },
            params.supabase,
        )
    } catch (error) {
        log.error("Error sending Meta CAPI event", {
            orderId: params.order.id,
            error: error instanceof Error ? error.message : String(error),
        })
    }

    // T1.6 — Email order-paid al cliente, en el idioma + moneda del tenant.
    // Cubre tanto confirmaciones manuales (dashboard) como webhooks automáticos
    // (Wompi/ePayco). Errores no rompen el flow — ya quedaron stock + status
    // actualizados, el email es complementario.
    try {
        const customerEmail = customer?.email || customerInfo?.email || ""
        if (customerEmail) {
            const organizationName = organization?.name || ""
            const orderUrl = `${buildStoreUrl({
                slug: organization?.slug,
                custom_domain: organization?.custom_domain,
            })}/order/${params.order.id}`
            await sendOrderPaidEmail({
                orderNumber: params.order.order_number || params.order.id,
                customerName: customer?.name || customerInfo?.name || "",
                customerEmail,
                total: Number(params.order.total || 0),
                paymentMethod: typeof params.order.payment_method === "string"
                    ? params.order.payment_method
                    : "manual",
                organizationName,
                orderUrl,
                locale: tenantLocale.locale,
                currency: tenantLocale.currency,
            })
        } else {
            log.info("Skipping order-paid email: customer has no email", {
                orderId: params.order.id,
            })
        }
    } catch (error) {
        log.error("Error sending order-paid email", {
            orderId: params.order.id,
            error: error instanceof Error ? error.message : String(error),
        })
    }

    // Email de nueva venta al DUEÑO — paridad con contraentrega: las ventas ONLINE
    // tambien notifican por email (antes solo WhatsApp, dependiente del webhook +
    // Evolution, por eso se perdian). No bloquea ni rompe el flow.
    try {
        const { data: orgRow } = await params.supabase
            .from("organizations")
            .select("contact_email")
            .eq("id", params.organizationId)
            .single()
        const ownerEmail = typeof orgRow?.contact_email === "string" ? orgRow.contact_email : ""
        if (ownerEmail) {
            const { sendOrderNotificationToOwner } = await import("@/lib/notifications/email")
            await sendOrderNotificationToOwner({
                orderNumber: params.order.order_number || params.order.id,
                customerName: customer?.name || customerInfo?.name || "Cliente",
                customerEmail: customer?.email || customerInfo?.email || "",
                total: Number(params.order.total || 0),
                items: itemsJsonb
                    .filter((item) => typeof item.quantity === "number" && item.quantity > 0)
                    .map((item) => ({
                        name: typeof item.product_name === "string" ? item.product_name : "Producto",
                        quantity: item.quantity as number,
                        price: typeof item.unit_price === "number" ? item.unit_price : 0,
                    })),
                ownerEmail,
                organizationName: organization?.name || "",
                locale: tenantLocale.locale,
                currency: tenantLocale.currency,
            })
        }
    } catch (error) {
        log.error("Error sending owner order email", {
            orderId: params.order.id,
            error: error instanceof Error ? error.message : String(error),
        })
    }
}

export async function applyPaymentStatusToOrder(
    params: ApplyPaymentStatusParams
): Promise<ApplyPaymentStatusResult> {
    const paymentStatus = mapTransactionStatusToPaymentStatus(params.transactionStatus)
    const orderStatus = mapTransactionStatusToOrderStatus(params.transactionStatus)

    const { data: orderData, error: orderError } = await params.supabase
        .from("orders")
        .select(`
            id,
            organization_id,
            order_number,
            status,
            payment_status,
            payment_method,
            total,
            items,
            customer_info,
            utm_data,
            customers(name, email, phone),
            organizations(name, slug, custom_domain, locale, currency_code, country_code)
        `)
        .eq("id", params.orderId)
        .eq("organization_id", params.organizationId)
        .maybeSingle()

    if (orderError || !orderData) {
        return {
            success: false,
            paymentStatus,
            orderStatus,
            orderUpdated: false,
            sideEffectsRan: false,
            reason: "order_not_found",
            error: orderError?.message,
        }
    }

    const order = orderData as OrderPaymentState
    const wasAlreadyPaid = order.payment_status === "paid"
    const shouldUpdateOrder = order.payment_status !== paymentStatus || Boolean(orderStatus && order.status !== orderStatus)
    let orderUpdated = false

    if (shouldUpdateOrder) {
        const { error: updateError } = await params.supabase
            .from("orders")
            .update({
                payment_status: paymentStatus,
                ...(orderStatus && { status: orderStatus }),
                updated_at: new Date().toISOString(),
            })
            .eq("id", params.orderId)
            .eq("organization_id", params.organizationId)

        if (updateError) {
            return {
                success: false,
                paymentStatus,
                orderStatus,
                orderUpdated: false,
                sideEffectsRan: false,
                reason: "order_update_failed",
                error: updateError.message,
            }
        }

        orderUpdated = true
    }

    const shouldRunSideEffects = params.transactionStatus === "approved" && !wasAlreadyPaid

    if (shouldRunSideEffects) {
        await runPaidOrderSideEffects({
            supabase: params.supabase,
            organizationId: params.organizationId,
            order,
        })
    }

    log.info("Payment status applied to order", {
        orderId: params.orderId,
        organizationId: params.organizationId,
        source: params.source,
        transactionStatus: params.transactionStatus,
        paymentStatus,
        orderUpdated,
        sideEffectsRan: shouldRunSideEffects,
    })

    return {
        success: true,
        paymentStatus,
        orderStatus,
        orderUpdated,
        sideEffectsRan: shouldRunSideEffects,
        reason: orderUpdated ? undefined : "no_change",
    }
}
