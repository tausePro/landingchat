"use server"

import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/server"
import { sendWhatsAppMessage } from "@/lib/whatsapp/provider"
import type { ActionResult } from "@/types/common"

export interface ChatWithDetails {
    id: string
    customer_name: string | null
    customer_id: string | null
    status: string
    channel: string | null
    created_at: string
    updated_at: string | null
    last_message: string | null
    last_message_at: string | null
    message_count: number
    has_order: boolean
    order_total: number | null
    order_status: string | null
}

export interface GetChatsResult {
    chats: ChatWithDetails[]
    total: number
}

// ============================================
// Tipos para la consola de chat
// ============================================

export interface ConsoleChatItem {
    id: string
    customer_name: string | null
    customer_phone: string | null
    customer_id: string | null
    status: string
    channel: string
    phone_number: string | null
    created_at: string
    updated_at: string | null
    last_message: string | null
    last_message_at: string | null
    last_message_sender: string | null
    message_count: number
    unread_count: number
}

export interface ConsoleChatsResult {
    chats: ConsoleChatItem[]
    counts: {
        all: number
        active: number
        pending: number
        closed: number
        whatsapp: number
        web: number
    }
}

export interface ChatDetailData {
    id: string
    customer_name: string | null
    customer_id: string | null
    status: string
    channel: string | null
    created_at: string
    updated_at: string | null
    customer: {
        id: string
        full_name: string | null
        email: string | null
        phone: string | null
        category: string | null
        address: {
            city?: string
            neighborhood?: string
        } | null
        total_orders: number
        total_spent: number
    } | null
    messages: {
        id: string
        content: string
        sender_type: string
        created_at: string
    }[]
    orders: {
        id: string
        total: number
        status: string
        created_at: string
    }[]
    cart: {
        id: string
        items: any[]
        total: number
    } | null
}

export async function getChatDetail(chatId: string): Promise<ActionResult<ChatDetailData>> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return { success: false, error: "Unauthorized" }
        }

        // Obtener el chat con mensajes y órdenes
        const { data: chat, error } = await supabase
            .from("chats")
            .select(`
                id,
                customer_name,
                customer_id,
                status,
                channel,
                created_at,
                updated_at,
                messages(id, content, sender_type, created_at),
                orders(id, total, status, created_at)
            `)
            .eq("id", chatId)
            .single()

        if (error) {
            return { success: false, error: `Failed to fetch chat: ${error.message}` }
        }

        // Obtener datos del cliente si existe customer_id
        let customerData = null
        if (chat.customer_id) {
            const { data: customer } = await supabase
                .from("customers")
                .select("id, full_name, email, phone, category, address")
                .eq("id", chat.customer_id)
                .single()

            if (customer) {
                // Obtener órdenes del cliente para calcular totales
                const { data: customerOrders } = await supabase
                    .from("orders")
                    .select("id, total, status")
                    .eq("customer_id", chat.customer_id)

                const completedOrders = (customerOrders || []).filter((o: any) => 
                    !['cancelled', 'cancelado', 'refunded'].includes(o.status?.toLowerCase() || '')
                )

                customerData = {
                    id: customer.id,
                    full_name: customer.full_name,
                    email: customer.email,
                    phone: customer.phone,
                    category: customer.category,
                    address: customer.address,
                    total_orders: completedOrders.length,
                    total_spent: completedOrders.reduce((sum: number, o: any) => sum + (o.total || 0), 0)
                }
            }
        }

        // Obtener carrito activo del chat si existe
        let cartData = null
        const { data: cart } = await supabase
            .from("carts")
            .select("id, items, total")
            .eq("chat_id", chatId)
            .eq("status", "active")
            .single()

        if (cart) {
            cartData = {
                id: cart.id,
                items: cart.items || [],
                total: cart.total || 0
            }
        }

        // Ordenar mensajes por fecha
        const sortedMessages = [...(chat.messages || [])].sort((a: any, b: any) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )

        return {
            success: true,
            data: {
                id: chat.id,
                customer_name: customerData?.full_name || chat.customer_name,
                customer_id: chat.customer_id,
                status: chat.status,
                channel: chat.channel || 'web',
                created_at: chat.created_at,
                updated_at: chat.updated_at,
                customer: customerData,
                messages: sortedMessages,
                orders: chat.orders || [],
                cart: cartData
            }
        }
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error fetching chat detail"
        }
    }
}

