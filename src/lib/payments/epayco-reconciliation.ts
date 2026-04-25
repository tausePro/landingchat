import { decrementOrderStock } from "@/lib/commerce/decrementOrderStock"
import { logger } from "@/lib/logger"
import { createPaymentGateway } from "@/lib/payments/factory"
import { createServiceClient } from "@/lib/supabase/server"
import type { PaymentGatewayConfig, PaymentStatus, TransactionStatus } from "@/types/payment"

const log = logger("payments/epayco-reconciliation")

interface ReconcileEpaycoOrderPaymentParams {
    organizationId: string
    orderId: string
}

interface ReconcileEpaycoOrderPaymentResult {
    reconciled: boolean
    orderUpdated: boolean
    transactionUpdated: boolean
    status?: TransactionStatus
    reason?: string
    error?: string
}

interface OrderForReconciliation {
    id: string
    organization_id: string
    order_number?: string | null
    total: number
    status?: string | null
    payment_status?: PaymentStatus | null
    payment_method?: string | null
}

interface StoreTransactionRow {
    id: string
    order_id: string | null
    status: TransactionStatus
}

interface OrderItemJsonb {
    product_id?: string | null
    product_name?: string | null
    quantity?: number | null
}

interface CustomerInfoJsonb {
    name?: string | null
    email?: string | null
    phone?: string | null
    city?: string | null
}

interface CustomerRow {
    name?: string | null
    email?: string | null
    phone?: string | null
}

interface OrderForPostPayment {
    id: string
    order_number?: string | null
    total: number
    items: unknown
    customer_info: unknown
    utm_data: unknown
    customers: CustomerRow | null
}

interface AttributionData {
    fbc?: string
    fbp?: string
}

function mapStatusToPaymentStatus(status: TransactionStatus): PaymentStatus {
    if (status === "approved") return "paid"
    if (status === "declined" || status === "error") return "failed"
    if (status === "voided") return "refunded"
    return "pending"
}

function mapStatusToOrderStatus(status: TransactionStatus): string | undefined {
    if (status === "approved") return "confirmed"
    if (status === "declined" || status === "error") return "cancelled"
    return undefined
}

function normalizeCurrency(value: string | null | undefined) {
    return (value || "").trim().toUpperCase()
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getOptionalString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined
}

function getAttributionData(value: unknown): AttributionData {
    if (!isRecord(value)) return {}

    return {
        fbc: getOptionalString(value.fbc) || getOptionalString(value._fbc),
        fbp: getOptionalString(value.fbp) || getOptionalString(value._fbp),
    }
}

function getOrderItems(value: unknown): OrderItemJsonb[] {
    if (!Array.isArray(value)) return []
    return value.filter((item): item is OrderItemJsonb => isRecord(item))
}

async function getExistingTransaction(params: {
    organizationId: string
    providerTransactionId?: string
    providerReference: string
}): Promise<StoreTransactionRow | null> {
    const supabase = createServiceClient()

    if (params.providerTransactionId) {
        const { data } = await supabase
            .from("store_transactions")
            .select("id, order_id, status")
            .eq("organization_id", params.organizationId)
            .eq("provider", "epayco")
            .eq("provider_transaction_id", params.providerTransactionId)
            .maybeSingle()

        if (data) return data as StoreTransactionRow
    }

    const { data } = await supabase
        .from("store_transactions")
        .select("id, order_id, status")
        .eq("organization_id", params.organizationId)
        .eq("provider", "epayco")
        .eq("provider_reference", params.providerReference)
        .maybeSingle()

    return data ? data as StoreTransactionRow : null
}

