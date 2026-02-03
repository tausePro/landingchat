/**
 * Webhook Handler para Meta WhatsApp Cloud API
 *
 * Maneja:
 * - GET: Verificación de webhook (challenge)
 * - POST: Mensajes entrantes y actualizaciones de estado
 *
 * Documentación: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
 */

import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { getMetaWhatsAppConfig, findInstanceByMetaPhoneNumberId } from "@/lib/whatsapp"
import type { MetaWebhookPayload, MetaWebhookMessage, MetaWebhookValue } from "@/lib/whatsapp"
import {
    findOrCreateCustomer,
    findOrCreateChat,
    checkConversationLimit,
    logWebhook,
    updateWebhookLog,
    verifyMetaSignature,
} from "@/lib/whatsapp/webhook-utils"
import { logger } from "@/lib/logger"

const log = logger("webhooks/whatsapp-meta")

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

// ============================================
// GET — Webhook verification (challenge)
// ============================================

export async function GET(request: NextRequest) {
    const mode = request.nextUrl.searchParams.get("hub.mode")
    const token = request.nextUrl.searchParams.get("hub.verify_token")
    const challenge = request.nextUrl.searchParams.get("hub.challenge")

    log.info("Verification request", { mode, tokenPrefix: token?.substring(0, 8) })

    if (mode !== "subscribe" || !token || !challenge) {
        return new Response("Missing parameters", { status: 400 })
    }

    // Verificar token contra config en system_settings
    const config = await getMetaWhatsAppConfig()

    if (!config) {
        log.error("Meta WhatsApp config not found in system_settings")
        return new Response("Not configured", { status: 500 })
    }

    if (token !== config.verify_token) {
        log.error("Invalid verify token")
        return new Response("Invalid verify token", { status: 403 })
    }

    log.info("Verification successful")
    // Meta espera que devolvamos el challenge como texto plano
    return new Response(challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
    })
}

// ============================================
// POST — Incoming messages & status updates
// ============================================

export async function POST(request: NextRequest) {
    try {
        const bodyText = await request.text()

        // Obtener config para validar firma
        const config = await getMetaWhatsAppConfig()

        if (!config) {
            log.error("Meta WhatsApp config not found")
            // Retornar 200 para que Meta no reintente
            return NextResponse.json({ received: true })
        }

        // Verificar firma X-Hub-Signature-256
        const signature = request.headers.get("x-hub-signature-256")
        if (signature) {
            const isValid = verifyMetaSignature(bodyText, signature, config.app_secret)
            if (!isValid) {
                log.error("Invalid signature")
                return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
            }
        } else {
            log.warn("No signature header received")
        }

        const body = JSON.parse(bodyText) as MetaWebhookPayload

        // Verificar que es un evento de WhatsApp Business Account
        if (body.object !== "whatsapp_business_account") {
            log.info("Ignoring non-WhatsApp event", { object: body.object })
            return NextResponse.json({ received: true })
        }

        const supabase = createServiceClient()

        // Procesar cada entry
        for (const entry of body.entry) {
            for (const change of entry.changes) {
                if (change.field !== "messages") continue

                const value = change.value
                const phoneNumberId = value.metadata.phone_number_id

                // Log del webhook
                const headers: Record<string, string> = {}
                request.headers.forEach((v, k) => { headers[k] = v })
                await logWebhook(supabase, "whatsapp-meta", "messages", phoneNumberId, body, headers)

                // Buscar instancia por meta_phone_number_id
                const instance = await findInstanceByMetaPhoneNumberId(phoneNumberId)

                if (!instance) {
                    log.error("No instance found for phone_number_id", { phoneNumberId })
                    await updateWebhookLog(supabase, "whatsapp-meta", phoneNumberId, "warning", "Instance not found")
                    continue
                }

                let processingResult: "success" | "warning" | "error" = "success"
                let errorMessage: string | undefined

                try {
                    // Procesar mensajes entrantes
                    if (value.messages && value.messages.length > 0) {
                        await handleIncomingMessages(supabase, instance.organization_id, value)
                    }

                    // Procesar actualizaciones de estado
                    if (value.statuses && value.statuses.length > 0) {
                        await handleStatusUpdates(supabase, value)
                    }

                    // Procesar errores
                    if (value.errors && value.errors.length > 0) {
                        for (const error of value.errors) {
                            log.error("Error from Meta", { code: error.code, title: error.title, message: error.message })
                        }
                        processingResult = "warning"
                        errorMessage = value.errors.map(e => `${e.code}: ${e.title}`).join(", ")
                    }
                } catch (processingError) {
                    processingResult = "error"
                    errorMessage = processingError instanceof Error ? processingError.message : String(processingError)
                    log.error("Processing error", { error: errorMessage })
                }

                await updateWebhookLog(supabase, "whatsapp-meta", phoneNumberId, processingResult, errorMessage)
            }
        }

        // Meta requiere respuesta 200 rápida
        return NextResponse.json({ received: true })
    } catch (error) {
        log.error("Unhandled error", { error: error instanceof Error ? error.message : String(error) })
        // Siempre responder 200 para evitar reintentos de Meta
        return NextResponse.json({ received: true })
    }
}

