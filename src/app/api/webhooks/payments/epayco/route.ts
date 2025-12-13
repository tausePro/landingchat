/**
 * Webhook handler para notificaciones de ePayco
 * Recibe eventos de transacciones y actualiza el estado de órdenes
 */

import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { decrypt } from "@/lib/utils/encryption"
import crypto from "crypto"

interface EpaycoWebhookPayload {
    x_ref_payco: string
    x_id_invoice: string
    x_description: string
    x_amount: string
    x_amount_country: string
    x_amount_ok: string
    x_tax: string
    x_amount_base: string
    x_currency_code: string
    x_bank_name: string
    x_cardnumber: string
    x_quotas: string
    x_response: string
    x_approval_code: string
    x_transaction_id: string
    x_fecha_transaccion: string
    x_transaction_date: string
    x_cod_response: string
    x_response_reason_text: string
    x_errorcode: string
    x_franchise: string
    x_business: string
    x_customer_doctype: string
    x_customer_document: string
    x_customer_name: string
    x_customer_lastname: string
    x_customer_email: string
    x_customer_phone: string
    x_customer_movil: string
    x_customer_ind_pais: string
    x_customer_country: string
    x_customer_city: string
    x_customer_address: string
    x_customer_ip: string
    x_signature: string
    x_test_request: string
    x_extra1?: string
    x_extra2?: string
    x_extra3?: string
}

