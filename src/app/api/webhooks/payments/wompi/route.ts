/**
 * Webhook handler para notificaciones de Wompi
 * Recibe eventos de transacciones y actualiza el estado de órdenes
 */

import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { decrypt } from "@/lib/utils/encryption"
import { WompiGateway } from "@/lib/payments/wompi-gateway"
import { logger } from "@/lib/logger"
import { decrementOrderStock } from "@/lib/commerce/decrementOrderStock"

const log = logger("webhooks/payments/wompi")

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getOptionalString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined
}

function getWompiOrderAttribution(value: unknown): { fbc?: string; fbp?: string } {
    if (!isRecord(value)) return {}

    return {
        fbc: getOptionalString(value.fbc) || getOptionalString(value._fbc),
        fbp: getOptionalString(value.fbp) || getOptionalString(value._fbp),
    }
}

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

interface OrderPaymentState {
    id: string
    status: string | null
    payment_status: string | null
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

    const { data: orderStateData, error: orderStateError } = await supabase
        .from("orders")
        .select("id, status, payment_status")
        .eq("id", orderId)
        .eq("organization_id", organizationId)
        .single()

    if (orderStateError || !orderStateData) {
        log.error("Order not found before payment status update", {
            orderId,
            organizationId,
            error: orderStateError?.message,
        })
        return
    }

    const orderState = orderStateData as OrderPaymentState
    const shouldUpdateOrder =
        orderState.payment_status !== paymentStatus ||
        (typeof orderStatus === "string" && orderState.status !== orderStatus)

    let updateSucceeded = !shouldUpdateOrder

    // Fase 0.4 post-mortem (hotfix v1.10.58): removimos `confirmed_at` del
    // UPDATE porque la columna NO existe en `public.orders` y el UPDATE entero
    // fallaba silenciosamente (PostgREST retornaba error sin capturarse,
    // dejando la orden en `payment_status: pending` indefinidamente). El
    // timestamp de confirmación queda en `store_transactions` + `updated_at`.
    if (shouldUpdateOrder) {
        const { error: updateError } = await supabase
            .from("orders")
            .update({
                payment_status: paymentStatus,
                ...(orderStatus && { status: orderStatus }),
                updated_at: new Date().toISOString(),
            })
            .eq("id", orderId)
            .eq("organization_id", organizationId)

        if (updateError) {
            // No interrumpimos el resto del flow (notificación/stock) porque
            // puede ser un error transitorio, pero lo dejamos visible para
            // monitoreo. Si la orden no se actualizó, el gateway probablemente
            // reintente y la siguiente pasada sí persistirá.
            log.error("Failed to update order payment_status", {
                orderId,
                status,
                paymentStatus,
                error: updateError.message,
            })
        } else {
            updateSucceeded = true
        }
    }

    // Post-payment side effects cuando el pago se aprueba.
    // Fase 0.4 (Bug H): antes este bloque hacía un SELECT con JOIN a la
    // tabla `order_items` que NO existe en la base. PostgREST devolvía error
    // silencioso, `order` quedaba null, el `if (order)` fallaba y nada de lo
    // de abajo se ejecutaba: ni stock, ni notificación WA, ni Meta CAPI.
    // Ahora leemos items desde `orders.items` (jsonb, source of truth real).
    if (status === "approved" && orderState.payment_status !== "paid" && updateSucceeded) {
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
                    state?: string
                } | null
                const attribution = getWompiOrderAttribution(order.utm_data)

                // Items del jsonb (formato de transformCartItemsToOrderItems)
                const itemsJsonb = Array.isArray(order.items)
                    ? (order.items as Array<{
                        product_id?: string | null
                        product_name?: string | null
                        quantity?: number | null
                        unit_price?: number | null
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
                    log.info("Sale notification sent", {
                        orderId,
                        orderNumber: order.order_number,
                    })
                } catch (notifError) {
                    log.error("Error sending sale notification", {
                        orderId,
                        message: notifError instanceof Error ? notifError.message : "Unknown error",
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
                                    unitPrice: typeof item.unit_price === "number" ? item.unit_price : undefined,
                                })),
                            customerEmail: customer?.email || customerInfo?.email,
                            customerPhone: customer?.phone || customerInfo?.phone,
                            customerName: customer?.name || customerInfo?.name,
                            customerCity: customerInfo?.city,
                            customerState: customerInfo?.state,
                            fbc: attribution.fbc,
                            fbp: attribution.fbp,
                        },
                        supabase
                    )
                    log.info("Meta CAPI Purchase event sent", {
                        orderId,
                        orderNumber: order.order_number,
                    })
                } catch (capiError) {
                    log.error("Error sending Meta CAPI event", {
                        orderId,
                        message: capiError instanceof Error ? capiError.message : "Unknown error",
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
