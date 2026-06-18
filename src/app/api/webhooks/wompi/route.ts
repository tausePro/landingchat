/**
 * Webhook handler para eventos de Wompi (billing de LandingChat)
 * Recibe notificaciones de transacciones de suscripciones y actualiza el estado
 * 
 * IMPORTANTE: Este webhook es para cobros de LandingChat a merchants (suscripciones/planes).
 * NO confundir con /api/webhooks/payments/wompi que es para pagos de clientes en tiendas.
 * 
 * Config se lee de platform_config (key: payment_gateway_wompi), no de system_settings.
 * Validación de firma usa events_secret según docs oficiales de Wompi.
 */

import { NextRequest, NextResponse } from "next/server"
import { createServiceClient, type SupabaseServiceClient } from "@/lib/supabase/server"
import { WompiClient } from "@/lib/wompi/client"
import { type WompiWebhookPayload, WOMPI_STATUS_MAP } from "@/lib/wompi/types"
import { decrypt } from "@/lib/utils/encryption"
import { applyConversationCreditPayment } from "@/lib/payments/conversation-credit-payment"

interface PlatformConfigRow {
    value: {
        is_active: boolean
        is_test_mode: boolean
        public_key: string
    }
    encrypted_values: {
        private_key_encrypted?: string
        integrity_secret_encrypted?: string
        events_secret_encrypted?: string
    }
}

/**
 * Obtiene la configuración de Wompi de la plataforma desde platform_config
 */
async function getPlatformWompiConfig(supabase: SupabaseServiceClient): Promise<{
    publicKey: string
    privateKey: string
    eventsSecret: string
    integritySecret: string
    isTestMode: boolean
} | null> {
    const { data, error } = await supabase
        .from("platform_config")
        .select("value, encrypted_values")
        .eq("key", "payment_gateway_wompi")
        .single()

    if (error || !data) {
        return null
    }

    const config = data as PlatformConfigRow
    const encrypted = config.encrypted_values || {}

    if (!encrypted.private_key_encrypted) {
        return null
    }

    return {
        publicKey: config.value.public_key,
        privateKey: decrypt(encrypted.private_key_encrypted),
        eventsSecret: encrypted.events_secret_encrypted ? decrypt(encrypted.events_secret_encrypted) : "",
        integritySecret: encrypted.integrity_secret_encrypted ? decrypt(encrypted.integrity_secret_encrypted) : "",
        isTestMode: config.value.is_test_mode,
    }
}

/**
 * Extrae el subscription_id de la referencia de transacción.
 * Formato actual (subscription/actions.ts): sub_{subscriptionId}_{timestamp}
 */
function extractSubscriptionIdFromReference(reference: string): string | null {
    if (!reference.startsWith("sub_")) return null
    const parts = reference.split("_")
    if (parts.length < 3) return null
    // El UUID está entre 'sub_' y el timestamp final
    return parts.slice(1, -1).join("_")
}

/**
 * Procesa el pago de un pack de créditos (reference credits_*). Delega en la
 * función testeable applyConversationCreditPayment.
 */
async function handleCreditPurchase(
    supabase: SupabaseServiceClient,
    transaction: WompiWebhookPayload["data"]["transaction"]
) {
    const result = await applyConversationCreditPayment(supabase, {
        id: transaction.id,
        status: transaction.status,
        reference: transaction.reference,
    })
    console.log("[Wompi Billing] Credit purchase:", transaction.reference, result.httpStatus, JSON.stringify(result.body))
    return NextResponse.json(result.body, { status: result.httpStatus })
}