async function applyOrderPaymentStatus(params: {
    organizationId: string
    order: OrderForReconciliation
    status: TransactionStatus
}): Promise<boolean> {
    const paymentStatus = mapStatusToPaymentStatus(params.status)
    const orderStatus = mapStatusToOrderStatus(params.status)

    if (params.status === "pending") return false
    if (params.order.payment_status === paymentStatus && (!orderStatus || params.order.status === orderStatus)) {
        return false
    }

    const supabase = createServiceClient()
    const { error } = await supabase
        .from("orders")
        .update({
            payment_status: paymentStatus,
            ...(orderStatus && { status: orderStatus }),
            updated_at: new Date().toISOString(),
        })
        .eq("id", params.order.id)
        .eq("organization_id", params.organizationId)

    if (error) {
        log.error("Failed to update order payment status", {
            orderId: params.order.id,
            organizationId: params.organizationId,
            status: params.status,
            error: error.message,
        })
        return false
    }

    return true
}

async function runApprovedOrderSideEffects(params: {
    organizationId: string
    orderId: string
}): Promise<void> {
    const supabase = createServiceClient()
    const { data: order } = await supabase
        .from("orders")
        .select(`
            id,
            order_number,
            total,
            items,
            customer_info,
            utm_data,
            customers(name, email, phone)
        `)
        .eq("id", params.orderId)
        .eq("organization_id", params.organizationId)
        .single()

    if (!order) {
        log.error("Order not found for approved payment side effects", params)
        return
    }

    const typedOrder = order as OrderForPostPayment
    const customer = typedOrder.customers
    const customerInfo = isRecord(typedOrder.customer_info) ? typedOrder.customer_info as CustomerInfoJsonb : null
    const itemsJsonb = getOrderItems(typedOrder.items)
    const attribution = getAttributionData(typedOrder.utm_data)

    const decrementResult = await decrementOrderStock(supabase, params.orderId, params.organizationId)
    log.info("Stock decrement result", {
        orderId: params.orderId,
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
                id: typedOrder.order_number || typedOrder.id,
                total: typedOrder.total,
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
            orderId: params.orderId,
            error: error instanceof Error ? error.message : String(error),
        })
    }

    try {
        const { trackServerPurchase } = await import("@/lib/analytics/meta-conversions-api")
        await trackServerPurchase(
            params.organizationId,
            {
                id: typedOrder.id,
                orderNumber: typedOrder.order_number || undefined,
                total: typedOrder.total,
                currency: "COP",
                items: itemsJsonb
                    .filter((item) => typeof item.product_id === "string" && typeof item.quantity === "number" && item.quantity > 0)
                    .map((item) => ({
                        productId: item.product_id as string,
                        quantity: item.quantity as number,
                    })),
                customerEmail: customer?.email || customerInfo?.email || undefined,
                customerPhone: customer?.phone || customerInfo?.phone || undefined,
                customerName: customer?.name || customerInfo?.name || undefined,
                customerCity: customerInfo?.city || undefined,
                fbc: attribution.fbc,
                fbp: attribution.fbp,
            },
            supabase
        )
    } catch (error) {
        log.error("Error sending Meta CAPI event", {
            orderId: params.orderId,
            error: error instanceof Error ? error.message : String(error),
        })
    }
}

