/**
 * Servicio de Mensajería Unificada
 * 
 * Maneja mensajes entrantes de múltiples canales (web, WhatsApp)
 * y los procesa con el agente IA de forma consistente.
 */

import { processMessage } from "@/lib/ai/chat-agent"
import { createServiceClient } from "@/lib/supabase/server"
import { sendWhatsAppMessage } from "@/lib/whatsapp"

interface IncomingMessage {
    channel: "web" | "whatsapp"
    chatId: string
    content: string
    metadata?: Record<string, unknown>
}

interface ProcessMessageResult {
    success: boolean
    response?: string
    error?: string
}

/**
 * Procesa un mensaje entrante de cualquier canal
 */
export async function processIncomingMessage(
    message: IncomingMessage
): Promise<ProcessMessageResult> {
    try {
        const supabase = await createServiceClient()

        // Obtener información del chat
        const { data: chat, error: chatError } = await supabase
            .from("chats")
            .select("organization_id, customer_id, agent_id")
            .eq("id", message.chatId)
            .single()

        if (chatError || !chat) {
            return {
                success: false,
                error: "Chat no encontrado",
            }
        }

        // Obtener agente asignado o el agente por defecto de la organización
        let agentId = chat.agent_id

        if (!agentId) {
            const { data: defaultAgent } = await supabase
                .from("agents")
                .select("id")
                .eq("organization_id", chat.organization_id)
                .eq("is_default", true)
                .single()

            agentId = defaultAgent?.id
        }

        if (!agentId) {
            return {
                success: false,
                error: "No hay agente disponible",
            }
        }

        // Procesar mensaje con el agente IA
        const result = await processMessage({
            message: message.content,
            chatId: message.chatId,
            organizationId: chat.organization_id,
            agentId: agentId,
            customerId: chat.customer_id,
        })

        // Enviar respuesta según el canal
        if (message.channel === "whatsapp") {
            await sendWhatsAppResponse(chat.organization_id, message.chatId, result.response)
        }
        // Para web, la respuesta se maneja en el frontend via polling/websockets

        return {
            success: true,
            response: result.response,
        }
    } catch (error) {
        console.error("[Unified Messaging] Error processing message:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Error desconocido",
        }
    }
}

/**
 * Envía una respuesta por WhatsApp
 * Usa el provider agnóstico que decide entre Meta Cloud API o Evolution API
 */
async function sendWhatsAppResponse(
    organizationId: string,
    chatId: string,
    response: string
): Promise<void> {
    try {
        const supabase = await createServiceClient()

        // Obtener número del cliente desde el chat
        const { data: chat } = await supabase
            .from("chats")
            .select("phone_number, whatsapp_chat_id")
            .eq("id", chatId)
            .single()

        const phoneNumber = chat?.phone_number || chat?.whatsapp_chat_id

        if (!phoneNumber) {
            console.error("[Unified Messaging] No phone number in chat:", chatId)
            return
        }

        console.log("[Unified Messaging] Sending WhatsApp message to:", phoneNumber)

        // El provider decide automáticamente si usar Meta Cloud API o Evolution API
        await sendWhatsAppMessage(organizationId, phoneNumber, response)

        console.log("[Unified Messaging] WhatsApp message sent successfully to:", phoneNumber)
    } catch (error) {
        console.error("[Unified Messaging] Error sending WhatsApp response:", error)
    }
}

/**
 * Identifica o crea un cliente basado en su información de contacto
 */
export async function identifyCustomer(
    organizationId: string,
    phone?: string,
    email?: string,
    name?: string
): Promise<{ id: string; isNew: boolean } | null> {
    try {
        const supabase = await createServiceClient()

        if (!phone && !email) {
            return null
        }

        // Buscar cliente existente
        let query = supabase
            .from("customers")
            .select("id")
            .eq("organization_id", organizationId)

        if (phone) {
            query = query.eq("phone", phone)
        } else if (email) {
            query = query.eq("email", email)
        }

        const { data: existing } = await query.single()

        if (existing) {
            // Actualizar última interacción
            await supabase
                .from("customers")
                .update({ last_interaction_at: new Date().toISOString() })
                .eq("id", existing.id)

            return { id: existing.id, isNew: false }
        }

        // Crear nuevo cliente
        const { data: newCustomer, error } = await supabase
            .from("customers")
            .insert({
                organization_id: organizationId,
                phone: phone || null,
                email: email || null,
                name: name || (phone ? `WhatsApp ${phone.slice(-4)}` : "Cliente"),
                source: phone ? "whatsapp" : "web",
                last_interaction_at: new Date().toISOString(),
            })
            .select("id")
            .single()

        if (error) {
            console.error("[Unified Messaging] Error creating customer:", error)
            return null
        }

        return { id: newCustomer.id, isNew: true }
    } catch (error) {
        console.error("[Unified Messaging] Error identifying customer:", error)
        return null
    }
}

/**
 * Envía una respuesta a una conversación específica
 */
export async function sendResponse(
    conversationId: string,
    response: string
): Promise<boolean> {
    try {
        const supabase = await createServiceClient()

        // Obtener información del chat
        const { data: chat } = await supabase
            .from("chats")
            .select("organization_id, channel, phone_number")
            .eq("id", conversationId)
            .single()

        if (!chat) {
            return false
        }

        // Guardar mensaje en la base de datos
        await supabase.from("messages").insert({
            chat_id: conversationId,
            sender_type: "bot",
            content: response,
        })

        // Enviar por el canal correspondiente
        if (chat.channel === "whatsapp") {
            await sendWhatsAppResponse(chat.organization_id, conversationId, response)
        }

        return true
    } catch (error) {
        console.error("[Unified Messaging] Error sending response:", error)
        return false
    }
}
