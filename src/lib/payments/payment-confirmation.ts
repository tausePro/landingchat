import type { SupabaseClient } from "@supabase/supabase-js"
import { trackServerPurchase } from "@/lib/analytics/meta-conversions-api"
import { decrementOrderStock } from "@/lib/commerce/decrementOrderStock"
import { logger } from "@/lib/logger"
import type { PaymentStatus, TransactionStatus } from "@/types/payment"

const log = logger("payments/payment-confirmation")

type OrderStatus = "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded"

interface OrderPaymentState {
    id: string
    organization_id: string
    order_number?: string | null
    status?: string | null
    payment_status?: PaymentStatus | null
    total?: number | string | null
    items?: unknown
    customer_info?: unknown
    utm_data?: unknown
    customers?: CustomerRow | CustomerRow[] | null
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
                currency: "COP",
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
            total,
            items,
            customer_info,
            utm_data,
            customers(name, email, phone)
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
