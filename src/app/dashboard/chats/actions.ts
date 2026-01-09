"use server"

import { createClient } from "@/lib/supabase/server"
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