export async function POST(request: Request) {
    const supabase = createServiceClient()
    const startTime = Date.now()
    
    try {
        const url = new URL(request.url)
        const orgSlug = url.searchParams.get("org")

        if (!orgSlug) {
            await logWebhook(supabase, null, "epayco", "error", null, { error: "Missing org parameter" })
            return NextResponse.json(
                { error: "Missing org parameter" },
                { status: 400 }
            )
        }

        // ePayco envía datos como form-urlencoded o JSON
        const contentType = request.headers.get("content-type") || ""
        let payload: EpaycoWebhookPayload

        if (contentType.includes("application/x-www-form-urlencoded")) {
            const formData = await request.formData()
            payload = Object.fromEntries(formData.entries()) as unknown as EpaycoWebhookPayload
        } else {
            payload = await request.json()
        }

        // Obtener la organización y su configuración de pago
        const { data: org } = await supabase
            .from("organizations")
            .select("id")
            .eq("slug", orgSlug)
            .single()

        if (!org) {
            await logWebhook(supabase, null, "epayco", "error", payload, { error: "Organization not found" })
            return NextResponse.json(
                { error: "Organization not found" },
                { status: 404 }
            )
        }

        const { data: config } = await supabase
            .from("payment_gateway_configs")
            .select("*")
            .eq("organization_id", org.id)
            .eq("provider", "epayco")
            .single()

        if (!config) {
            await logWebhook(supabase, org.id, "epayco", "error", payload, { error: "Payment gateway not configured" })
            return NextResponse.json(
                { error: "Payment gateway not configured" },
                { status: 400 }
            )
        }

        // Validar firma del webhook
        const customerId = config.integrity_secret_encrypted
            ? decrypt(config.integrity_secret_encrypted)
            : ""
        const encryptionKey = config.encryption_key_encrypted
            ? decrypt(config.encryption_key_encrypted)
            : ""

        const isValid = validateEpaycoSignature(payload, customerId, encryptionKey)
        if (!isValid) {
            console.error("[ePayco Webhook] Invalid signature")
            await logWebhook(supabase, org.id, "epayco", "error", payload, { error: "Invalid signature" })
            return NextResponse.json(
                { error: "Invalid signature" },
                { status: 401 }
            )
        }

        // Mapear estado de ePayco
        const status = mapEpaycoStatus(payload.x_cod_response)
        const reference = payload.x_id_invoice || payload.x_extra1

        // Verificar idempotencia: buscar si ya procesamos este webhook
        const { data: existingTx } = await supabase
            .from("store_transactions")
            .select("id, order_id, status")
            .eq("provider_transaction_id", payload.x_ref_payco)
            .eq("organization_id", org.id)
            .single()

        if (existingTx) {
            // Idempotencia: si el estado ya es el mismo, no hacer nada
            if (existingTx.status === status) {
                console.log(`[ePayco Webhook] Duplicate webhook for transaction ${payload.x_ref_payco}, status already ${status}`)
                await logWebhook(supabase, org.id, "epayco", "duplicate", payload, { 
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
                    provider_response: payload,
                    completed_at: status === "approved" ? new Date().toISOString() : null,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", existingTx.id)

            // Actualizar estado de la orden si existe
            if (existingTx.order_id) {
                await processOrderUpdate(supabase, existingTx.order_id, status, org.id)
            }

            await logWebhook(supabase, org.id, "epayco", "success", payload, { 
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
                .eq("provider_reference", reference)
                .eq("organization_id", org.id)
                .single()

            if (txByRef) {
                // Actualizar con el ID de transacción del proveedor
                await supabase
                    .from("store_transactions")
                    .update({
                        status,
                        provider_transaction_id: payload.x_ref_payco,
                        provider_response: payload,
                        completed_at: status === "approved" ? new Date().toISOString() : null,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", txByRef.id)

                if (txByRef.order_id) {
                    await processOrderUpdate(supabase, txByRef.order_id, status, org.id)
                }

                await logWebhook(supabase, org.id, "epayco", "success", payload, { 
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
                        amount: Math.round(parseFloat(payload.x_amount) * 100),
                        currency: payload.x_currency_code,
                        status,
                        provider: "epayco",
                        provider_transaction_id: payload.x_ref_payco,
                        provider_reference: reference,
                        provider_response: payload,
                        payment_method: payload.x_franchise?.toLowerCase() || "card",
                        completed_at: status === "approved" ? new Date().toISOString() : null,
                    })
                    .select("id")
                    .single()

                await logWebhook(supabase, org.id, "epayco", "success", payload, { 
                    transactionId: newTx?.id,
                    status,
                    note: "New transaction created from webhook",
                    processingTime: Date.now() - startTime
                })
            }
        }

        return NextResponse.json({ received: true })
    } catch (error) {
        console.error("[ePayco Webhook] Error:", error)
        await logWebhook(supabase, null, "epayco", "error", null, { 
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
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const customer = order.customers as any
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const orderItems = order.order_items as any[]
                
                await sendSaleNotification(
                    { organizationId },
                    {
                        id: order.order_number || order.id,
                        total: order.total,
                        customerName: customer?.name || "Cliente",
                        items: orderItems?.map((item: any) => ({
                            name: item.products?.name || "Producto",
                            quantity: item.quantity,
                        })) || [],
                    }
                )
                console.log(`[ePayco Webhook] Sale notification sent for order ${order.order_number}`)
            }
        } catch (notifError) {
            console.error("[ePayco Webhook] Error sending sale notification:", notifError)
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
        console.error("[ePayco Webhook] Error logging webhook:", error)
        // No fallar el webhook si el logging falla
    }
}

function validateEpaycoSignature(
    payload: EpaycoWebhookPayload,
    customerId: string,
    encryptionKey: string
): boolean {
    if (!customerId || !encryptionKey) {
        console.error("[ePayco Webhook] Missing P_CUST_ID_CLIENTE or P_ENCRYPTION_KEY")
        return false
    }

    // ePayco signature: SHA256(p_cust_id_cliente + p_encryption_key + x_ref_payco + x_transaction_id + x_amount + x_currency_code)
    const stringToSign = [
        customerId,
        encryptionKey,
        payload.x_ref_payco,
        payload.x_transaction_id,
        payload.x_amount,
        payload.x_currency_code,
    ].join("")

    const calculatedSignature = crypto
        .createHash("sha256")
        .update(stringToSign)
        .digest("hex")

    console.log("[ePayco Webhook] Signature validation:", {
        customerId: customerId.substring(0, 4) + "***",
        encryptionKey: encryptionKey.substring(0, 4) + "***",
        stringToSign: stringToSign.substring(0, 20) + "...",
        calculatedSignature,
        receivedSignature: payload.x_signature,
        isValid: calculatedSignature === payload.x_signature
    })

    return calculatedSignature === payload.x_signature
}

function mapEpaycoStatus(
    codResponse: string
): "pending" | "approved" | "declined" | "voided" | "error" {
    // Códigos de respuesta de ePayco
    // 1 = Aceptada, 2 = Rechazada, 3 = Pendiente, 4 = Fallida, 6 = Reversada
    const statusMap: Record<
        string,
        "pending" | "approved" | "declined" | "voided" | "error"
    > = {
        "1": "approved",
        "2": "declined",
        "3": "pending",
        "4": "error",
        "6": "voided",
    }
    return statusMap[codResponse] || "pending"
}
