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
    try {
        const url = new URL(request.url)
        const orgSlug = url.searchParams.get("org")

        if (!orgSlug) {
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
            .eq("provider", "epayco")
            .single()

        if (!config) {
            return NextResponse.json(
                { error: "Payment gateway not configured" },
                { status: 400 }
            )
        }

        // Validar firma del webhook
        const privateKey = config.private_key_encrypted
            ? decrypt(config.private_key_encrypted)
            : ""

        const isValid = validateEpaycoSignature(payload, config.public_key || "", privateKey)
        if (!isValid) {
            console.error("Invalid webhook signature")
            return NextResponse.json(
                { error: "Invalid signature" },
                { status: 401 }
            )
        }

        // Procesar el evento
        const status = mapEpaycoStatus(payload.x_cod_response)
        const reference = payload.x_id_invoice || payload.x_extra1 // Usamos x_extra1 como referencia alternativa

        // Buscar la transacción en nuestra base de datos
        const { data: existingTx } = await supabase
            .from("store_transactions")
            .select("id, order_id")
            .eq("provider_reference", reference)
            .eq("organization_id", org.id)
            .single()

        if (existingTx) {
            // Actualizar transacción existente
            await supabase
                .from("store_transactions")
                .update({
                    status,
                    provider_transaction_id: payload.x_ref_payco,
                    provider_response: payload,
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

                // Enviar notificación de venta si el pago fue aprobado
                if (status === "approved") {
                    try {
                        const { data: order } = await supabase
                            .from("orders")
                            .select(`
                                id,
                                total,
                                customers!inner(name),
                                order_items(
                                    quantity,
                                    products!inner(name)
                                )
                            `)
                            .eq("id", existingTx.order_id)
                            .single()

                        if (order) {
                            const { sendSaleNotification } = await import("@/lib/notifications/whatsapp")
                            const customer = order.customers as any
                            const orderItems = order.order_items as any[]
                            
                            await sendSaleNotification(
                                { organizationId: org.id },
                                {
                                    id: order.id,
                                    total: order.total,
                                    customerName: customer?.name || "Cliente",
                                    items: orderItems?.map((item: any) => ({
                                        name: item.products?.name || "Producto",
                                        quantity: item.quantity,
                                    })) || [],
                                }
                            )
                        }
                    } catch (notifError) {
                        console.error("Error sending sale notification:", notifError)
                        // No fallar el webhook si la notificación falla
                    }
                }
            }
        } else {
            // Crear nueva transacción si no existe
            await supabase.from("store_transactions").insert({
                organization_id: org.id,
                amount: Math.round(parseFloat(payload.x_amount) * 100), // Convertir a centavos
                currency: payload.x_currency_code,
                status,
                provider: "epayco",
                provider_transaction_id: payload.x_ref_payco,
                provider_reference: reference,
                provider_response: payload,
                payment_method: payload.x_franchise?.toLowerCase() || "card",
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

function validateEpaycoSignature(
    payload: EpaycoWebhookPayload,
    publicKey: string,
    privateKey: string
): boolean {
    // ePayco signature: SHA256(p_cust_id_cliente + p_key + x_ref_payco + x_transaction_id + x_amount + x_currency_code)
    const stringToSign = [
        publicKey,
        privateKey,
        payload.x_ref_payco,
        payload.x_transaction_id,
        payload.x_amount,
        payload.x_currency_code,
    ].join("")

    const calculatedSignature = crypto
        .createHash("sha256")
        .update(stringToSign)
        .digest("hex")

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