export async function POST(request: NextRequest) {
    try {
        const payload: WompiWebhookPayload = await request.json()
        const supabase = createServiceClient()

        console.log("[Wompi Billing] Webhook received:", payload.event)

        // DIAGNÓSTICO TEMPORAL (remover tras smoke de créditos): registra TODO
        // evento entrante ANTES de filtrar/validar, para depurar la entrega del
        // webhook (¿llega Wompi? ¿con qué payload/firma?).
        try {
            await supabase.from("webhook_logs").insert({
                webhook_type: "wompi_billing",
                event_type: payload?.event ?? "unknown",
                instance_name: payload?.data?.transaction?.reference ?? null,
                payload,
                headers: Object.fromEntries(request.headers),
                processing_result: "received",
            })
        } catch { /* el logging no debe romper el webhook */ }

        // Solo procesar eventos de transacción
        if (payload.event !== "transaction.updated") {
            return NextResponse.json({ received: true })
        }

        // Obtener configuración de Wompi de la plataforma
        const config = await getPlatformWompiConfig(supabase)
        if (!config) {
            console.error("[Wompi Billing] Platform config not found in platform_config")
            return NextResponse.json(
                { error: "Wompi not configured" },
                { status: 500 }
            )
        }

        // Validar firma del webhook usando events_secret
        // Según docs Wompi: https://docs.wompi.co/docs/colombia/eventos/
        const signatureSecret = config.eventsSecret || config.integritySecret
        if (signatureSecret) {
            const client = new WompiClient({
                publicKey: config.publicKey,
                privateKey: config.privateKey,
                integritySecret: signatureSecret,
                environment: config.isTestMode ? "sandbox" : "production",
            })
            const isValid = client.validateWebhookSignature(payload)

            if (!isValid) {
                console.error("[Wompi Billing] Invalid webhook signature")
                // DIAGNÓSTICO TEMPORAL: marca firma inválida (secreto de eventos no coincide)
                try {
                    await supabase.from("webhook_logs").insert({
                        webhook_type: "wompi_billing",
                        event_type: payload.event,
                        instance_name: payload?.data?.transaction?.reference ?? null,
                        processing_result: "signature_invalid",
                    })
                } catch { /* no-op */ }
                return NextResponse.json(
                    { error: "Invalid signature" },
                    { status: 401 }
                )
            }
        }

        const transaction = payload.data.transaction

        // Compras de packs de créditos de conversaciones (reference credits_*)
        if (transaction.reference.startsWith("credits_")) {
            return await handleCreditPurchase(supabase, transaction)
        }

        // Registrar la transacción en payment_transactions
        const { error: txError } = await supabase
            .from("payment_transactions")
            .upsert({
                provider_transaction_id: transaction.id,
                amount: transaction.amount_in_cents / 100,
                currency: transaction.currency,
                status: WOMPI_STATUS_MAP[transaction.status],
                provider: "wompi",
                provider_response: payload.data,
                updated_at: new Date().toISOString(),
            }, {
                onConflict: "provider_transaction_id",
            })

        if (txError) {
            console.error("Error saving transaction:", txError)
        }

        // Extraer subscription_id de la referencia
        const subscriptionId = extractSubscriptionIdFromReference(transaction.reference)

        if (subscriptionId) {
            // Actualizar estado de la suscripción según el resultado del pago
            let newStatus: string | null = null

            switch (transaction.status) {
                case "APPROVED":
                    newStatus = "active"
                    break
                case "DECLINED":
                case "ERROR":
                    newStatus = "past_due"
                    break
                case "VOIDED":
                    newStatus = "cancelled"
                    break
                // PENDING no cambia el estado
            }

            if (newStatus) {
                const updateData: Record<string, unknown> = {
                    status: newStatus,
                    updated_at: new Date().toISOString(),
                }

                // Si el pago fue aprobado, actualizar período
                if (transaction.status === "APPROVED") {
                    const now = new Date()
                    const nextMonth = new Date(now)
                    nextMonth.setMonth(nextMonth.getMonth() + 1)

                    updateData.current_period_start = now.toISOString()
                    updateData.current_period_end = nextMonth.toISOString()
                }

                const { error: subError } = await supabase
                    .from("subscriptions")
                    .update(updateData)
                    .eq("id", subscriptionId)

                if (subError) {
                    console.error("Error updating subscription:", subError)
                } else {
                    console.log(`Subscription ${subscriptionId} updated to ${newStatus}`)
                }
            }
        }

        return NextResponse.json({ received: true })
    } catch (error) {
        console.error("Webhook error:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}

// Wompi también puede enviar GET para verificar el endpoint
export async function GET() {
    return NextResponse.json({ status: "ok", service: "wompi-webhook" })
}
