/**
 * Webhook handler para notificaciones de ePayco
 * Recibe eventos de transacciones y actualiza el estado de órdenes
 */

import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { decrypt } from "@/lib/utils/encryption"
import crypto from "crypto"
import { logger } from "@/lib/logger"
import { decrementOrderStock } from "@/lib/commerce/decrementOrderStock"
import type { SupabaseClient } from "@supabase/supabase-js"

const log = logger("webhooks/payments-epayco")

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getOptionalString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined
}

function getEpaycoOrderAttribution(value: unknown): { fbc?: string; fbp?: string } {
    if (!isRecord(value)) return {}

    return {
        fbc: getOptionalString(value.fbc) || getOptionalString(value._fbc),
        fbp: getOptionalString(value.fbp) || getOptionalString(value._fbp),
    }
}

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

/**
 * GET handler — fallback para transacciones creadas con method_confirmation=GET
 */
export async function GET(request: Request) {
    const url = new URL(request.url)
    const params = Object.fromEntries(url.searchParams.entries()) as unknown as EpaycoWebhookPayload & { org?: string }
    
    // Construir un request-like object para reusar la lógica
    log.info("GET webhook received, forwarding to handler", { org: params.org, ref: params.x_ref_payco })
    return handleEpaycoWebhook(params.org || null, params)
}

export async function POST(request: Request) {
    const url = new URL(request.url)
    const orgSlug = url.searchParams.get("org")

    // ePayco envía datos como form-urlencoded o JSON
    const contentType = request.headers.get("content-type") || ""
    let payload: EpaycoWebhookPayload

    if (contentType.includes("application/x-www-form-urlencoded")) {
        const formData = await request.formData()
        payload = Object.fromEntries(formData.entries()) as unknown as EpaycoWebhookPayload
    } else {
        payload = await request.json()
    }

    return handleEpaycoWebhook(orgSlug, payload)
}

