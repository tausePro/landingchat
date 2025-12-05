/**
 * Webhook Handler para Evolution API (WhatsApp)
 * 
 * Maneja eventos de:
 * - messages.upsert: Mensajes entrantes
 * - connection.update: Cambios de estado de conexión
 * - qrcode.updated: Actualización de código QR
 */

import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { z } from "zod"

// Schema para validar el payload del webhook
const WebhookPayloadSchema = z.object({
    event: z.string(),
    instance: z.string(),
    data: z.record(z.string(), z.unknown()),
    destination: z.string().optional(),
    date_time: z.string().optional(),
    sender: z.string().optional(),
    server_url: z.string().optional(),
    apikey: z.string().optional(),
})

// Schema para mensaje entrante
const IncomingMessageSchema = z.object({
    key: z.object({
        remoteJid: z.string(),
        fromMe: z.boolean(),
        id: z.string(),
    }),
    pushName: z.string().optional(),
    message: z.object({
        conversation: z.string().optional(),
        extendedTextMessage: z.object({
            text: z.string(),
        }).optional(),
    }).optional(),
    messageType: z.string().optional(),
    messageTimestamp: z.union([z.number(), z.string()]).optional(),
})

// Schema para actualización de conexión
const ConnectionUpdateSchema = z.object({
    state: z.enum(["open", "close", "connecting"]),
    statusReason: z.number().optional(),
})

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        
        // Validar estructura básica del webhook
        const validation = WebhookPayloadSchema.safeParse(body)
        if (!validation.success) {
            console.error("[WhatsApp Webhook] Invalid payload:", validation.error)
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
        }

        const { event, instance, data } = validation.data
        console.log(`[WhatsApp Webhook] Event: ${event}, Instance: ${instance}`)

        // Obtener cliente de Supabase con permisos de servicio
        const supabase = await createServiceClient()

        // Buscar la instancia en la base de datos
        const { data: whatsappInstance, error: instanceError } = await supabase
            .from("whatsapp_instances")
            .select("id, organization_id, status")
            .eq("instance_name", instance)
            .single()

        if (instanceError || !whatsappInstance) {
            console.error(`[WhatsApp Webhook] Instance not found: ${instance}`)
            // Retornar 200 para evitar reintentos de Evolution API
            return NextResponse.json({ received: true, warning: "Instance not found" })
        }

        // Procesar según el tipo de evento
        switch (event) {
            case "messages.upsert":
                await handleIncomingMessage(supabase, whatsappInstance, data)
                break

            case "connection.update":
                await handleConnectionUpdate(supabase, whatsappInstance, data)
                break

            case "qrcode.updated":
                // Los QR codes se manejan via polling desde el frontend
                console.log(`[WhatsApp Webhook] QR updated for ${instance}`)
                break

            default:
                console.log(`[WhatsApp Webhook] Unhandled event: ${event}`)
        }

        return NextResponse.json({ received: true })
    } catch (error) {
        console.error("[WhatsApp Webhook] Error:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

interface WhatsAppInstanceRecord {
    id: string
    organization_id: string
    status: string
}

/**
 * Procesa mensajes entrantes de WhatsApp
 */
async function handleIncomingMessage(
    supabase: SupabaseClient,
    instance: WhatsAppInstanceRecord,
    data: Record<string, unknown>
) {
    const validation = IncomingMessageSchema.safeParse(data)
    if (!validation.success) {
        console.error("[WhatsApp Webhook] Invalid message format:", validation.error)
        return
    }

    const message = validation.data

    // Ignorar mensajes enviados por nosotros
    if (message.key.fromMe) {
        return
    }

    // Extraer número de teléfono (remover @s.whatsapp.net)
    const phoneNumber = message.key.remoteJid.replace("@s.whatsapp.net", "")
    
    // Extraer texto del mensaje
    const messageText = message.message?.conversation || 
                       message.message?.extendedTextMessage?.text || 
                       ""

    if (!messageText) {
        console.log("[WhatsApp Webhook] Message without text, skipping")
        return
    }

    console.log(`[WhatsApp Webhook] Message from ${phoneNumber}: ${messageText.substring(0, 50)}...`)

    // Buscar o crear cliente por número de teléfono
    let customer = await findOrCreateCustomer(supabase, instance.organization_id, phoneNumber, message.pushName)

    // Verificar límite de conversaciones del plan
    const canContinue = await checkConversationLimit(supabase, instance.organization_id)
    if (!canContinue) {
        console.log(`[WhatsApp Webhook] Organization ${instance.organization_id} reached conversation limit`)
        // TODO: Enviar mensaje de límite alcanzado
        return
    }

    // Buscar o crear conversación (chat)
    const chat = await findOrCreateChat(supabase, instance.organization_id, customer.id, phoneNumber)

    // Guardar mensaje en la base de datos
    await supabase.from("messages").insert({
        chat_id: chat.id,
        role: "user",
        content: messageText,
        metadata: {
            whatsapp_message_id: message.key.id,
            phone_number: phoneNumber,
            push_name: message.pushName,
        },
    })

    // TODO: Integrar con agente IA para respuesta automática
    // Por ahora solo guardamos el mensaje
}

/**
 * Procesa actualizaciones de estado de conexión
 */
async function handleConnectionUpdate(
    supabase: SupabaseClient,
    instance: WhatsAppInstanceRecord,
    data: Record<string, unknown>
) {
    const validation = ConnectionUpdateSchema.safeParse(data)
    if (!validation.success) {
        console.error("[WhatsApp Webhook] Invalid connection update:", validation.error)
        return
    }

    const { state } = validation.data
    console.log(`[WhatsApp Webhook] Connection state for ${instance.id}: ${state}`)

    // Mapear estado de Evolution a nuestro estado
    const statusMap: Record<string, string> = {
        open: "connected",
        close: "disconnected",
        connecting: "connecting",
    }

    const newStatus = statusMap[state] || "disconnected"

    // Actualizar estado en la base de datos
    await supabase
        .from("whatsapp_instances")
        .update({
            status: newStatus,
            updated_at: new Date().toISOString(),
        })
        .eq("id", instance.id)
}

/**
 * Busca o crea un cliente por número de teléfono
 */
async function findOrCreateCustomer(
    supabase: SupabaseClient,
    organizationId: string,
    phoneNumber: string,
    pushName?: string
) {
    // Buscar cliente existente
    const { data: existing } = await supabase
        .from("customers")
        .select("id, name, phone")
        .eq("organization_id", organizationId)
        .eq("phone", phoneNumber)
        .single()

    if (existing) {
        // Actualizar nombre si tenemos uno nuevo
        if (pushName && !existing.name) {
            await supabase
                .from("customers")
                .update({ name: pushName })
                .eq("id", existing.id)
        }
        return existing
    }

    // Crear nuevo cliente
    const { data: newCustomer, error } = await supabase
        .from("customers")
        .insert({
            organization_id: organizationId,
            phone: phoneNumber,
            name: pushName || `WhatsApp ${phoneNumber.slice(-4)}`,
            source: "whatsapp",
        })
        .select("id, name, phone")
        .single()

    if (error) {
        console.error("[WhatsApp Webhook] Error creating customer:", error)
        throw error
    }

    return newCustomer
}

/**
 * Busca o crea una conversación para el cliente
 */
async function findOrCreateChat(
    supabase: SupabaseClient,
    organizationId: string,
    customerId: string,
    phoneNumber: string
) {
    // Buscar chat activo existente (últimas 24 horas)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    
    const { data: existing } = await supabase
        .from("chats")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("customer_id", customerId)
        .eq("channel", "whatsapp")
        .gte("updated_at", twentyFourHoursAgo)
        .order("updated_at", { ascending: false })
        .limit(1)
        .single()

    if (existing) {
        // Actualizar timestamp
        await supabase
            .from("chats")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", existing.id)
        return existing
    }

    // Crear nuevo chat
    const { data: newChat, error } = await supabase
        .from("chats")
        .insert({
            organization_id: organizationId,
            customer_id: customerId,
            channel: "whatsapp",
            whatsapp_chat_id: phoneNumber,
            status: "active",
        })
        .select("id")
        .single()

    if (error) {
        console.error("[WhatsApp Webhook] Error creating chat:", error)
        throw error
    }

    // Incrementar contador de conversaciones del mes
    await incrementConversationCount(supabase, organizationId)

    return newChat
}

/**
 * Verifica si la organización puede crear más conversaciones
 */
async function checkConversationLimit(
    supabase: SupabaseClient,
    organizationId: string
): Promise<boolean> {
    // Obtener organización con su plan
    const { data: org } = await supabase
        .from("organizations")
        .select(`
            id,
            whatsapp_conversations_used,
            subscriptions!inner(
                plans!inner(max_whatsapp_conversations)
            )
        `)
        .eq("id", organizationId)
        .single()

    if (!org) return false

    const limit = org.subscriptions?.[0]?.plans?.max_whatsapp_conversations || 0
    const used = org.whatsapp_conversations_used || 0

    return used < limit
}

/**
 * Incrementa el contador de conversaciones usadas
 */
async function incrementConversationCount(
    supabase: SupabaseClient,
    organizationId: string
) {
    await supabase.rpc("increment_whatsapp_conversations", {
        org_id: organizationId,
    })
}

// Permitir GET para verificación de webhook
export async function GET() {
    return NextResponse.json({ status: "ok", service: "whatsapp-webhook" })
}