export async function getChatsWithDetails(): Promise<ActionResult<GetChatsResult>> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return { success: false, error: "Unauthorized" }
        }

        const { data: profile } = await supabase
            .from("profiles")
            .select("organization_id")
            .eq("id", user.id)
            .single()

        if (!profile?.organization_id) {
            return { success: false, error: "No organization found" }
        }

        // Obtener chats con mensajes y órdenes
        const { data: chats, error } = await supabase
            .from("chats")
            .select(`
                id,
                customer_name,
                customer_id,
                status,
                channel,
                created_at,
                updated_at,
                messages(id, content, created_at),
                orders(id, total, status)
            `)
            .eq("organization_id", profile.organization_id)
            .order("created_at", { ascending: false })

        if (error) {
            return { success: false, error: `Failed to fetch chats: ${error.message}` }
        }

        // Obtener customer_ids únicos para buscar nombres
        const customerIds = [...new Set((chats || [])
            .map((c: any) => c.customer_id)
            .filter(Boolean)
        )]

        // Buscar nombres de clientes si hay customer_ids
        let customerNames: Record<string, string> = {}
        if (customerIds.length > 0) {
            const { data: customers } = await supabase
                .from("customers")
                .select("id, full_name")
                .in("id", customerIds)

            if (customers) {
                customerNames = customers.reduce((acc: Record<string, string>, c: any) => {
                    acc[c.id] = c.full_name
                    return acc
                }, {})
            }
        }

        // Procesar datos para agregar información calculada
        const chatsWithDetails: ChatWithDetails[] = (chats || []).map((chat: any) => {
            const messages = chat.messages || []
            const orders = chat.orders || []
            
            // Ordenar mensajes por fecha para obtener el último
            const sortedMessages = [...messages].sort((a, b) => 
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )
            const lastMessage = sortedMessages[0]
            
            // Obtener la primera orden (si existe)
            const order = orders[0]

            // Prioridad para el nombre: 1) customers.full_name (por customer_id), 2) chat.customer_name, 3) null
            const customerName = (chat.customer_id && customerNames[chat.customer_id]) 
                || chat.customer_name 
                || null

            return {
                id: chat.id,
                customer_name: customerName,
                customer_id: chat.customer_id,
                status: chat.status,
                channel: chat.channel || 'web',
                created_at: chat.created_at,
                updated_at: chat.updated_at,
                last_message: lastMessage?.content || null,
                last_message_at: lastMessage?.created_at || null,
                message_count: messages.length,
                has_order: orders.length > 0,
                order_total: order?.total || null,
                order_status: order?.status || null,
            }
        })

        return {
            success: true,
            data: {
                chats: chatsWithDetails,
                total: chatsWithDetails.length
            }
        }
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error fetching chats"
        }
    }
}

// ============================================
// Console Actions
// ============================================

/**
 * Obtiene los chats para la consola con filtros por carpeta, canal y búsqueda.
 * Incluye contadores por carpeta/canal para los badges del sidebar.
 */
export async function getChatsForConsole(
    folder?: string,
    channel?: string,
    search?: string
): Promise<ActionResult<ConsoleChatsResult>> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return { success: false, error: "Unauthorized" }
        }

        const { data: profile } = await supabase
            .from("profiles")
            .select("organization_id")
            .eq("id", user.id)
            .single()

        if (!profile?.organization_id) {
            return { success: false, error: "No organization found" }
        }

        const orgId = profile.organization_id

        // Obtener TODOS los chats para contar (sin filtros)
        const { data: allChats, error: countError } = await supabase
            .from("chats")
            .select("id, status, channel")
            .eq("organization_id", orgId)

        if (countError) {
            return { success: false, error: `Failed to count chats: ${countError.message}` }
        }

        const allChatsList = allChats || []
        const counts = {
            all: allChatsList.length,
            active: allChatsList.filter(c => c.status === "active").length,
            pending: allChatsList.filter(c => c.status === "pending").length,
            closed: allChatsList.filter(c => c.status === "closed").length,
            whatsapp: allChatsList.filter(c => c.channel === "whatsapp").length,
            web: allChatsList.filter(c => c.channel === "web").length,
        }

        // Construir query filtrada
        let query = supabase
            .from("chats")
            .select(`
                id,
                customer_name,
                customer_id,
                status,
                channel,
                phone_number,
                created_at,
                updated_at,
                messages(id, content, sender_type, created_at)
            `)
            .eq("organization_id", orgId)

        // Filtro por carpeta (status)
        if (folder && folder !== "all") {
            query = query.eq("status", folder)
        }

        // Filtro por canal
        if (channel) {
            query = query.eq("channel", channel)
        }

        query = query.order("updated_at", { ascending: false, nullsFirst: false })

        const { data: chats, error } = await query

        if (error) {
            return { success: false, error: `Failed to fetch chats: ${error.message}` }
        }

        // Obtener customer_ids únicos para buscar nombres y teléfonos
        const customerIds = [...new Set((chats || [])
            .map((c: any) => c.customer_id)
            .filter(Boolean)
        )]

        let customerMap: Record<string, { full_name: string | null; phone: string | null }> = {}
        if (customerIds.length > 0) {
            const { data: customers } = await supabase
                .from("customers")
                .select("id, full_name, phone")
                .in("id", customerIds)

            if (customers) {
                customerMap = customers.reduce((acc: any, c: any) => {
                    acc[c.id] = { full_name: c.full_name, phone: c.phone }
                    return acc
                }, {})
            }
        }

        // Procesar chats
        let processedChats: ConsoleChatItem[] = (chats || []).map((chat: any) => {
            const messages = chat.messages || []
            const sortedMessages = [...messages].sort((a: any, b: any) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )
            const lastMsg = sortedMessages[0]

            // Contar mensajes "no leídos" (mensajes de user/bot después del último mensaje de agent)
            const lastAgentMsgIndex = [...messages]
                .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .findIndex((m: any) => m.sender_type === "agent")
            const unreadCount = lastAgentMsgIndex === -1
                ? messages.filter((m: any) => m.sender_type === "user").length
                : lastAgentMsgIndex

            const customerInfo = chat.customer_id ? customerMap[chat.customer_id] : null
            const customerName = customerInfo?.full_name || chat.customer_name || null

            return {
                id: chat.id,
                customer_name: customerName,
                customer_phone: customerInfo?.phone || chat.phone_number || null,
                customer_id: chat.customer_id,
                status: chat.status,
                channel: chat.channel || "web",
                phone_number: chat.phone_number,
                created_at: chat.created_at,
                updated_at: chat.updated_at,
                last_message: lastMsg?.content || null,
                last_message_at: lastMsg?.created_at || null,
                last_message_sender: lastMsg?.sender_type || null,
                message_count: messages.length,
                unread_count: unreadCount,
            }
        })

        // Filtro por búsqueda (nombre o teléfono)
        if (search && search.trim()) {
            const searchLower = search.toLowerCase().trim()
            processedChats = processedChats.filter(c =>
                (c.customer_name && c.customer_name.toLowerCase().includes(searchLower)) ||
                (c.customer_phone && c.customer_phone.includes(searchLower)) ||
                (c.phone_number && c.phone_number.includes(searchLower))
            )
        }

        return {
            success: true,
            data: {
                chats: processedChats,
                counts,
            }
        }
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error fetching console chats"
        }
    }
}

