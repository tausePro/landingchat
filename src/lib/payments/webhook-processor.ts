/**
 * Procesamiento unificado de webhooks de pagos.
 *
 * Toma un `WebhookEvent` ya normalizado por el gateway específico
 * y se encarga de:
 *   1. Idempotencia (busca store_transaction existente por providerTransactionId)
 *   2. Reconciliación por referencia (orderId) cuando llega webhook antes que se grabe la transacción
 *   3. Crear/actualizar `store_transactions`
 *   4. Aplicar el estado a la orden vía `applyPaymentStatusToOrder`
 *   5. Loggear en `webhook_logs`
 *
 * Cada gateway específico (Wompi, ePayco, Bold, Addi) provee `parseWebhook`
 * que devuelve un `WebhookEvent`. Este módulo encapsula el resto.
 */

import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { logger } from "@/lib/logger"
import { applyPaymentStatusToOrder } from "@/lib/payments/payment-confirmation"
import type { TransactionStatus, PaymentProvider } from "@/types/payment"
import type { WebhookEvent } from "./types"

const log = logger("payments/webhook-processor")

interface ProcessWebhookEventParams {
    supabase: SupabaseClient
    provider: PaymentProvider
    organizationId: string
    event: WebhookEvent
    rawPayload: unknown
    startedAt: number
}

interface ProcessOrderUpdateParams {
    supabase: SupabaseClient
    orderId: string
    status: TransactionStatus
    organizationId: string
    provider: PaymentProvider
}

/**
 * Aplica el estado del pago a la orden con logging consistente.
 */
async function processOrderUpdate(params: ProcessOrderUpdateParams) {
    const { supabase, orderId, status, organizationId, provider } = params
    const result = await applyPaymentStatusToOrder({
        supabase,
        organizationId,
        orderId,
        transactionStatus: status,
        source: `webhook_${provider}`,
    })

    if (!result.success) {
        log.error("Failed to apply payment status to order", {
            provider,
            orderId,
            organizationId,
            status,
            reason: result.reason,
            error: result.error,
        })
    }

    return result
}

/**
 * Valida que el monto y la moneda del webhook coincidan con la orden.
 * Por compatibilidad con el handler legacy, esta validación se aplica
 * solo a ePayco. Si en el futuro se quiere extender a todos los providers,
 * remover el guard en `processWebhookEvent`.
 */
async function validateOrderPaymentData(
    supabase: SupabaseClient,
    orderId: string,
    organizationId: string,
    event: WebhookEvent,
): Promise<boolean> {
    const { data: order, error } = await supabase
        .from("orders")
        .select("id, total")
        .eq("id", orderId)
        .eq("organization_id", organizationId)
        .single()

    if (error || !order) {
        log.error("Order not found for payment validation", { orderId, organizationId, error: error?.message })
        return false
    }

    const expectedAmount = Math.round(Number(order.total) * 100)
    const paidAmount = event.amount
    const currency = event.currency.trim().toUpperCase()
    const isValid = Number.isFinite(paidAmount) && expectedAmount === paidAmount && currency === "COP"

    if (!isValid) {
        log.error("Invalid payment data", {
            provider: event.provider,
            orderId,
            organizationId,
            expectedAmount,
            paidAmount,
            currency,
        })
    }

    return isValid
}

/** Indica si este provider requiere validar monto/moneda contra la orden. */
function requiresAmountValidation(provider: PaymentProvider): boolean {
    return provider === "epayco"
}

/**
 * Inserta un registro en `webhook_logs`.
 */
export async function logWebhook(
    supabase: SupabaseClient,
    webhookType: string,
    processingResult: string,
    payload: unknown,
    response: unknown,
) {
    try {
        await supabase.from("webhook_logs").insert({
            webhook_type: webhookType,
            event_type: "transaction.updated",
            processing_result: processingResult,
            payload: payload || {},
            headers: response || {},
        })
    } catch (error) {
        log.error("Error logging webhook", {
            webhookType,
            message: error instanceof Error ? error.message : "Unknown error",
        })
    }
}

/**
 * Procesa un webhook ya parseado y validado, persistiéndolo y aplicándolo
 * a la orden correspondiente.
 *
 * Devuelve la respuesta HTTP que el handler debe retornar al provider.
 */
