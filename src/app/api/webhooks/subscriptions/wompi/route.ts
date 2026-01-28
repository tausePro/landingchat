/**
 * Webhook handler para pagos de suscripciones de LandingChat
 * Recibe eventos de Wompi para actualizar el estado de suscripciones de organizaciones
 *
 * IMPORTANTE: Este webhook es para cobros de la plataforma (suscripciones),
 * NO para los pagos de las tiendas de los clientes.
 */

import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { decrypt } from "@/lib/utils/encryption"
import crypto from "crypto"

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

interface PlatformConfig {
    id: string
    key: string
    value: {
        provider: string
        is_active: boolean
        is_test_mode: boolean
        public_key: string
        webhook_url: string
    }
    encrypted_values: {
        private_key_encrypted?: string
        integrity_secret_encrypted?: string
    }
}

export async function POST(request: Request) {
    const supabase = createServiceClient()
    const startTime = Date.now()

    try {
        const payload: WompiWebhookPayload = await request.json()
        const transaction = payload.data.transaction

        console.log("[Subscription Webhook] Received event:", payload.event)
        console.log("[Subscription Webhook] Transaction:", transaction.id, transaction.status)

        // Obtener configuración de Wompi de la plataforma
        const { data: config, error: configError } = await supabase
            .from("platform_config")
            .select("*")
            .eq("key", "payment_gateway_wompi")
            .single()

        if (configError || !config) {
            console.error("[Subscription Webhook] Platform config not found:", configError)
            await logWebhook(supabase, null, "error", payload, { error: "Platform config not found" })
            return NextResponse.json(
                { error: "Platform not configured" },
                { status: 500 }
            )
        }

        const platformConfig = config as PlatformConfig

        if (!platformConfig.value.is_active) {
            console.error("[Subscription Webhook] Platform payments not active")
            await logWebhook(supabase, null, "error", payload, { error: "Platform payments not active" })
            return NextResponse.json(
                { error: "Platform payments not active" },
                { status: 400 }
            )
        }

        // Validar firma del webhook
        if (platformConfig.encrypted_values.integrity_secret_encrypted) {
            const integritySecret = decrypt(platformConfig.encrypted_values.integrity_secret_encrypted)
            const isValid = validateWompiSignature(payload, integritySecret)

            if (!isValid) {
                console.error("[Subscription Webhook] Invalid signature")
                await logWebhook(supabase, null, "error", payload, { error: "Invalid signature" })
                return NextResponse.json(
                    { error: "Invalid signature" },
                    { status: 401 }
                )
            }
        }

        // La referencia contiene: sub_{subscription_id}_{timestamp}
        const reference = transaction.reference
        const subscriptionId = extractSubscriptionId(reference)

        if (!subscriptionId) {
            console.error("[Subscription Webhook] Invalid reference format:", reference)
            await logWebhook(supabase, null, "error", payload, { error: "Invalid reference format" })
            return NextResponse.json(
                { error: "Invalid reference format" },
                { status: 400 }
            )
        }

        // Buscar la suscripción
        const { data: subscription, error: subError } = await supabase
            .from("subscriptions")
            .select("id, organization_id, status, current_period_end")
            .eq("id", subscriptionId)
            .single()

        if (subError || !subscription) {
            console.error("[Subscription Webhook] Subscription not found:", subscriptionId, subError)
            await logWebhook(supabase, null, "error", payload, {
                error: "Subscription not found",
                subscriptionId
            })
            return NextResponse.json(
                { error: "Subscription not found" },
                { status: 404 }
            )
        }

        // Mapear estado de Wompi
        const paymentStatus = mapWompiStatus(transaction.status)

        // Registrar la transacción de pago
        const { data: paymentTx, error: txError } = await supabase
            .from("payment_transactions")
            .upsert({
                subscription_id: subscription.id,
                organization_id: subscription.organization_id,
                amount: transaction.amount_in_cents / 100,
                currency: transaction.currency,
                status: paymentStatus,
                provider: "wompi",
                provider_transaction_id: transaction.id,
                provider_reference: reference,
                provider_response: payload.data,
                payment_method: transaction.payment_method_type?.toLowerCase(),
                completed_at: paymentStatus === "approved" ? new Date().toISOString() : null,
            }, {
                onConflict: "provider_transaction_id"
            })
            .select("id")
            .single()

        if (txError) {
            console.error("[Subscription Webhook] Error saving transaction:", txError)
        }

        // Actualizar estado de la suscripción según el pago
        if (paymentStatus === "approved") {
            // Calcular nuevo período (1 mes desde el fin del período actual o desde ahora)
            const currentPeriodEnd = new Date(subscription.current_period_end)
            const now = new Date()
            const startDate = currentPeriodEnd > now ? currentPeriodEnd : now
            const newPeriodEnd = new Date(startDate)
            newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1)

            await supabase
                .from("subscriptions")
                .update({
                    status: "active",
                    current_period_start: startDate.toISOString(),
                    current_period_end: newPeriodEnd.toISOString(),
                    provider_subscription_id: transaction.id,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", subscription.id)

            console.log(`[Subscription Webhook] Subscription ${subscription.id} renewed until ${newPeriodEnd.toISOString()}`)

        } else if (paymentStatus === "declined" || paymentStatus === "error") {
            // Marcar como past_due si el pago falló
            await supabase
                .from("subscriptions")
                .update({
                    status: "past_due",
                    updated_at: new Date().toISOString(),
                })
                .eq("id", subscription.id)

            console.log(`[Subscription Webhook] Subscription ${subscription.id} marked as past_due`)
        }

        await logWebhook(supabase, subscription.organization_id, "success", payload, {
            subscriptionId: subscription.id,
            transactionId: paymentTx?.id,
            paymentStatus,
            processingTime: Date.now() - startTime
        })

        return NextResponse.json({ received: true })

    } catch (error) {
        console.error("[Subscription Webhook] Error:", error)
        await logWebhook(supabase, null, "error", null, {
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
 * Extrae el ID de suscripción de la referencia
 * Formato esperado: sub_{subscription_id}_{timestamp}
 */
function extractSubscriptionId(reference: string): string | null {
    if (!reference.startsWith("sub_")) {
        return null
    }
    const parts = reference.split("_")
    if (parts.length < 2) {
        return null
    }
    // El UUID está entre sub_ y el timestamp final
    // sub_123e4567-e89b-12d3-a456-426614174000_1706500000
    return parts.slice(1, -1).join("_")
}

/**
 * Valida la firma del webhook de Wompi
 */
function validateWompiSignature(payload: WompiWebhookPayload, integritySecret: string): boolean {
    try {
        const { signature, data, timestamp } = payload

        if (!signature?.checksum || !signature?.properties) {
            return false
        }

        // Construir el string a firmar según las propiedades indicadas
        const values: string[] = []
        for (const prop of signature.properties) {
            const keys = prop.split(".")
            let value: unknown = data
            for (const key of keys) {
                value = (value as Record<string, unknown>)?.[key]
            }
            if (value !== undefined) {
                values.push(String(value))
            }
        }
        values.push(String(timestamp))
        values.push(integritySecret)

        const concatenated = values.join("")
        const hash = crypto.createHash("sha256").update(concatenated).digest("hex")

        return hash === signature.checksum
    } catch (error) {
        console.error("[Subscription Webhook] Error validating signature:", error)
        return false
    }
}

/**
 * Registra el evento del webhook
 */
async function logWebhook(
    supabase: ReturnType<typeof createServiceClient>,
    organizationId: string | null,
    status: "success" | "error",
    payload: unknown,
    response: unknown
) {
    try {
        await supabase.from("webhook_logs").insert({
            organization_id: organizationId,
            provider: "wompi_subscriptions",
            event_type: "subscription.payment",
            status,
            payload,
            response,
            created_at: new Date().toISOString(),
        })
    } catch (error) {
        console.error("[Subscription Webhook] Error logging webhook:", error)
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
