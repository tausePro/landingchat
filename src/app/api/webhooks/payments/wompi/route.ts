/**
 * Webhook handler para notificaciones de Wompi
 * Recibe eventos de transacciones y actualiza el estado de órdenes
 */

import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { decrypt } from "@/lib/utils/encryption"
import { WompiGateway } from "@/lib/payments/wompi-gateway"

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
            await logWebhook(supabase, null, "wompi", "error", null, { error: "Missing org parameter" })
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
            await logWebhook(supabase, null, "wompi", "error", payload, { error: "Organization not found" })
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
            await logWebhook(supabase, org.id, "wompi", "error", payload, { error: "Payment gateway not configured" })
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
                console.error("[Wompi Webhook] Invalid signature")
                await logWebhook(supabase, org.id, "wompi", "error", payload, { error: "Invalid signature" })
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
                console.log(`[Wompi Webhook] Duplicate webhook for transaction ${transaction.id}, status already ${status}`)
                await logWebhook(supabase, org.id, "wompi", "duplicate", payload, { 
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

            await logWebhook(supabase, org.id, "wompi", "success", payload, { 
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

                if (txByRef.order_id) {
                    await processOrderUpdate(supabase, txByRef.order_id, status, org.id)
                }

                await logWebhook(supabase, org.id, "wompi", "success", payload, { 
                    transactionId: txByRef.id,
                    orderId: txByRef.order_id,
                    status,
                    processingTime: Date.now() - startTime
                })
            } else {
                // Crear nueva transacción (caso raro, pero posible)
                const { data: newTx } = await supabase
                    .from("store_transactions")
                    .insert({
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
                    .select("id")
                    .single()

                await logWebhook(supabase, org.id, "wompi", "success", payload, { 
                    transactionId: newTx?.id,
                    status,
                    note: "New transaction created from webhook",
                    processingTime: Date.now() - startTime
                })
            }
        }

        return NextResponse.json({ received: true })
    } catch (error) {
        console.error("[Wompi Webhook] Error:", error)
        await logWebhook(supabase, null, "wompi", "error", null, { 
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
    status: "pending" | "approved" | "declined" | "voided" | "error",
    organizationId: string
) {
    const paymentStatus =
        status === "approved"
            ? "paid"
            : status === "declined"
                ? "failed"
                : status === "voided"
                    ? "refunded"
                    : "pending"

    const orderStatus = status === "approved" ? "confirmed" : status === "declined" ? "cancelled" : undefined
    const confirmedAt = status === "approved" ? new Date().toISOString() : undefined

    await supabase
        .from("orders")
        .update({
            payment_status: paymentStatus,
            ...(orderStatus && { status: orderStatus }),
            ...(confirmedAt && { confirmed_at: confirmedAt }),
            updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)

    // Enviar notificación de venta si el pago fue aprobado
    if (status === "approved") {
        try {
            const { data: order } = await supabase
                .from("orders")
                .select(`
                    id,
                    order_number,
                    total,
                    customers!inner(name),
                    order_items(
                        quantity,
                        products!inner(name)
                    )
                `)
                .eq("id", orderId)
                .single()

            if (order) {
                const { sendSaleNotification } = await import("@/lib/notifications/whatsapp")
                const customer = order.customers as { name?: string } | null
                const orderItems = order.order_items as Array<{
                    quantity: number
                    products: { name?: string } | null
                }>

                await sendSaleNotification(
                    { organizationId },
                    {
                        id: order.order_number || order.id,
                        total: order.total,
                        customerName: customer?.name || "Cliente",
                        items: orderItems?.map((item) => ({
                            name: item.products?.name || "Producto",
                            quantity: item.quantity,
                        })) || [],
                    }
                )
                console.log(`[Wompi Webhook] Sale notification sent for order ${order.order_number}`)
            }
        } catch (notifError) {
            console.error("[Wompi Webhook] Error sending sale notification:", notifError)
            // No fallar el webhook si la notificación falla
        }
    }
}

/**
 * Registra el evento del webhook en la tabla webhook_logs
 */
async function logWebhook(
    supabase: ReturnType<typeof createServiceClient>,
    organizationId: string | null,
    provider: string,
    status: "success" | "error" | "duplicate",
    payload: unknown,
    response: unknown
) {
    try {
        await supabase.from("webhook_logs").insert({
            organization_id: organizationId,
            provider,
            event_type: "payment.updated",
            status,
            payload,
            response,
            created_at: new Date().toISOString(),
        })
    } catch (error) {
        console.error("[Wompi Webhook] Error logging webhook:", error)
        // No fallar el webhook si el logging falla
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
