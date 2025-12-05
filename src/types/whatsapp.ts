/**
 * Tipos y schemas para integración WhatsApp con Evolution API
 */

import { z } from "zod"

// ============================================
// Instancias de WhatsApp
// ============================================

export const WhatsAppInstanceTypeSchema = z.enum(["corporate", "personal"])
export type WhatsAppInstanceType = z.infer<typeof WhatsAppInstanceTypeSchema>

export const WhatsAppInstanceStatusSchema = z.enum([
    "disconnected",
    "connecting",
    "connected",
    "banned",
])
export type WhatsAppInstanceStatus = z.infer<typeof WhatsAppInstanceStatusSchema>

export const WhatsAppInstanceSchema = z.object({
    id: z.string().uuid(),
    organization_id: z.string().uuid(),
    instance_name: z.string(),
    instance_type: WhatsAppInstanceTypeSchema,
    status: WhatsAppInstanceStatusSchema.default("disconnected"),
    phone_number: z.string().nullable().optional(),
    phone_number_display: z.string().nullable().optional(),
    qr_code: z.string().nullable().optional(),
    qr_expires_at: z.string().nullable().optional(),
    connected_at: z.string().nullable().optional(),
    disconnected_at: z.string().nullable().optional(),
    notifications_enabled: z.boolean().default(true),
    notify_on_sale: z.boolean().default(true),
    notify_on_low_stock: z.boolean().default(false),
    notify_on_new_conversation: z.boolean().default(false),
    conversations_this_month: z.number().default(0),
    messages_sent_this_month: z.number().default(0),
    last_message_at: z.string().nullable().optional(),
    created_at: z.string(),
    updated_at: z.string(),
    // Datos de la organización (cuando se hace JOIN)
    organizations: z.object({
        name: z.string(),
        slug: z.string(),
    }).optional(),
})

export type WhatsAppInstance = z.infer<typeof WhatsAppInstanceSchema>

// Input para crear/actualizar instancia
export const CreateWhatsAppInstanceInputSchema = z.object({
    instance_type: WhatsAppInstanceTypeSchema,
})

export const UpdateWhatsAppInstanceInputSchema = z.object({
    notifications_enabled: z.boolean().optional(),
    notify_on_sale: z.boolean().optional(),
    notify_on_low_stock: z.boolean().optional(),
    notify_on_new_conversation: z.boolean().optional(),
})

export type CreateWhatsAppInstanceInput = z.infer<
    typeof CreateWhatsAppInstanceInputSchema
>
export type UpdateWhatsAppInstanceInput = z.infer<
    typeof UpdateWhatsAppInstanceInputSchema
>

// ============================================
// Webhooks de Evolution API
// ============================================

export const EvolutionWebhookEventSchema = z.enum([
    "messages.upsert",
    "connection.update",
    "qrcode.updated",
])
export type EvolutionWebhookEvent = z.infer<typeof EvolutionWebhookEventSchema>

export const EvolutionWebhookSchema = z.object({
    instance: z.string(),
    event: EvolutionWebhookEventSchema,
    data: z.record(z.string(), z.unknown()),
    timestamp: z.number().optional(),
})

export type EvolutionWebhook = z.infer<typeof EvolutionWebhookSchema>

// ============================================
// Mensajes de WhatsApp
// ============================================

export const WhatsAppMessageTypeSchema = z.enum([
    "text",
    "image",
    "document",
    "audio",
    "video",
    "sticker",
])
export type WhatsAppMessageType = z.infer<typeof WhatsAppMessageTypeSchema>

export const WhatsAppMessageSchema = z.object({
    id: z.string(),
    from: z.string(), // Número del remitente
    to: z.string(), // Número del destinatario
    body: z.string(),
    timestamp: z.number(),
    type: WhatsAppMessageTypeSchema.default("text"),
    media_url: z.string().optional(),
    caption: z.string().optional(),
})

export type WhatsAppMessage = z.infer<typeof WhatsAppMessageSchema>

// ============================================
// Configuración de Evolution API
// ============================================

export const EvolutionConfigSchema = z.object({
    url: z.string().url(),
    apiKey: z.string().min(1),
    webhookSecret: z.string().optional(),
})

export type EvolutionConfig = z.infer<typeof EvolutionConfigSchema>

// ============================================
// Respuestas de Evolution API
// ============================================

export interface EvolutionInstance {
    instanceName: string
    status: "open" | "close" | "connecting"
    qrcode?: {
        code: string
        base64: string
    }
    phoneNumber?: string
}

export interface EvolutionConnectionStatus {
    instance: string
    state: "open" | "close" | "connecting"
}

export interface EvolutionSendMessageResponse {
    key: {
        remoteJid: string
        fromMe: boolean
        id: string
    }
    message: Record<string, unknown>
    messageTimestamp: number
    status: string
}

// ============================================
// Canales de comunicación
// ============================================

export const ChannelTypeSchema = z.enum(["web", "whatsapp"])
export type ChannelType = z.infer<typeof ChannelTypeSchema>

// ============================================
// Deserializadores
// ============================================

export function deserializeWhatsAppInstance(
    data: Record<string, unknown>
): WhatsAppInstance {
    return WhatsAppInstanceSchema.parse({
        id: data.id,
        organization_id: data.organization_id,
        instance_name: data.instance_name,
        instance_type: data.instance_type,
        status: data.status ?? "disconnected",
        phone_number: data.phone_number,
        phone_number_display: data.phone_number_display,
        qr_code: data.qr_code,
        qr_expires_at: data.qr_expires_at,
        connected_at: data.connected_at,
        disconnected_at: data.disconnected_at,
        notifications_enabled: data.notifications_enabled ?? true,
        notify_on_sale: data.notify_on_sale ?? true,
        notify_on_low_stock: data.notify_on_low_stock ?? false,
        notify_on_new_conversation: data.notify_on_new_conversation ?? false,
        conversations_this_month: data.conversations_this_month ?? 0,
        messages_sent_this_month: data.messages_sent_this_month ?? 0,
        last_message_at: data.last_message_at,
        created_at: data.created_at,
        updated_at: data.updated_at,
        // Preservar datos de la organización si vienen del JOIN
        organizations: data.organizations as { name: string; slug: string } | undefined,
    })
}

// ============================================
// Utilidades
// ============================================

/**
 * Formatea un número de teléfono para mostrar (últimos 4 dígitos)
 */
export function formatPhoneDisplay(phone: string): string {
    const digits = phone.replace(/\D/g, "")
    if (digits.length < 4) return phone
    return `****${digits.slice(-4)}`
}

/**
 * Hashea un número de teléfono para privacidad
 */
export function hashPhoneNumber(phone: string): string {
    // En producción, usar crypto.createHash('sha256')
    // Por ahora, simplemente limpiamos el número
    return phone.replace(/\D/g, "")
}