// ============================================
// Message handling
// ============================================

async function handleIncomingMessages(
    supabase: SupabaseClient,
    organizationId: string,
    value: MetaWebhookValue
) {
    const contactName = value.contacts?.[0]?.profile?.name

    for (const message of value.messages || []) {
        await handleSingleMessage(supabase, organizationId, message, contactName)
    }
}

async function handleSingleMessage(
    supabase: SupabaseClient,
    organizationId: string,
    message: MetaWebhookMessage,
    contactName?: string
) {
    // Extraer texto del mensaje según el tipo
    let messageText = ""

    switch (message.type) {
        case "text":
            messageText = message.text?.body || ""
            break
        case "image":
            messageText = message.image?.caption || "[Imagen recibida]"
            break
        case "video":
            messageText = message.video?.caption || "[Video recibido]"
            break
        case "audio":
            messageText = "[Audio recibido]"
            break
        case "document":
            messageText = message.document?.caption || `[Documento: ${message.document?.filename || "archivo"}]`
            break
        case "location":
            messageText = `[Ubicación: ${message.location?.name || ""} ${message.location?.address || ""}]`.trim()
            break
        case "sticker":
            messageText = "[Sticker recibido]"
            break
        case "interactive":
            if (message.interactive?.type === "button_reply") {
                messageText = message.interactive.button_reply?.title || ""
            } else if (message.interactive?.type === "list_reply") {
                messageText = message.interactive.list_reply?.title || ""
            }
            break
        case "button":
            messageText = message.button?.text || ""
            break
        case "reaction":
            log.debug("Reaction received", { emoji: message.reaction?.emoji, messageId: message.reaction?.message_id })
            return
        default:
            log.info("Unsupported message type", { type: message.type })
            messageText = `[${message.type} no soportado]`
    }

    if (!messageText) {
        log.debug("Message without extractable text, skipping")
        return
    }

    const phoneNumber = message.from
    log.info("Message received", { from: phoneNumber, preview: messageText.substring(0, 50) })

    // Buscar o crear cliente
    const customer = await findOrCreateCustomer(supabase, organizationId, phoneNumber, contactName)

    // Verificar límite de conversaciones
    const canContinue = await checkConversationLimit(supabase, organizationId)
    if (!canContinue) {
        log.warn("Conversation limit reached", { orgId: organizationId })
        // TODO: Enviar template de límite alcanzado
        return
    }

    // Buscar o crear chat
    const chat = await findOrCreateChat(supabase, organizationId, customer.id, phoneNumber)

    // Guardar mensaje en la base de datos
    await supabase.from("messages").insert({
        chat_id: chat.id,
        sender_type: "user",
        content: messageText,
        metadata: {
            whatsapp_message_id: message.id,
            phone_number: phoneNumber,
            push_name: contactName,
            message_type: message.type,
            provider: "meta",
        },
    })

    // Procesar mensaje con el agente IA
    log.info("Processing with AI agent", { chatId: chat.id })
    const { processIncomingMessage } = await import("@/lib/messaging/unified")
    const result = await processIncomingMessage({
        channel: "whatsapp",
        chatId: chat.id,
        content: messageText,
        metadata: {
            whatsapp_message_id: message.id,
            phone_number: phoneNumber,
            push_name: contactName,
            provider: "meta",
        },
    })

    if (result.success) {
        log.info("AI response sent", { chatId: chat.id })
    } else {
        log.error("AI processing failed", { chatId: chat.id, error: result.error })
    }
}

// ============================================
// Status updates
// ============================================

async function handleStatusUpdates(
    supabase: SupabaseClient,
    value: MetaWebhookValue
) {
    for (const status of value.statuses || []) {
        log.debug("Message status update", {
            messageId: status.id,
            recipientId: status.recipient_id,
            status: status.status,
            ...(status.pricing ? { pricingCategory: status.pricing.category, billable: status.pricing.billable } : {}),
        })

        // Si el mensaje falló, loggearlo
        if (status.status === "failed" && status.errors) {
            for (const error of status.errors) {
                log.error("Message delivery failed", { code: error.code, title: error.title, message: error.message })
            }
        }

        // TODO: Actualizar estado del mensaje en la DB si lo necesitamos
        // (delivered, read, failed)
    }
}
