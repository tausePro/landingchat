/**
 * Webhook handler para notificaciones de ePayco
 * Recibe eventos de transacciones y actualiza el estado de órdenes
 */

import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { decrypt } from "@/lib/utils/encryption"
import crypto from "crypto"
import { logger } from "@/lib/logger"

const log = logger("webhooks/payments-epayco")

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
            log.error("Invalid signature")
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
                log.info("Duplicate webhook, no action taken", { transactionId: payload.x_ref_payco, status })
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
                // No hay transacción previa - buscar la orden directamente por el reference (orderId)
                // El reference es el UUID de la orden que pasamos como invoice/extra1
                const { data: order } = await supabase
                    .from("orders")
                    .select("id, organization_id")
                    .eq("id", reference)
                    .eq("organization_id", org.id)
                    .single()

                // Crear nueva transacción con el order_id si encontramos la orden
                const { data: newTx } = await supabase
                    .from("store_transactions")
                    .insert({
                        organization_id: org.id,
                        order_id: order?.id || null, // Vincular con la orden si existe
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

                // Si encontramos la orden, actualizarla
                if (order) {
                    await processOrderUpdate(supabase, order.id, status, org.id)
                }

                await logWebhook(supabase, org.id, "epayco", "success", payload, { 
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
        log.error("Unhandled error", { error: error instanceof Error ? error.message : String(error) })
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

    // Enviar notificación de venta y tracking si el pago fue aprobado
    if (status === "approved") {
        // Obtener datos completos de la orden para notificación y tracking
        const { data: order } = await supabase
            .from("orders")
            .select(`
                id,
                order_number,
                total,
                customer_info,
                items,
                customers!inner(name, email, phone),
                order_items(
                    quantity,
                    product_id,
                    products!inner(name)
                )
            `)
            .eq("id", orderId)
            .single()

        if (order) {
            const customer = order.customers as { name?: string; email?: string; phone?: string } | null
            const orderItems = order.order_items as Array<{
                quantity: number
                product_id: string
                products: { name?: string } | null
            }>
            const customerInfo = order.customer_info as {
                name?: string
                email?: string
                phone?: string
                city?: string
            } | null

            // 1. Enviar notificación de venta por WhatsApp
            try {
                const { sendSaleNotification } = await import("@/lib/notifications/whatsapp")

                await sendSaleNotification(
                    { organizationId },
                    {
                        id: order.order_number || order.id,
                        total: order.total,
                        customerName: customer?.name || customerInfo?.name || "Cliente",
                        items: orderItems?.map((item) => ({
                            name: item.products?.name || "Producto",
                            quantity: item.quantity,
                        })) || [],
                    }
                )
                log.info("Sale notification sent", { orderNumber: order.order_number })
            } catch (notifError) {
                log.error("Error sending sale notification", { error: notifError instanceof Error ? notifError.message : String(notifError) })
            }

            // 2. Enviar evento Purchase a Meta Conversions API (server-side tracking)
            try {
                const { trackServerPurchase } = await import("@/lib/analytics/meta-conversions-api")

                await trackServerPurchase(
                    organizationId,
                    {
                        id: order.id,
                        orderNumber: order.order_number,
                        total: order.total,
                        currency: "COP",
                        items: orderItems?.map((item) => ({
                            productId: item.product_id,
                            quantity: item.quantity,
                        })),
                        customerEmail: customer?.email || customerInfo?.email,
                        customerPhone: customer?.phone || customerInfo?.phone,
                        customerName: customer?.name || customerInfo?.name,
                        customerCity: customerInfo?.city,
                    },
                    supabase
                )
                log.info("Meta CAPI Purchase event sent", { orderNumber: order.order_number })
            } catch (capiError) {
                log.error("Error sending Meta CAPI event", { error: capiError instanceof Error ? capiError.message : String(capiError) })
            }
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
        log.error("Error logging webhook", { error: error instanceof Error ? error.message : String(error) })
        // No fallar el webhook si el logging falla
    }
}

function validateEpaycoSignature(
    payload: EpaycoWebhookPayload,
    customerId: string,
    encryptionKey: string
): boolean {
    if (!customerId || !encryptionKey) {
        log.error("Missing P_CUST_ID_CLIENTE or P_ENCRYPTION_KEY")
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

    log.debug("Signature validation", {
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
