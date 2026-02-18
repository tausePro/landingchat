/**
 * Cliente para enviar mensajes por Instagram DM y Facebook Messenger
 * 
 * Usa la Graph API v24.0 de Meta. Ambas plataformas comparten
 * el mismo endpoint y formato de Send API.
 * 
 * Instagram: POST /{ig_account_id}/messages
 * Messenger: POST /{page_id}/messages
 * 
 * Ref: https://developers.facebook.com/docs/instagram-api/guides/messaging
 * Ref: https://developers.facebook.com/docs/messenger-platform/send-messages
 */

import { createServiceClient } from "@/lib/supabase/server"
import type {
    SocialChannelRow,
    MetaSocialSendPayload,
    MetaSocialSendResponse,
    MetaSocialButton,
} from "./meta-social-types"

const META_GRAPH_API_BASE = "https://graph.facebook.com/v24.0"

// ============================================
// Enviar mensajes
// ============================================

/**
 * Envía un mensaje de texto por Instagram DM o Messenger
 */
export async function sendSocialMessage(
    organizationId: string,
    platform: "instagram" | "messenger",
    recipientId: string,
    text: string
): Promise<{ messageId?: string }> {
    const channel = await getConnectedSocialChannel(organizationId, platform)

    const payload: MetaSocialSendPayload = {
        recipient: { id: recipientId },
        message: { text },
        messaging_type: "RESPONSE",
    }

    const response = await sendWithRetry(channel, payload)
    return { messageId: response.message_id }
}

/**
 * Envía una imagen por Instagram DM o Messenger
 */
export async function sendSocialImage(
    organizationId: string,
    platform: "instagram" | "messenger",
    recipientId: string,
    imageUrl: string,
    caption?: string
): Promise<{ messageId?: string }> {
    const channel = await getConnectedSocialChannel(organizationId, platform)

    // Enviar caption como texto si existe
    if (caption) {
        const textPayload: MetaSocialSendPayload = {
            recipient: { id: recipientId },
            message: { text: caption },
            messaging_type: "RESPONSE",
        }
        await sendWithRetry(channel, textPayload)
    }

    // Enviar imagen
    const payload: MetaSocialSendPayload = {
        recipient: { id: recipientId },
        message: {
            attachment: {
                type: "image",
                payload: { url: imageUrl, is_reusable: true },
            },
        },
        messaging_type: "RESPONSE",
    }

    const response = await sendWithRetry(channel, payload)
    return { messageId: response.message_id }
}

/**
 * Envía quick replies (botones inline) por Instagram DM o Messenger
 * Máximo 13 quick replies
 */
export async function sendSocialQuickReplies(
    organizationId: string,
    platform: "instagram" | "messenger",
    recipientId: string,
    text: string,
    buttons: Array<{ id: string; title: string }>
): Promise<{ messageId?: string }> {
    const channel = await getConnectedSocialChannel(organizationId, platform)

    const payload: MetaSocialSendPayload = {
        recipient: { id: recipientId },
        message: {
            text,
            quick_replies: buttons.slice(0, 13).map(b => ({
                content_type: "text" as const,
                title: b.title.substring(0, 20),
                payload: b.id,
            })),
        },
        messaging_type: "RESPONSE",
    }

    const response = await sendWithRetry(channel, payload)
    return { messageId: response.message_id }
}

/**
 * Envía un template genérico (carrusel de tarjetas) por Messenger
 * Instagram no soporta templates genéricos, solo quick replies
 */
