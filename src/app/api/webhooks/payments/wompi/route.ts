/**
 * Webhook handler para notificaciones de Wompi
 * Recibe eventos de transacciones y actualiza el estado de órdenes
 */

import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { decrypt } from "@/lib/utils/encryption"
import { WompiGateway } from "@/lib/payments/wompi-gateway"
import type { PaymentGatewayConfig } from "@/types"

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
    try {
        const url = new URL(request.url)
        const orgSlug = url.searchParams.get("org")

        if (!orgSlug) {
            return NextResponse.json(
                { error: "Missing org parameter" },
                { status: 400 }
            )
        }

        const payload: WompiWebhookPayload = await request.json()

        // Obtener la organización y su configuración de pago
        const supabase = createServiceClient()

        const { data: org } = await supabase
            .from("organizations")
            .select("id")
            .eq("slug", orgSlug)
            .single()

        if (!org) {
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
            return NextResponse.json(
                { error: "Payment gateway not configured" },
                { status: 400 }
            )
        }

        // Validar firma del webhook
        if (config.integrity_secret_encrypted) {
            const integritySecret = decrypt(config.integrity_secret_encrypted)
            const privateKey = config.private_key_encrypted
                ? decrypt(config.private_key_encrypted)
                : ""

            const gateway = new WompiGateway({
                provider: "wompi",
                publicKey: config.public_key || "",
                privateKey,
                integritySecret,
                isTestMode: config.is_test_mode,
            })

            const isValid = gateway.validateWebhookSignature(payload, "", "")
            if (!isValid) {
                console.error("Invalid webhook signature")
                return NextResponse.json(
                    { error: "Invalid signature" },
                    { status: 401 }
                )
            }
        }

        // Procesar el evento
        const transaction = payload.data.transaction
        const status = mapWompiStatus(transaction.status)

        // Buscar la transacción en nuestra base de datos
        const { data: existingTx } = await supabase
            .from("store_transactions")
            .select("id, order_id")
            .eq("provider_reference", transaction.reference)
            .eq("organization_id", org.id)
            .single()

        if (existingTx) {
            // Actualizar transacción existente
            await supabase
                .from("store_transactions")
                .update({
                    status,
                    provider_transaction_id: transaction.id,
                    provider_response: payload.data,
                    completed_at:
                        status === "approved" ? new Date().toISOString() : null,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", existingTx.id)

            // Actualizar estado de la orden si existe
            if (existingTx.order_id) {
                const paymentStatus =
                    status === "approved"
                        ? "paid"
                        : status === "declined"
                            ? "failed"
                            : "processing"

                await supabase
                    .from("orders")
                    .update({
                        payment_status: paymentStatus,
                        status: status === "approved" ? "confirmed" : undefined,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", existingTx.order_id)
            }
        } else {
            // Crear nueva transacción si no existe
            await supabase.from("store_transactions").insert({
                organization_id: org.id,
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
