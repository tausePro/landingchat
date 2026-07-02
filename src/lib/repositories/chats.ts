/**
 * Repositorio de Chats/Conversaciones
 *
 * Centraliza queries a la tabla `chats`.
 * Siempre recibe el cliente Supabase como parámetro (nunca lo crea).
 * Siempre filtra por organization_id en operaciones de escritura.
 *
 * Conectado actualmente:
 * - (archivo nuevo, aún no conectado a consumidores)
 *
 * Pendiente de migrar:
 * - tool-executor.ts (identifyCustomer, confirmShipping, escalateToHuman, createPaymentLink)
 * - unified.ts (processIncomingMessage, sendWhatsAppResponse, sendSocialResponse, sendResponse)
 * - dashboard/chats/actions.ts, ai-chat/route.ts, webhook-utils.ts, etc.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { logger } from "@/lib/logger"

const log = logger("repositories/chats")

// ============================================
// Queries de lectura
// ============================================

/**
 * Obtener info básica del chat para procesamiento de mensajes (unified.ts)
 */
export async function getChatForProcessing(
    supabase: SupabaseClient,
    chatId: string
): Promise<{ organization_id: string; customer_id: string | null; agent_id: string | null; ai_enabled: boolean } | null> {
    const { data, error } = await supabase
        .from("chats")
        .select("organization_id, customer_id, agent_id, ai_enabled")
        .eq("id", chatId)
        .single()

    if (error || !data) return null
    return data
}

/**
 * Obtener canal y metadata del chat (tool-executor identifyCustomer)
 */
export async function getChatChannelInfo(
    supabase: SupabaseClient,
    chatId: string
): Promise<{ channel: string | null; customer_id: string | null; whatsapp_chat_id: string | null; metadata: Record<string, unknown> | null } | null> {
    const { data } = await supabase
        .from("chats")
        .select("channel, customer_id, whatsapp_chat_id, metadata")
        .eq("id", chatId)
        .single()
    return data || null
}

/**
 * Obtener número de teléfono del chat (para enviar respuesta WhatsApp)
 */
export async function getChatPhoneNumber(
    supabase: SupabaseClient,
    chatId: string
): Promise<{ phone_number: string | null; whatsapp_chat_id: string | null } | null> {
    const { data } = await supabase
        .from("chats")
        .select("phone_number, whatsapp_chat_id")
        .eq("id", chatId)
        .single()
    return data || null
}

/**
 * Obtener social recipient ID del chat (para Instagram/Messenger)
 */
export async function getChatSocialInfo(
    supabase: SupabaseClient,
    chatId: string
): Promise<{ whatsapp_chat_id: string | null; metadata: Record<string, unknown> | null } | null> {
    const { data } = await supabase
        .from("chats")
        .select("whatsapp_chat_id, metadata")
        .eq("id", chatId)
        .single()
    return data || null
}

/**
 * Obtener metadata del chat (para shipping details en checkout)
 */
export async function getChatMetadata(
    supabase: SupabaseClient,
    chatId: string
): Promise<{ metadata: Record<string, unknown> | null; customer_id: string | null; channel: string | null } | null> {
    const { data } = await supabase
        .from("chats")
        .select("metadata, customer_id, channel")
        .eq("id", chatId)
        .single()
    return data || null
}

/**
 * Obtener info del chat para envío de respuesta (unified.ts sendResponse)
 */
export async function getChatForResponse(
    supabase: SupabaseClient,
    chatId: string
): Promise<{ organization_id: string; channel: string | null; phone_number: string | null } | null> {
    const { data } = await supabase
        .from("chats")
        .select("organization_id, channel, phone_number")
        .eq("id", chatId)
        .single()
    return data || null
}

// ============================================
// Queries de escritura
// ============================================

/**
 * Vincular un customer a un chat
 */
export async function linkCustomerToChat(
    supabase: SupabaseClient,
    organizationId: string,
    chatId: string,
    customerId: string
): Promise<boolean> {
    const { error } = await supabase
        .from("chats")
        .update({ customer_id: customerId })
        .eq("id", chatId)
        .eq("organization_id", organizationId)

    if (error) {
        log.error("Error linking customer to chat", { chatId, customerId, error: error.message })
        return false
    }
    return true
}

/**
 * Reasignar todos los chats de un customer a otro (merge de shell customers)
 */
export async function reassignChatsToCustomer(
    supabase: SupabaseClient,
    organizationId: string,
    fromCustomerId: string,
    toCustomerId: string
): Promise<boolean> {
    const { error } = await supabase
        .from("chats")
        .update({ customer_id: toCustomerId })
        .eq("customer_id", fromCustomerId)
        .eq("organization_id", organizationId)

    if (error) {
        log.error("Error reassigning chats", { fromCustomerId, toCustomerId, error: error.message })
        return false
    }
    return true
}

/**
 * Actualizar metadata del chat (merge con metadata existente)
 */
export async function updateChatMetadata(
    supabase: SupabaseClient,
    organizationId: string,
    chatId: string,
    newMetadata: Record<string, unknown>
): Promise<boolean> {
    // Obtener metadata existente primero
    const { data: existing } = await supabase
        .from("chats")
        .select("metadata")
        .eq("id", chatId)
        .single()

    const { error } = await supabase
        .from("chats")
        .update({
            metadata: {
                ...(existing?.metadata || {}),
                ...newMetadata,
            }
        })
        .eq("id", chatId)
        .eq("organization_id", organizationId)

    if (error) {
        log.error("Error updating chat metadata", { chatId, error: error.message })
        return false
    }
    return true
}

/**
 * Actualizar status del chat (para escalamiento a humano)
 */
export async function updateChatStatus(
    supabase: SupabaseClient,
    organizationId: string,
    chatId: string,
    status: string
): Promise<boolean> {
    const { error } = await supabase
        .from("chats")
        .update({ status })
        .eq("id", chatId)
        .eq("organization_id", organizationId)

    if (error) {
        log.error("Error updating chat status", { chatId, status, error: error.message })
        return false
    }
    return true
}

/**
 * Asignar agente a un chat
 */
export async function assignAgentToChat(
    supabase: SupabaseClient,
    organizationId: string,
    chatId: string,
    agentId: string
): Promise<boolean> {
    const { error } = await supabase
        .from("chats")
        .update({ assigned_agent_id: agentId })
        .eq("id", chatId)
        .eq("organization_id", organizationId)

    if (error) {
        log.error("Error assigning agent to chat", { chatId, agentId, error: error.message })
        return false
    }
    return true
}
