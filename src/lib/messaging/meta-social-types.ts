/**
 * Tipos para Instagram Messaging API y Facebook Messenger Platform
 * 
 * Ambos usan la misma estructura de webhook y Send API vía Graph API v24.0
 * Ref Instagram: https://developers.facebook.com/docs/instagram-api/guides/messaging
 * Ref Messenger: https://developers.facebook.com/docs/messenger-platform
 */

// ============================================
// Webhook payloads entrantes
// ============================================

/**
 * Payload del webhook para Instagram y Messenger
 * La única diferencia es el campo `object`:
 * - "instagram" para Instagram DM
 * - "page" para Facebook Messenger
 */
export interface MetaSocialWebhookPayload {
    object: "instagram" | "page"
    entry: MetaSocialWebhookEntry[]
}

export interface MetaSocialWebhookEntry {
    id: string        // Instagram Account ID o Facebook Page ID
    time: number
    messaging: MetaSocialWebhookMessaging[]
}

export interface MetaSocialWebhookMessaging {
    sender: { id: string }      // IGSID o PSID del remitente
    recipient: { id: string }   // Account/Page ID del destinatario (nosotros)
    timestamp: number
    message?: MetaSocialWebhookMessage
    postback?: MetaSocialWebhookPostback
    read?: { watermark: number }
    reaction?: MetaSocialWebhookReaction
    referral?: MetaSocialWebhookReferral
}

export interface MetaSocialWebhookMessage {
    mid: string
    text?: string
    attachments?: MetaSocialAttachment[]
    is_echo?: boolean
    reply_to?: { mid: string }
    quick_reply?: { payload: string }
}

export interface MetaSocialAttachment {
    type: "image" | "video" | "audio" | "file" | "share" | "story_mention" | "template" | "fallback"
    payload: {
        url?: string
        title?: string
        sticker_id?: number
    }
}

export interface MetaSocialWebhookPostback {
    mid?: string
    title: string
    payload: string
}

export interface MetaSocialWebhookReaction {
    mid: string
    action: "react" | "unreact"
    emoji?: string
    reaction?: string
}

export interface MetaSocialWebhookReferral {
    ref?: string
    source: string
    type: string
}

// ============================================
// Send API payloads
// ============================================

/**
 * Payload para enviar mensajes por Instagram o Messenger
 * Endpoint: POST /{page_id}/messages o /{ig_account_id}/messages
 */
export interface MetaSocialSendPayload {
    recipient: { id: string }
    message: MetaSocialSendMessage
    messaging_type?: "RESPONSE" | "UPDATE" | "MESSAGE_TAG"
    tag?: string
}

export type MetaSocialSendMessage =
    | MetaSocialSendTextMessage
    | MetaSocialSendMediaMessage
    | MetaSocialSendGenericTemplate
    | MetaSocialSendQuickReplies

export interface MetaSocialSendTextMessage {
    text: string
}

export interface MetaSocialSendMediaMessage {
    attachment: {
        type: "image" | "video" | "audio" | "file"
        payload: {
            url: string
            is_reusable?: boolean
        }
    }
}

export interface MetaSocialSendGenericTemplate {
    attachment: {
        type: "template"
        payload: {
            template_type: "generic" | "button"
            elements?: Array<{
                title: string
                subtitle?: string
                image_url?: string
                buttons?: MetaSocialButton[]
            }>
            text?: string
            buttons?: MetaSocialButton[]
        }
    }
}

export interface MetaSocialSendQuickReplies {
    text: string
    quick_replies: Array<{
        content_type: "text"
        title: string
        payload: string
        image_url?: string
    }>
}

export type MetaSocialButton =
    | { type: "web_url"; url: string; title: string }
    | { type: "postback"; title: string; payload: string }

// ============================================
// Send API response
// ============================================

export interface MetaSocialSendResponse {
    recipient_id: string
    message_id: string
}

// ============================================
// Social channel DB row
// ============================================

export interface SocialChannelRow {
    id: string
    organization_id: string
    platform: "instagram" | "messenger"
    platform_page_id: string
    page_access_token: string
    platform_username: string | null
    status: string
    metadata: Record<string, unknown>
}
