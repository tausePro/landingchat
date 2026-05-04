/**
 * Webhook handler para notificaciones de Wompi
 * Recibe eventos de transacciones y actualiza el estado de órdenes
 */

import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { decrypt } from "@/lib/utils/encryption"
import { WompiGateway } from "@/lib/payments/wompi-gateway"
import { logger } from "@/lib/logger"
import { applyPaymentStatusToOrder } from "@/lib/payments/payment-confirmation"
import type { TransactionStatus } from "@/types/payment"

const log = logger("webhooks/payments/wompi")

interface WompiWebhookPayload {
    event: string
    data: {
        transaction: {
            id: string
            reference: string
            status: string
            amount_in_cents: number
            currency: string
            payment_method_type: string
            created_at: string
            finalized_at?: string
        }
    }
    signature: {
        checksum: string
        properties: string[]
    }
    timestamp: number
}

export async function POST(request: Request) {
    const supabase = createServiceClient()
    const startTime = Date.now()
    
    try {
        const url = new URL(request.url)
        const orgSlug = url.searchParams.get("org")

        if (!orgSlug) {
            await logWebhook(supabase, "wompi", "error", null, { error: "Missing org parameter" })
            return NextResponse.json(
                { error: "Missing org parameter" },
                { status: 400 }
            )
        }

        const payload: WompiWebhookPayload = await request.json()
        const transaction = payload.data.transaction

        // Obtener la organización y su configuración de pago
        const { data: org } = await supabase
            .from("organizations")
            .select("id")
            .eq("slug", orgSlug)
            .single()

        if (!org) {
            await logWebhook(supabase, "wompi", "error", payload, { error: "Organization not found" })
            return NextResponse.json(
                { error: "Organization not found" },
                { status: 404 }
            )
        }

        const { data: config } = await supabase
            .from("payment_gateway_configs")
            .select("*")
            .eq("organization_id", org.id)
            .eq("provider", "wompi")
            .single()

        if (!config) {
            await logWebhook(supabase, "wompi", "error", payload, { error: "Payment gateway not configured" })
            return NextResponse.json(
                { error: "Payment gateway not configured" },
                { status: 400 }
            )
        }

        // Validar firma del webhook usando el secreto de eventos (prod_events_...)
        // Según docs Wompi: https://docs.wompi.co/docs/colombia/eventos/
        // El secreto de eventos es diferente al de integridad del widget
        const eventsSecret = config.events_secret_encrypted
            ? decrypt(config.events_secret_encrypted)
            : null

        if (eventsSecret) {
            const gateway = new WompiGateway({
                provider: "wompi",
                publicKey: config.public_key || "",
                privateKey: "",
                integritySecret: eventsSecret,
                isTestMode: config.is_test_mode,
            })

            const isValid = gateway.validateWebhookSignature(payload, "", "")
            if (!isValid) {
                log.error("Invalid signature", { orgSlug, transactionId: transaction.id })
                await logWebhook(supabase, "wompi", "error", payload, { error: "Invalid signature" })
                return NextResponse.json(
                    { error: "Invalid signature" },
                    { status: 401 }
                )
            }
        }

        // Mapear estado de Wompi
        const status = mapWompiStatus(transaction.status)

        // Verificar idempotencia: buscar si ya procesamos este webhook
        const { data: existingTx } = await supabase
            .from("store_transactions")
            .select("id, order_id, status")
            .eq("provider_transaction_id", transaction.id)
            .eq("organization_id", org.id)
            .single()

        if (existingTx) {
            // Idempotencia: si el estado ya es el mismo, no hacer nada
            if (existingTx.status === status) {
                if (existingTx.order_id && status !== "pending") {
                    await processOrderUpdate(supabase, existingTx.order_id, status, org.id)
                }

                log.info("Duplicate webhook ignored", {
                    transactionId: transaction.id,
                    status,
                    storeTransactionId: existingTx.id,
                })
                await logWebhook(supabase, "wompi", "duplicate", payload, { 
                    message: "Duplicate webhook, no action taken",
                    transactionId: existingTx.id 
                })
                return NextResponse.json({ received: true, duplicate: true })
            }

            // Actualizar transacción existente
            await supabase
                .from("store_transactions")
                .update({
                    status,
                    provider_response: payload.data,
                    completed_at: status === "approved" ? new Date().toISOString() : null,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", existingTx.id)

            // Actualizar estado de la orden si existe
            if (existingTx.order_id) {
                await processOrderUpdate(supabase, existingTx.order_id, status, org.id)
            }

            await logWebhook(supabase, "wompi", "success", payload, { 
                transactionId: existingTx.id,
                orderId: existingTx.order_id,
                status,
                processingTime: Date.now() - startTime
            })
        } else {
            // Buscar por referencia (para transacciones creadas antes del webhook)
            const { data: txByRef } = await supabase
                .from("store_transactions")
                .select("id, order_id, status")
                .eq("provider_reference", transaction.reference)
                .eq("organization_id", org.id)
                .single()

            if (txByRef) {
                const shouldReplayOrderSideEffects = txByRef.status !== status

                // Actualizar con el ID de transacción del proveedor
                await supabase
                    .from("store_transactions")
                    .update({
                        status,
                        provider_transaction_id: transaction.id,
                        provider_response: payload.data,
                        completed_at: status === "approved" ? new Date().toISOString() : null,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", txByRef.id)

                if (txByRef.order_id && shouldReplayOrderSideEffects) {
                    await processOrderUpdate(supabase, txByRef.order_id, status, org.id)
                }

                if (!shouldReplayOrderSideEffects) {
                    log.info("Reference-matched webhook reconciled without replaying side effects", {
                        transactionId: transaction.id,
                        storeTransactionId: txByRef.id,
                        orderId: txByRef.order_id,
                        status,
                    })
                }

                await logWebhook(supabase, "wompi", "success", payload, { 
                    transactionId: txByRef.id,
                    orderId: txByRef.order_id,
                    status,
                    processingTime: Date.now() - startTime
                })
            } else {
                // No hay transacción previa - buscar la orden directamente por reference (orderId)
                // El reference es el UUID de la orden que pasamos al widget de Wompi
                const { data: order } = await supabase
                    .from("orders")
                    .select("id, organization_id")
                    .eq("id", transaction.reference)
                    .eq("organization_id", org.id)
                    .single()

                // Crear nueva transacción con el order_id si encontramos la orden
                const { data: newTx } = await supabase
                    .from("store_transactions")
                    .insert({
                        organization_id: org.id,
                        order_id: order?.id || null,
                        amount: transaction.amount_in_cents,
                        currency: transaction.currency,
                        status,
                        provider: "wompi",
                        provider_transaction_id: transaction.id,
                        provider_reference: transaction.reference,
                        provider_response: payload.data,
                        payment_method: transaction.payment_method_type?.toLowerCase(),
                        completed_at: status === "approved" ? new Date().toISOString() : null,
                    })
                    .select("id")
                    .single()

                // Si encontramos la orden, actualizarla
                if (order) {
                    await processOrderUpdate(supabase, order.id, status, org.id)
                }

                await logWebhook(supabase, "wompi", "success", payload, { 
                    transactionId: newTx?.id,
                    orderId: order?.id,
                    status,
                    note: order ? "New transaction created and order updated" : "New transaction created (order not found)",
                    processingTime: Date.now() - startTime
                })
            }
        }

        return NextResponse.json({ received: true })
    } catch (error) {
        log.error("Unhandled webhook error", {
            message: error instanceof Error ? error.message : "Unknown error",
        })
        await logWebhook(supabase, "wompi", "error", null, { 
            error: error instanceof Error ? error.message : "Unknown error",
            processingTime: Date.now() - startTime
        })
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}

/**
 * Procesa la actualización de una orden basada en el estado del pago
 */
async function processOrderUpdate(
    supabase: ReturnType<typeof createServiceClient>,
    orderId: string,
    status: TransactionStatus,
    organizationId: string
) {
    const result = await applyPaymentStatusToOrder({
        supabase,
        organizationId,
        orderId,
        transactionStatus: status,
        source: "webhook_wompi",
    })

    if (!result.success) {
        log.error("Failed to apply Wompi payment status to order", {
            orderId,
            organizationId,
            status,
            reason: result.reason,
            error: result.error,
        })
    }
}

/**
 * Registra el evento del webhook en la tabla webhook_logs
 * Columnas reales: webhook_type, event_type, instance_name, payload, headers, processing_result, error_message
 */
async function logWebhook(
    supabase: ReturnType<typeof createServiceClient>,
    webhookType: string,
    processingResult: string,
    payload: unknown,
    response: unknown
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

function mapWompiStatus(
    wompiStatus: string
): "pending" | "approved" | "declined" | "voided" | "error" {
    const statusMap: Record<
        string,
        "pending" | "approved" | "declined" | "voided" | "error"
    > = {
        APPROVED: "approved",
        DECLINED: "declined",
        VOIDED: "voided",
        ERROR: "error",
        PENDING: "pending",
    }
    return statusMap[wompiStatus] || "pending"
}
