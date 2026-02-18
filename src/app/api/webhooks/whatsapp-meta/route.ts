/**
 * Webhook Handler para Meta Platform (WhatsApp, Instagram DM, Messenger)
 *
 * Maneja:
 * - GET: Verificación de webhook (challenge)
 * - POST: Mensajes entrantes y actualizaciones de estado
 *
 * Soporta tres tipos de object:
 * - whatsapp_business_account: WhatsApp Cloud API
 * - instagram: Instagram DM
 * - page: Facebook Messenger
 *
 * Documentación:
 * - WhatsApp: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
 * - Instagram: https://developers.facebook.com/docs/instagram-api/guides/messaging
 * - Messenger: https://developers.facebook.com/docs/messenger-platform/webhooks
 */

import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { getMetaWhatsAppConfig, findInstanceByMetaPhoneNumberId } from "@/lib/whatsapp"
import type { MetaWebhookPayload, MetaWebhookMessage, MetaWebhookValue } from "@/lib/whatsapp"
import {
    findOrCreateCustomer,
    findOrCreateChat,
    findOrCreateCustomerBySocialId,
    findOrCreateSocialChat,
    checkConversationLimit,
    logWebhook,
    updateWebhookLog,
    verifyMetaSignature,
} from "@/lib/whatsapp/webhook-utils"
import type { MetaSocialWebhookPayload, MetaSocialWebhookMessaging } from "@/lib/messaging/meta-social-types"
import { findSocialChannelByPageId } from "@/lib/messaging/meta-social-client"
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

        const body = JSON.parse(bodyText)

        const supabase = createServiceClient()
        const headers: Record<string, string> = {}
        request.headers.forEach((v, k) => { headers[k] = v })

        // Rutear según el tipo de plataforma
        if (body.object === "whatsapp_business_account") {
            await handleWhatsAppWebhook(supabase, body as MetaWebhookPayload, headers)
        } else if (body.object === "instagram" || body.object === "page") {
            await handleSocialWebhook(supabase, body as MetaSocialWebhookPayload, headers)
        } else {
            log.info("Ignoring unknown event type", { object: body.object })
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
// WhatsApp webhook handler
// ============================================

async function handleWhatsAppWebhook(
    supabase: SupabaseClient,
    body: MetaWebhookPayload,
    headers: Record<string, string>
) {
    for (const entry of body.entry) {
        for (const change of entry.changes) {
            if (change.field !== "messages") continue

            const value = change.value
            const phoneNumberId = value.metadata.phone_number_id

            await logWebhook(supabase, "whatsapp-meta", "messages", phoneNumberId, body, headers)

            const instance = await findInstanceByMetaPhoneNumberId(phoneNumberId)

            if (!instance) {
                log.error("No instance found for phone_number_id", { phoneNumberId })
                await updateWebhookLog(supabase, "whatsapp-meta", phoneNumberId, "warning", "Instance not found")
                continue
            }

            let processingResult: "success" | "warning" | "error" = "success"
            let errorMessage: string | undefined

            try {
                if (value.messages && value.messages.length > 0) {
                    await handleIncomingMessages(supabase, instance.organization_id, value)
                }

                if (value.statuses && value.statuses.length > 0) {
                    await handleStatusUpdates(supabase, value)
                }

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
}

// ============================================
// Instagram / Messenger webhook handler
// ============================================

async function handleSocialWebhook(
    supabase: SupabaseClient,
    body: MetaSocialWebhookPayload,
    headers: Record<string, string>
) {
    const platform = body.object === "instagram" ? "instagram" : "messenger"

    for (const entry of body.entry) {
        const pageId = entry.id

        await logWebhook(supabase, platform, "messaging", pageId, body, headers)

        // Buscar canal social por page ID
        const channel = await findSocialChannelByPageId(pageId, platform)

        if (!channel) {
            log.error(`No ${platform} channel found for page_id`, { pageId })
            await updateWebhookLog(supabase, platform, pageId, "warning", "Channel not found")
            continue
        }

        let processingResult: "success" | "warning" | "error" = "success"
        let errorMessage: string | undefined

        try {
            for (const messaging of entry.messaging || []) {
                await handleSocialMessage(supabase, channel.organization_id, platform, messaging)
            }
        } catch (processingError) {
            processingResult = "error"
            errorMessage = processingError instanceof Error ? processingError.message : String(processingError)
            log.error(`${platform} processing error`, { error: errorMessage })
        }

        await updateWebhookLog(supabase, platform, pageId, processingResult, errorMessage)
    }
}

/**
 * Procesa un mensaje individual de Instagram DM o Messenger
 */
async function handleSocialMessage(
    supabase: SupabaseClient,
    organizationId: string,
    platform: "instagram" | "messenger",
    messaging: MetaSocialWebhookMessaging
) {
    // Ignorar ecos (mensajes que nosotros enviamos)
    if (messaging.message?.is_echo) return

    // Ignorar read receipts
    if (messaging.read) return

    // Ignorar reacciones
    if (messaging.reaction) {
        log.debug(`${platform} reaction received`, { emoji: messaging.reaction.emoji })
        return
    }

    const senderId = messaging.sender.id
    let messageText = ""

    if (messaging.message) {
        const msg = messaging.message
        if (msg.text) {
            messageText = msg.text
        } else if (msg.attachments && msg.attachments.length > 0) {
            const attachment = msg.attachments[0]
            switch (attachment.type) {
                case "image":
                    messageText = "[Imagen recibida]"
                    break
                case "video":
                    messageText = "[Video recibido]"
                    break
                case "audio":
                    messageText = "[Audio recibido]"
                    break
                case "story_mention":
                    messageText = "Me mencionaste en tu historia"
                    break
                case "share":
                    messageText = "[Publicación compartida]"
                    break
                default:
                    messageText = `[${attachment.type} recibido]`
            }
        } else if (msg.quick_reply) {
            messageText = msg.quick_reply.payload
        }
    } else if (messaging.postback) {
        // Postback de botón
        messageText = messaging.postback.payload || messaging.postback.title
    } else if (messaging.referral) {
        messageText = `Hola, vengo de ${messaging.referral.source}`
    }

    if (!messageText) {
        log.debug(`${platform} message without extractable text, skipping`)
        return
    }

    log.info(`${platform} message received`, { from: senderId, preview: messageText.substring(0, 50) })

    // Buscar o crear cliente por social ID
    const customer = await findOrCreateCustomerBySocialId(supabase, organizationId, platform, senderId)

    // Verificar límite de conversaciones
    const canContinue = await checkConversationLimit(supabase, organizationId)
    if (!canContinue) {
        log.warn("Conversation limit reached", { orgId: organizationId })
        return
    }

    // Buscar o crear chat
    const chat = await findOrCreateSocialChat(supabase, organizationId, customer.id, platform, senderId)

    // Guardar mensaje
    await supabase.from("messages").insert({
        chat_id: chat.id,
        sender_type: "user",
        content: messageText,
        metadata: {
            social_message_id: messaging.message?.mid || messaging.postback?.mid,
            platform_user_id: senderId,
            platform,
            message_type: messaging.message ? "message" : messaging.postback ? "postback" : "other",
        },
    })

    // Procesar con agente IA
    log.info(`Processing ${platform} message with AI agent`, { chatId: chat.id })
    const { processIncomingMessage } = await import("@/lib/messaging/unified")
    const result = await processIncomingMessage({
        channel: platform,
        chatId: chat.id,
        content: messageText,
        metadata: {
            social_message_id: messaging.message?.mid,
            platform_user_id: senderId,
            platform,
        },
    })

    if (result.success) {
        log.info(`${platform} AI response sent`, { chatId: chat.id })
    } else {
        log.error(`${platform} AI processing failed`, { chatId: chat.id, error: result.error })
    }
}

// ============================================
// WhatsApp message handling
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
                const btnId = message.interactive.button_reply?.id || ""
                const btnTitle = message.interactive.button_reply?.title || ""
                // Pasar ID como contexto para que el AI sepa qué producto/acción eligió
                if (btnId.startsWith("add_")) {
                    messageText = `Quiero agregar al carrito el producto con ID: ${btnId.replace("add_", "")}`
                } else if (btnId === "checkout") {
                    messageText = "Quiero pagar"
                } else if (btnId === "continue_shopping") {
                    messageText = "Quiero seguir comprando"
                } else if (btnId === "confirm_checkout") {
                    messageText = "Confirmar mis datos de envío"
                } else if (btnId === "modify_cart") {
                    messageText = "Quiero modificar mi carrito"
                } else if (btnId === "more_options") {
                    messageText = "Quiero ver más opciones"
                } else {
                    messageText = btnTitle
                }
            } else if (message.interactive?.type === "list_reply") {
                const listId = message.interactive.list_reply?.id || ""
                const listTitle = message.interactive.list_reply?.title || ""
                if (listId.startsWith("product_")) {
                    messageText = `Quiero ver el producto: ${listTitle} (ID: ${listId.replace("product_", "")})`
                } else {
                    messageText = listTitle
                }
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