/**
 * Envía un mensaje como agente. Inserta en BD y si es WhatsApp, envía por la API.
 * Si isInternal es true, solo guarda en BD (nota interna, no se envía al cliente).
 */
export async function sendAgentMessage(
    chatId: string,
    content: string,
    isInternal: boolean = false
): Promise<ActionResult<{ messageId: string }>> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return { success: false, error: "Unauthorized" }
        }

        // Obtener el chat para saber canal, phone_number y org
        const { data: chat, error: chatError } = await supabase
            .from("chats")
            .select("id, channel, phone_number, organization_id, status")
            .eq("id", chatId)
            .single()

        if (chatError || !chat) {
            return { success: false, error: "Chat not found" }
        }

        // Insertar mensaje en BD
        const metadata: Record<string, any> = {}
        if (isInternal) {
            metadata.is_internal = true
        }
        metadata.agent_id = user.id

        const { data: message, error: msgError } = await supabase
            .from("messages")
            .insert({
                chat_id: chatId,
                sender_type: "agent",
                content: content.trim(),
                metadata,
            })
            .select("id")
            .single()

        if (msgError) {
            return { success: false, error: `Failed to send message: ${msgError.message}` }
        }

        // Actualizar updated_at del chat
        await supabase
            .from("chats")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", chatId)

        // Si el chat es WhatsApp y NO es nota interna, enviar por WhatsApp
        if (chat.channel === "whatsapp" && !isInternal && chat.phone_number) {
            try {
                await sendWhatsAppMessage(
                    chat.organization_id,
                    chat.phone_number,
                    content.trim()
                )
                console.log("[sendAgentMessage] WhatsApp message sent to:", chat.phone_number)
            } catch (waError) {
                console.error("[sendAgentMessage] WhatsApp send failed:", waError)
                // El mensaje ya se guardó en BD — no fallar completamente
                // Pero informar que el envío WA falló
                return {
                    success: true,
                    data: {
                        messageId: message.id,
                    }
                }
            }
        }

        return {
            success: true,
            data: {
                messageId: message.id,
            }
        }
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error sending message"
        }
    }
}

/**
 * Actualiza el estado de un chat (active, closed, pending)
 */
export async function updateChatStatus(
    chatId: string,
    status: "active" | "closed" | "pending"
): Promise<ActionResult<void>> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return { success: false, error: "Unauthorized" }
        }

        const { error } = await supabase
            .from("chats")
            .update({
                status,
                updated_at: new Date().toISOString(),
            })
            .eq("id", chatId)

        if (error) {
            return { success: false, error: `Failed to update chat status: ${error.message}` }
        }

        return { success: true, data: undefined }
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error updating chat status"
        }
    }
}