export async function sendSocialGenericTemplate(
    organizationId: string,
    platform: "instagram" | "messenger",
    recipientId: string,
    elements: Array<{
        title: string
        subtitle?: string
        imageUrl?: string
        buttons?: Array<{ title: string; payload: string }>
    }>
): Promise<{ messageId?: string }> {
    const channel = await getConnectedSocialChannel(organizationId, platform)

    // Instagram no soporta generic templates, usar texto + quick replies como fallback
    if (platform === "instagram") {
        const text = elements.map(e =>
            `• *${e.title}*${e.subtitle ? ` - ${e.subtitle}` : ""}`
        ).join("\n")

        const quickReplies = elements.slice(0, 13).map(e => ({
            content_type: "text" as const,
            title: e.title.substring(0, 20),
            payload: `select_${e.title}`,
        }))

        const payload: MetaSocialSendPayload = {
            recipient: { id: recipientId },
            message: { text, quick_replies: quickReplies },
            messaging_type: "RESPONSE",
        }

        const response = await sendWithRetry(channel, payload)
        return { messageId: response.message_id }
    }

    // Messenger soporta generic templates completos
    const buttons: MetaSocialButton[] = []
    const payload: MetaSocialSendPayload = {
        recipient: { id: recipientId },
        message: {
            attachment: {
                type: "template",
                payload: {
                    template_type: "generic",
                    elements: elements.slice(0, 10).map(e => {
                        const elementButtons: MetaSocialButton[] = (e.buttons || []).slice(0, 3).map(b => ({
                            type: "postback" as const,
                            title: b.title.substring(0, 20),
                            payload: b.payload,
                        }))
                        return {
                            title: e.title.substring(0, 80),
                            subtitle: e.subtitle?.substring(0, 80),
                            image_url: e.imageUrl,
                            buttons: elementButtons.length > 0 ? elementButtons : buttons,
                        }
                    }),
                },
            },
        },
        messaging_type: "RESPONSE",
    }

    const response = await sendWithRetry(channel, payload)
    return { messageId: response.message_id }
}

// ============================================
// Helpers internos
// ============================================

/**
 * Obtiene el canal social conectado de la organización
 */
async function getConnectedSocialChannel(
    organizationId: string,
    platform: "instagram" | "messenger"
): Promise<SocialChannelRow> {
    const supabase = await createServiceClient()

    const { data: channel, error } = await supabase
        .from("social_channels")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("platform", platform)
        .eq("status", "connected")
        .single()

    if (error || !channel) {
        throw new Error(`No hay canal de ${platform} conectado para esta organización`)
    }

    return channel as SocialChannelRow
}

/**
 * Envía un mensaje con reintentos y backoff exponencial
 */
async function sendWithRetry(
    channel: SocialChannelRow,
    payload: MetaSocialSendPayload,
    maxRetries = 3
): Promise<MetaSocialSendResponse> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fetch(
                `${META_GRAPH_API_BASE}/${channel.platform_page_id}/messages`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${channel.page_access_token}`,
                    },
                    body: JSON.stringify(payload),
                }
            )

            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}))
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const errorMsg = (errorBody as any)?.error?.message || `HTTP ${response.status}`
                const error = new Error(`Meta Send API error (${response.status}): ${errorMsg}`)

                // No reintentar errores 4xx (excepto 429 rate limit)
                if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                    throw error
                }
                lastError = error
            } else {
                const data = await response.json()
                console.log(`[MetaSocialClient] Message sent via ${channel.platform}:`, data.message_id)
                return data as MetaSocialSendResponse
            }
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error))
            if (lastError.message.includes("Meta Send API error (4") && !lastError.message.includes("(429)")) {
                throw lastError
            }
        }

        if (attempt < maxRetries - 1) {
            const delay = Math.pow(2, attempt) * 1000
            console.log(`[MetaSocialClient] Retry ${attempt + 1}/${maxRetries} in ${delay}ms`)
            await new Promise(resolve => setTimeout(resolve, delay))
        }
    }

    throw lastError || new Error("Failed to send message after retries")
}

/**
 * Busca el canal social por platform_page_id (usado por el webhook para identificar la org)
 */
export async function findSocialChannelByPageId(
    platformPageId: string,
    platform: "instagram" | "messenger"
): Promise<SocialChannelRow | null> {
    const supabase = await createServiceClient()

    const { data: channel } = await supabase
        .from("social_channels")
        .select("*")
        .eq("platform_page_id", platformPageId)
        .eq("platform", platform)
        .eq("status", "connected")
        .single()

    return (channel as SocialChannelRow) || null
}
