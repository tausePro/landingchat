/**
 * Webhook handler para eventos de Wompi
 * Recibe notificaciones de transacciones y actualiza el estado de suscripciones
 */

import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { logger } from "@/lib/utils/logger"
import { WompiClient } from "@/lib/wompi/client"
import { type WompiWebhookPayload, type WompiConfig, WOMPI_STATUS_MAP } from "@/lib/wompi/types"

const WOMPI_CONFIG_KEY = "wompi_config"

/**
 * Obtiene la configuración de Wompi desde la base de datos
 */
async function getWompiConfig(): Promise<WompiConfig | null> {
    const supabase = await createServiceClient()

    const { data, error } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", WOMPI_CONFIG_KEY)
        .single()

    if (error || !data) {
        logger.error("[Wompi Webhook] Config not found")
        return null
    }

    return data.value as WompiConfig
}

/**
 * Extrae el subscription_id de la referencia de transacción
 * Formato: SUB-{subscriptionId}-{timestamp}-{random}
 */
function extractSubscriptionIdFromReference(reference: string): string | null {
    const match = reference.match(/^SUB-([a-f0-9-]+)-/)
    return match ? match[1] : null
}

export async function POST(request: NextRequest) {
    try {
        const payload: WompiWebhookPayload = await request.json()

        logger.info("[Wompi Webhook] Received", { event: payload.event })

        // Solo procesar eventos de transacción
        if (payload.event !== "transaction.updated") {
            return NextResponse.json({ received: true })
        }

        // Obtener configuración de Wompi
        const config = await getWompiConfig()
        if (!config) {
            logger.error("[Wompi Webhook] Config not found")
            return NextResponse.json(
                { error: "Wompi not configured" },
                { status: 500 }
            )
        }

        // Validar firma del webhook
        const client = new WompiClient(config)
        const isValid = client.validateWebhookSignature(payload)

        if (!isValid) {
            logger.warn("[Wompi Webhook] Invalid signature")
            return NextResponse.json(
                { error: "Invalid signature" },
                { status: 401 }
            )
        }

        const transaction = payload.data.transaction
        const supabase = await createServiceClient()

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
            logger.error("[Wompi Webhook] Error saving transaction", {
                message: txError.message,
            })
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
                    logger.error("[Wompi Webhook] Error updating subscription", {
                        message: subError.message,
                    })
                } else {
                    logger.info("[Wompi Webhook] Subscription updated", {
                        subscriptionId,
                        newStatus,
                    })
                }
            }
        }

        return NextResponse.json({ received: true })
    } catch (error) {
        logger.error("[Wompi Webhook] Error", {
            message: error instanceof Error ? error.message : String(error),
        })
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