async function handleEpaycoWebhook(orgSlug: string | null, payload: EpaycoWebhookPayload) {
    const supabase = createServiceClient()
    const startTime = Date.now()
    
    try {
        if (!orgSlug) {
            await logWebhook(supabase, "epayco", "error", null, { error: "Missing org parameter" })
            return NextResponse.json(
                { error: "Missing org parameter" },
                { status: 400 }
            )
        }

        // Obtener la organización y su configuración de pago
        const { data: org } = await supabase
            .from("organizations")
            .select("id")
            .eq("slug", orgSlug)
            .single()

        if (!org) {
            await logWebhook(supabase, "epayco", "error", payload, { error: "Organization not found" })
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
            await logWebhook(supabase, "epayco", "error", payload, { error: "Payment gateway not configured" })
            return NextResponse.json(
                { error: "Payment gateway not configured" },
                { status: 400 }
            )
        }

        // Validar firma del webhook
        // Según docs ePayco: hash('sha256', p_cust_id_cliente ^ p_key ^ x_ref_payco ^ x_transaction_id ^ x_amount ^ x_currency_code)
        // p_cust_id_cliente = integrity_secret_encrypted, p_key = private_key_encrypted
        const customerId = config.integrity_secret_encrypted
            ? decrypt(config.integrity_secret_encrypted)
            : ""
        const privateKey = config.private_key_encrypted
            ? decrypt(config.private_key_encrypted)
            : ""

        const isValid = validateEpaycoSignature(payload, customerId, privateKey)
        if (!isValid) {
            log.error("Invalid signature")
            await logWebhook(supabase, "epayco", "error", payload, { error: "Invalid signature" })
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
                await logWebhook(supabase, "epayco", "duplicate", payload, { 
                    message: "Duplicate webhook, no action taken",
                    transactionId: existingTx.id 
                })
                return NextResponse.json({ received: true, duplicate: true })
            }

            if (existingTx.order_id) {
                const isPaymentDataValid = await validateEpaycoOrderPaymentData(supabase, existingTx.order_id, org.id, payload)
                if (!isPaymentDataValid) {
                    await logWebhook(supabase, "epayco", "error", payload, {
                        error: "Payment amount or currency mismatch",
                        orderId: existingTx.order_id,
                    })
                    return NextResponse.json(
                        { error: "Payment data mismatch" },
                        { status: 400 }
                    )
                }
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

            await logWebhook(supabase, "epayco", "success", payload, { 
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
                const shouldReplayOrderSideEffects = txByRef.status !== status

                if (txByRef.order_id) {
                    const isPaymentDataValid = await validateEpaycoOrderPaymentData(supabase, txByRef.order_id, org.id, payload)
                    if (!isPaymentDataValid) {
                        await logWebhook(supabase, "epayco", "error", payload, {
                            error: "Payment amount or currency mismatch",
                            orderId: txByRef.order_id,
                        })
                        return NextResponse.json(
                            { error: "Payment data mismatch" },
                            { status: 400 }
                        )
                    }
                }

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

                if (txByRef.order_id && shouldReplayOrderSideEffects) {
                    await processOrderUpdate(supabase, txByRef.order_id, status, org.id)
                }

                if (!shouldReplayOrderSideEffects) {
                    log.info("Reference-matched webhook reconciled without replaying side effects", {
                        transactionId: payload.x_ref_payco,
                        storeTransactionId: txByRef.id,
                        orderId: txByRef.order_id,
                        status,
                    })
                }

                await logWebhook(supabase, "epayco", "success", payload, { 
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

                if (order) {
                    const isPaymentDataValid = await validateEpaycoOrderPaymentData(supabase, order.id, org.id, payload)
                    if (!isPaymentDataValid) {
                        await logWebhook(supabase, "epayco", "error", payload, {
                            error: "Payment amount or currency mismatch",
                            orderId: order.id,
                        })
                        return NextResponse.json(
                            { error: "Payment data mismatch" },
                            { status: 400 }
                        )
                    }
                }

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

                if (order) {
                    await processOrderUpdate(supabase, order.id, status, org.id)
                }

                await logWebhook(supabase, "epayco", "success", payload, { 
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
        await logWebhook(supabase, "epayco", "error", null, { 
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
    supabase: SupabaseClient,
    orderId: string,
    status: "pending" | "approved" | "declined" | "voided" | "error",
    organizationId: string
) {
    const paymentStatus =
        status === "approved"
            ? "paid"
            : status === "declined" || status === "error"
                ? "failed"
                : status === "voided"
                    ? "refunded"
                    : "pending"

    const orderStatus = status === "approved" ? "confirmed" : status === "declined" || status === "error" ? "cancelled" : undefined

    // Fase 0.4 post-mortem (hotfix v1.10.58): removimos `confirmed_at` del
    // UPDATE porque la columna NO existe en `public.orders` y el UPDATE entero
    // fallaba silenciosamente (PostgREST retornaba error sin capturarse,
    // dejando la orden en `payment_status: pending` indefinidamente). El
    // timestamp de confirmación queda en `store_transactions` + `updated_at`.
    const { error: updateError } = await supabase
        .from("orders")
        .update({
            payment_status: paymentStatus,
            ...(orderStatus && { status: orderStatus }),
            updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)

    if (updateError) {
        log.error("Failed to update order payment_status", {
            orderId,
            status,
            paymentStatus,
            error: updateError.message,
        })
    }

    // Post-payment side effects cuando el pago se aprueba.
    // Fase 0.4 (Bug H): antes este bloque hacía un SELECT con JOIN a la
    // tabla `order_items` que NO existe en la base. PostgREST devolvía error
    // silencioso, `order` quedaba null, el `if (order)` fallaba y nada de lo
    // de abajo se ejecutaba: ni stock, ni notificación WA, ni Meta CAPI.
    // Ahora leemos items desde `orders.items` (jsonb, source of truth real).
    if (status === "approved") {
        try {
            const { data: order } = await supabase
                .from("orders")
                .select(`
                    id,
                    order_number,
                    total,
                    items,
                    customer_info,
                    utm_data,
                    customers(name, email, phone)
                `)
                .eq("id", orderId)
                .eq("organization_id", organizationId)
                .single()

            if (order) {
                const customer = order.customers as { name?: string; email?: string; phone?: string } | null
                const customerInfo = order.customer_info as {
                    name?: string
                    email?: string
                    phone?: string
                    city?: string
                } | null
                const attribution = getEpaycoOrderAttribution(order.utm_data)

                // Items del jsonb (formato de transformCartItemsToOrderItems)
                const itemsJsonb = Array.isArray(order.items)
                    ? (order.items as Array<{
                        product_id?: string | null
                        product_name?: string | null
                        quantity?: number | null
                    }>)
                    : []

                // 1. Decrementar stock atómicamente con la RPC (Bugs A+B+H)
                const decrementResult = await decrementOrderStock(
                    supabase,
                    orderId,
                    organizationId,
                )
                log.info("Stock decrement result", {
                    orderId,
                    skipped: decrementResult.skipped,
                    reason: decrementResult.reason,
                    itemsProcessed: decrementResult.items.length,
                    oversaleDetected: decrementResult.items.some((item) => !item.wasSufficient),
                })

                // 2. Enviar notificación de venta por WhatsApp
                try {
                    const { sendSaleNotification } = await import("@/lib/notifications/whatsapp")
                    await sendSaleNotification(
                        { organizationId },
                        {
                            id: order.order_number || order.id,
                            total: order.total,
                            customerName: customer?.name || customerInfo?.name || "Cliente",
                            items: itemsJsonb
                                .filter((item) => typeof item.quantity === "number" && item.quantity > 0)
                                .map((item) => ({
                                    name: item.product_name || "Producto",
                                    quantity: item.quantity as number,
                                })),
                        }
                    )
                    log.info("Sale notification sent", { orderNumber: order.order_number })
                } catch (notifError) {
                    log.error("Error sending sale notification", {
                        error: notifError instanceof Error ? notifError.message : String(notifError),
                    })
                }

                // 3. Enviar evento Purchase a Meta Conversions API (server-side tracking)
                try {
                    const { trackServerPurchase } = await import("@/lib/analytics/meta-conversions-api")
                    await trackServerPurchase(
                        organizationId,
                        {
                            id: order.id,
                            orderNumber: order.order_number,
                            total: order.total,
                            currency: "COP",
                            items: itemsJsonb
                                .filter((item) => typeof item.product_id === "string" && typeof item.quantity === "number" && item.quantity > 0)
                                .map((item) => ({
                                    productId: item.product_id as string,
                                    quantity: item.quantity as number,
                                })),
                            customerEmail: customer?.email || customerInfo?.email,
                            customerPhone: customer?.phone || customerInfo?.phone,
                            customerName: customer?.name || customerInfo?.name,
                            customerCity: customerInfo?.city,
                            fbc: attribution.fbc,
                            fbp: attribution.fbp,
                        },
                        supabase
                    )
                    log.info("Meta CAPI Purchase event sent", { orderNumber: order.order_number })
                } catch (capiError) {
                    log.error("Error sending Meta CAPI event", {
                        error: capiError instanceof Error ? capiError.message : String(capiError),
                    })
                }
            } else {
                log.error("Order not found for post-payment processing", { orderId, organizationId })
            }
        } catch (err) {
            log.error("Error in post-payment processing", {
                orderId,
                message: err instanceof Error ? err.message : "Unknown error",
            })
        }
    }
}

async function validateEpaycoOrderPaymentData(
    supabase: SupabaseClient,
    orderId: string,
    organizationId: string,
    payload: EpaycoWebhookPayload
): Promise<boolean> {
    const { data: order, error } = await supabase
        .from("orders")
        .select("id, total")
        .eq("id", orderId)
        .eq("organization_id", organizationId)
        .single()

    if (error || !order) {
        log.error("Order not found for ePayco payment validation", {
            orderId,
            organizationId,
            error: error?.message,
        })
        return false
    }

    const expectedAmount = Math.round(Number(order.total) * 100)
    const paidAmount = Math.round(Number.parseFloat(payload.x_amount) * 100)
    const currency = payload.x_currency_code?.trim().toUpperCase()
    const isValid = Number.isFinite(paidAmount) && expectedAmount === paidAmount && currency === "COP"

    if (!isValid) {
        log.error("Invalid ePayco payment data", {
            orderId,
            organizationId,
            expectedAmount,
            paidAmount,
            currency,
        })
    }

    return isValid
}

/**
 * Registra el evento del webhook en la tabla webhook_logs
 * Columnas reales: webhook_type, event_type, instance_name, payload, headers, processing_result, error_message
 */
async function logWebhook(
    supabase: SupabaseClient,
    webhookType: string,
    processingResult: string,
    payload: unknown,
    response: unknown
) {
    try {
        await supabase.from("webhook_logs").insert({
            webhook_type: webhookType,
            event_type: "payment.updated",
            processing_result: processingResult,
            payload: payload || {},
            headers: response || {},
        })
    } catch (error) {
        log.error("Error logging webhook", { error: error instanceof Error ? error.message : String(error) })
    }
}

function validateEpaycoSignature(
    payload: EpaycoWebhookPayload,
    customerId: string,
    pKey: string
): boolean {
    if (!customerId || !pKey) {
        log.error("Missing P_CUST_ID_CLIENTE or P_KEY for signature validation")
        return false
    }

    // Según docs oficiales de ePayco (https://docs.epayco.com/docs/url-de-confirmacion):
    // hash('sha256', p_cust_id_cliente ^ p_key ^ x_ref_payco ^ x_transaction_id ^ x_amount ^ x_currency_code)
    // Los valores van separados por '^'
    const stringToSign = [
        customerId,
        pKey,
        payload.x_ref_payco,
        payload.x_transaction_id,
        payload.x_amount,
        payload.x_currency_code,
    ].join("^")

    const calculatedSignature = crypto
        .createHash("sha256")
        .update(stringToSign)
        .digest("hex")

    log.debug("Signature validation", {
        customerId: customerId.substring(0, 4) + "***",
        pKey: pKey.substring(0, 4) + "***",
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