export async function processWebhookEvent(params: ProcessWebhookEventParams): Promise<NextResponse> {
    const { supabase, provider, organizationId, event, rawPayload, startedAt } = params

    try {
        // 1. Idempotencia: buscar transacción existente por provider_transaction_id
        const { data: existingTx } = await supabase
            .from("store_transactions")
            .select("id, order_id, status")
            .eq("provider_transaction_id", event.transactionId)
            .eq("organization_id", organizationId)
            .single()

        if (existingTx) {
            // Si el estado ya es el mismo, no replicamos efectos
            if (existingTx.status === event.status) {
                log.info("Duplicate webhook, no action taken", {
                    provider,
                    transactionId: event.transactionId,
                    storeTransactionId: existingTx.id,
                    status: event.status,
                })
                await logWebhook(supabase, provider, "duplicate", rawPayload, {
                    message: "Duplicate webhook",
                    transactionId: existingTx.id,
                })
                return NextResponse.json({ received: true, duplicate: true })
            }

            // Validar amount/currency contra la orden si el provider lo requiere
            if (requiresAmountValidation(provider) && existingTx.order_id) {
                const isValid = await validateOrderPaymentData(supabase, existingTx.order_id, organizationId, event)
                if (!isValid) {
                    await logWebhook(supabase, provider, "error", rawPayload, {
                        error: "Payment amount or currency mismatch",
                        orderId: existingTx.order_id,
                    })
                    return NextResponse.json({ error: "Payment data mismatch" }, { status: 400 })
                }
            }

            // Actualizar transacción
            await supabase
                .from("store_transactions")
                .update({
                    status: event.status,
                    provider_response: rawPayload as Record<string, unknown>,
                    completed_at: event.status === "approved" ? new Date().toISOString() : null,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", existingTx.id)

            if (existingTx.order_id) {
                await processOrderUpdate({
                    supabase,
                    orderId: existingTx.order_id,
                    status: event.status,
                    organizationId,
                    provider,
                })
            }

            await logWebhook(supabase, provider, "success", rawPayload, {
                transactionId: existingTx.id,
                orderId: existingTx.order_id,
                status: event.status,
                processingTime: Date.now() - startedAt,
            })
            return NextResponse.json({ received: true })
        }

        // 2. Buscar por provider_reference (cuando webhook llega antes que se grabe la tx)
        const { data: txByRef } = await supabase
            .from("store_transactions")
            .select("id, order_id, status")
            .eq("provider_reference", event.reference)
            .eq("organization_id", organizationId)
            .single()

        if (txByRef) {
            const shouldReplaySideEffects = txByRef.status !== event.status

            if (requiresAmountValidation(provider) && txByRef.order_id) {
                const isValid = await validateOrderPaymentData(supabase, txByRef.order_id, organizationId, event)
                if (!isValid) {
                    await logWebhook(supabase, provider, "error", rawPayload, {
                        error: "Payment amount or currency mismatch",
                        orderId: txByRef.order_id,
                    })
                    return NextResponse.json({ error: "Payment data mismatch" }, { status: 400 })
                }
            }

            await supabase
                .from("store_transactions")
                .update({
                    status: event.status,
                    provider_transaction_id: event.transactionId,
                    provider_response: rawPayload as Record<string, unknown>,
                    completed_at: event.status === "approved" ? new Date().toISOString() : null,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", txByRef.id)

            if (txByRef.order_id && shouldReplaySideEffects) {
                await processOrderUpdate({
                    supabase,
                    orderId: txByRef.order_id,
                    status: event.status,
                    organizationId,
                    provider,
                })
            }

            await logWebhook(supabase, provider, "success", rawPayload, {
                transactionId: txByRef.id,
                orderId: txByRef.order_id,
                status: event.status,
                replayed: shouldReplaySideEffects,
                processingTime: Date.now() - startedAt,
            })
            return NextResponse.json({ received: true })
        }

        // 3. No hay tx previa: buscar la orden por reference (orderId)
        const { data: order } = await supabase
            .from("orders")
            .select("id, organization_id")
            .eq("id", event.reference)
            .eq("organization_id", organizationId)
            .single()

        if (requiresAmountValidation(provider) && order) {
            const isValid = await validateOrderPaymentData(supabase, order.id, organizationId, event)
            if (!isValid) {
                await logWebhook(supabase, provider, "error", rawPayload, {
                    error: "Payment amount or currency mismatch",
                    orderId: order.id,
                })
                return NextResponse.json({ error: "Payment data mismatch" }, { status: 400 })
            }
        }

        const { data: newTx } = await supabase
            .from("store_transactions")
            .insert({
                organization_id: organizationId,
                order_id: order?.id || null,
                amount: event.amount,
                currency: event.currency.trim().toUpperCase(),
                status: event.status,
                provider,
                provider_transaction_id: event.transactionId,
                provider_reference: event.reference,
                provider_response: rawPayload as Record<string, unknown>,
                payment_method: event.paymentMethod?.toLowerCase() || null,
                completed_at: event.status === "approved" ? new Date().toISOString() : null,
            })
            .select("id")
            .single()

        if (order) {
            await processOrderUpdate({
                supabase,
                orderId: order.id,
                status: event.status,
                organizationId,
                provider,
            })
        }

        await logWebhook(supabase, provider, "success", rawPayload, {
            transactionId: newTx?.id,
            orderId: order?.id,
            status: event.status,
            note: order ? "New transaction created and order updated" : "New transaction created (order not found)",
            processingTime: Date.now() - startedAt,
        })

        return NextResponse.json({ received: true })
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error"
        log.error("Unhandled webhook processing error", { provider, error: message })
        await logWebhook(supabase, provider, "error", rawPayload, {
            error: message,
            processingTime: Date.now() - startedAt,
        })
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
