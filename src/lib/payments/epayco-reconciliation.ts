import { logger } from "@/lib/logger"
import { applyPaymentStatusToOrder } from "@/lib/payments/payment-confirmation"
import { createPaymentGateway } from "@/lib/payments/factory"
import { createServiceClient } from "@/lib/supabase/server"
import type { TransactionDetails } from "@/lib/payments/types"
import type { PaymentGatewayConfig, PaymentProvider, TransactionStatus } from "@/types/payment"

const log = logger("payments/reconciliation")

interface ReconcileOrderPaymentParams {
    organizationId: string
    orderId: string
    expectedProvider?: PaymentProvider
    providerTransactionId?: string | null
}

interface ReconcileOrderPaymentResult {
    reconciled: boolean
    orderUpdated: boolean
    transactionUpdated: boolean
    sideEffectsRan?: boolean
    provider?: PaymentProvider
    status?: TransactionStatus
    reason?: string
    error?: string
}

interface OrderForReconciliation {
    id: string
    organization_id: string
    order_number?: string | null
    total: number
    payment_status?: string | null
    payment_method?: string | null
    customer_id?: string | null
}

interface StoreTransactionRow {
    id: string
    order_id: string | null
    status: TransactionStatus
    provider_transaction_id: string | null
    provider_reference: string | null
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

function isUsableProviderTransactionId(value: string | null | undefined, orderId: string): value is string {
    return typeof value === "string" && value.trim().length > 0 && value.trim() !== orderId
}

async function getExistingOrderTransaction(params: {
    organizationId: string
    orderId: string
    provider: PaymentProvider
}): Promise<StoreTransactionRow | null> {
    const supabase = createServiceClient()
    const { data } = await supabase
        .from("store_transactions")
        .select("id, order_id, status, provider_transaction_id, provider_reference")
        .eq("organization_id", params.organizationId)
        .eq("provider", params.provider)
        .eq("order_id", params.orderId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

    return data ? data as StoreTransactionRow : null
}

async function getExistingProviderTransaction(params: {
    organizationId: string
    provider: PaymentProvider
    providerTransactionId: string
    providerReference: string
}): Promise<StoreTransactionRow | null> {
    const supabase = createServiceClient()

    const { data: transactionById } = await supabase
        .from("store_transactions")
        .select("id, order_id, status, provider_transaction_id, provider_reference")
        .eq("organization_id", params.organizationId)
        .eq("provider", params.provider)
        .eq("provider_transaction_id", params.providerTransactionId)
        .maybeSingle()

    if (transactionById) return transactionById as StoreTransactionRow

    const { data: transactionByReference } = await supabase
        .from("store_transactions")
        .select("id, order_id, status, provider_transaction_id, provider_reference")
        .eq("organization_id", params.organizationId)
        .eq("provider", params.provider)
        .eq("provider_reference", params.providerReference)
        .maybeSingle()

    return transactionByReference ? transactionByReference as StoreTransactionRow : null
}

async function getProviderTransaction(params: {
    gateway: ReturnType<typeof createPaymentGateway>
    provider: PaymentProvider
    orderId: string
    providerTransactionId?: string | null
}): Promise<TransactionDetails> {
    if (params.provider === "epayco" && isUsableProviderTransactionId(params.providerTransactionId, params.orderId)) {
        return params.gateway.getTransaction(params.providerTransactionId)
    }

    try {
        return await params.gateway.getTransactionByReference(params.orderId)
    } catch (referenceError) {
        if (!isUsableProviderTransactionId(params.providerTransactionId, params.orderId)) {
            throw referenceError
        }

        return params.gateway.getTransaction(params.providerTransactionId)
    }
}

async function findEpaycoProviderTransactionIdFromWebhookLogs(orderId: string): Promise<string | null> {
    const supabase = createServiceClient()
    const payloadFilters = [
        { x_id_invoice: orderId },
        { x_extra1: orderId },
    ]

    for (const payloadFilter of payloadFilters) {
        const { data } = await supabase
            .from("webhook_logs")
            .select("payload")
            .eq("webhook_type", "epayco")
            .contains("payload", payloadFilter)
            .limit(1)
            .maybeSingle()

        if (isRecord(data?.payload)) {
            const providerTransactionId = getOptionalString(data.payload.x_ref_payco)
            if (providerTransactionId) return providerTransactionId
        }
    }

    return null
}

export async function reconcileOrderPayment(
    params: ReconcileOrderPaymentParams
): Promise<ReconcileOrderPaymentResult> {
    const supabase = createServiceClient()

    try {
        const { data: orderData } = await supabase
            .from("orders")
            .select("id, organization_id, order_number, total, payment_status, payment_method, customer_id")
            .eq("id", params.orderId)
            .eq("organization_id", params.organizationId)
            .maybeSingle()

        if (!orderData) {
            return { reconciled: false, orderUpdated: false, transactionUpdated: false, reason: "order_not_found" }
        }

        const order = orderData as OrderForReconciliation
        const provider = order.payment_method === "wompi" || order.payment_method === "epayco"
            ? order.payment_method
            : null

        if (!provider) {
            return { reconciled: false, orderUpdated: false, transactionUpdated: false, reason: "unsupported_provider" }
        }

        if (params.expectedProvider && provider !== params.expectedProvider) {
            return { reconciled: false, orderUpdated: false, transactionUpdated: false, reason: "provider_mismatch", provider }
        }

        if (order.payment_status === "paid") {
            return { reconciled: false, orderUpdated: false, transactionUpdated: false, reason: "order_already_paid", provider }
        }

        const existingOrderTransaction = await getExistingOrderTransaction({
            organizationId: params.organizationId,
            orderId: params.orderId,
            provider,
        })

        if (existingOrderTransaction?.status === "approved") {
            const result = await applyPaymentStatusToOrder({
                supabase,
                organizationId: params.organizationId,
                orderId: params.orderId,
                transactionStatus: "approved",
                source: "payment_reconciliation",
            })

            return {
                reconciled: true,
                orderUpdated: result.orderUpdated,
                transactionUpdated: false,
                sideEffectsRan: result.sideEffectsRan,
                provider,
                status: "approved",
            }
        }

        const { data: configData } = await supabase
            .from("payment_gateway_configs")
            .select("*")
            .eq("organization_id", params.organizationId)
            .eq("provider", provider)
            .eq("is_active", true)
            .maybeSingle()

        if (!configData) {
            return { reconciled: false, orderUpdated: false, transactionUpdated: false, reason: "gateway_not_configured", provider }
        }

        const gateway = createPaymentGateway(configData as PaymentGatewayConfig)
        const explicitProviderTransactionId = isUsableProviderTransactionId(params.providerTransactionId, params.orderId)
            ? params.providerTransactionId
            : null
        const existingProviderTransactionId = isUsableProviderTransactionId(existingOrderTransaction?.provider_transaction_id, params.orderId)
            ? existingOrderTransaction.provider_transaction_id
            : null
        const providerTransactionId = explicitProviderTransactionId ||
            existingProviderTransactionId ||
            (provider === "epayco" ? await findEpaycoProviderTransactionIdFromWebhookLogs(params.orderId) : null)
        const transaction = await getProviderTransaction({
            gateway,
            provider,
            orderId: params.orderId,
            providerTransactionId,
        })
        const expectedAmountInCents = Math.round(order.total * 100)

        if (transaction.reference !== params.orderId) {
            log.error("Provider transaction reference mismatch", {
                orderId: params.orderId,
                provider,
                providerReference: transaction.reference,
            })
            return { reconciled: false, orderUpdated: false, transactionUpdated: false, reason: "reference_mismatch", provider }
        }

        if (normalizeCurrency(transaction.currency) !== "COP") {
            log.error("Provider transaction currency mismatch", {
                orderId: params.orderId,
                provider,
                providerCurrency: transaction.currency,
            })
            return { reconciled: false, orderUpdated: false, transactionUpdated: false, reason: "currency_mismatch", provider }
        }

        if (Math.abs(transaction.amount - expectedAmountInCents) > 1) {
            log.error("Provider transaction amount mismatch", {
                orderId: params.orderId,
                provider,
                providerAmount: transaction.amount,
                expectedAmount: expectedAmountInCents,
            })
            return { reconciled: false, orderUpdated: false, transactionUpdated: false, reason: "amount_mismatch", provider }
        }

        const existingTransaction = await getExistingProviderTransaction({
            organizationId: params.organizationId,
            provider,
            providerTransactionId: transaction.providerTransactionId,
            providerReference: transaction.reference,
        }) || existingOrderTransaction

        let transactionUpdated = false
        const completedAt = transaction.status === "approved"
            ? transaction.completedAt || new Date().toISOString()
            : null

        if (existingTransaction) {
            const shouldUpdateTransaction =
                existingTransaction.status !== transaction.status ||
                existingTransaction.provider_transaction_id !== transaction.providerTransactionId ||
                existingTransaction.provider_reference !== transaction.reference

            if (shouldUpdateTransaction) {
                const { error } = await supabase
                    .from("store_transactions")
                    .update({
                        status: transaction.status,
                        provider_transaction_id: transaction.providerTransactionId,
                        provider_reference: transaction.reference,
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
                    customer_id: order.customer_id || null,
                    amount: transaction.amount,
                    currency: normalizeCurrency(transaction.currency),
                    status: transaction.status,
                    provider,
                    provider_transaction_id: transaction.providerTransactionId,
                    provider_reference: transaction.reference,
                    provider_response: transaction.rawResponse || {},
                    payment_method: transaction.paymentMethod?.toLowerCase() || null,
                    completed_at: completedAt,
                })

            transactionUpdated = !error
        }

        const orderResult = await applyPaymentStatusToOrder({
            supabase,
            organizationId: params.organizationId,
            orderId: params.orderId,
            transactionStatus: transaction.status,
            source: "payment_reconciliation",
        })

        if (!orderResult.success) {
            return {
                reconciled: false,
                orderUpdated: false,
                transactionUpdated,
                provider,
                status: transaction.status,
                reason: orderResult.reason,
                error: orderResult.error,
            }
        }

        return {
            reconciled: true,
            orderUpdated: orderResult.orderUpdated,
            transactionUpdated,
            sideEffectsRan: orderResult.sideEffectsRan,
            provider,
            status: transaction.status,
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error"
        log.warn("Unable to reconcile payment", {
            orderId: params.orderId,
            organizationId: params.organizationId,
            provider: params.expectedProvider,
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

export async function reconcileEpaycoOrderPayment(
    params: Omit<ReconcileOrderPaymentParams, "expectedProvider">
): Promise<ReconcileOrderPaymentResult> {
    return reconcileOrderPayment({
        ...params,
        expectedProvider: "epayco",
    })
}