export async function reconcileEpaycoOrderPayment(
    params: ReconcileEpaycoOrderPaymentParams
): Promise<ReconcileEpaycoOrderPaymentResult> {
    const supabase = createServiceClient()

    try {
        const { data: orderData } = await supabase
            .from("orders")
            .select("id, organization_id, order_number, total, status, payment_status, payment_method")
            .eq("id", params.orderId)
            .eq("organization_id", params.organizationId)
            .maybeSingle()

        if (!orderData) {
            return { reconciled: false, orderUpdated: false, transactionUpdated: false, reason: "order_not_found" }
        }

        const order = orderData as OrderForReconciliation
        if (order.payment_method !== "epayco") {
            return { reconciled: false, orderUpdated: false, transactionUpdated: false, reason: "not_epayco_order" }
        }

        if (order.payment_status === "paid") {
            return { reconciled: false, orderUpdated: false, transactionUpdated: false, reason: "order_already_paid" }
        }

        const { data: configData } = await supabase
            .from("payment_gateway_configs")
            .select("*")
            .eq("organization_id", params.organizationId)
            .eq("provider", "epayco")
            .eq("is_active", true)
            .maybeSingle()

        if (!configData) {
            return { reconciled: false, orderUpdated: false, transactionUpdated: false, reason: "gateway_not_configured" }
        }

        const gateway = createPaymentGateway(configData as PaymentGatewayConfig)
        const transaction = await gateway.getTransactionByReference(params.orderId)
        const expectedAmountInCents = Math.round(order.total * 100)

        if (transaction.reference !== params.orderId) {
            log.error("Provider transaction reference mismatch", {
                orderId: params.orderId,
                providerReference: transaction.reference,
            })
            return { reconciled: false, orderUpdated: false, transactionUpdated: false, reason: "reference_mismatch" }
        }

        if (normalizeCurrency(transaction.currency) !== "COP") {
            log.error("Provider transaction currency mismatch", {
                orderId: params.orderId,
                providerCurrency: transaction.currency,
            })
            return { reconciled: false, orderUpdated: false, transactionUpdated: false, reason: "currency_mismatch" }
        }

        if (Math.abs(transaction.amount - expectedAmountInCents) > 1) {
            log.error("Provider transaction amount mismatch", {
                orderId: params.orderId,
                providerAmount: transaction.amount,
                expectedAmount: expectedAmountInCents,
            })
            return { reconciled: false, orderUpdated: false, transactionUpdated: false, reason: "amount_mismatch" }
        }

        const existingTransaction = await getExistingTransaction({
            organizationId: params.organizationId,
            providerTransactionId: transaction.providerTransactionId,
            providerReference: transaction.reference,
        })

        let transactionUpdated = false
        const completedAt = transaction.status === "approved"
            ? transaction.completedAt || new Date().toISOString()
            : null

        if (existingTransaction) {
            if (existingTransaction.status !== transaction.status) {
                const { error } = await supabase
                    .from("store_transactions")
                    .update({
                        status: transaction.status,
                        provider_transaction_id: transaction.providerTransactionId,
                        provider_response: transaction.rawResponse || {},
                        payment_method: transaction.paymentMethod?.toLowerCase() || null,
                        completed_at: completedAt,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", existingTransaction.id)

                transactionUpdated = !error
            }
        } else {
            const { error } = await supabase
                .from("store_transactions")
                .insert({
                    organization_id: params.organizationId,
                    order_id: params.orderId,
                    amount: transaction.amount,
                    currency: normalizeCurrency(transaction.currency),
                    status: transaction.status,
                    provider: "epayco",
                    provider_transaction_id: transaction.providerTransactionId,
                    provider_reference: transaction.reference,
                    provider_response: transaction.rawResponse || {},
                    payment_method: transaction.paymentMethod?.toLowerCase() || null,
                    completed_at: completedAt,
                })

            transactionUpdated = !error
        }

        const orderUpdated = await applyOrderPaymentStatus({
            organizationId: params.organizationId,
            order,
            status: transaction.status,
        })

        const shouldRunApprovedSideEffects = transaction.status === "approved" && (
            !existingTransaction ||
            existingTransaction.status !== "approved" ||
            orderUpdated
        )

        if (shouldRunApprovedSideEffects) {
            await runApprovedOrderSideEffects({
                organizationId: params.organizationId,
                orderId: params.orderId,
            })
        }

        return {
            reconciled: true,
            orderUpdated,
            transactionUpdated,
            status: transaction.status,
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error"
        log.warn("Unable to reconcile ePayco payment", {
            orderId: params.orderId,
            organizationId: params.organizationId,
            error: message,
        })
        return {
            reconciled: false,
            orderUpdated: false,
            transactionUpdated: false,
            reason: "provider_lookup_failed",
            error: message,
        }
    }
}
