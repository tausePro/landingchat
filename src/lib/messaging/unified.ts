/**
 * Servicio de Mensajería Unificada
 * 
 * Maneja mensajes entrantes de múltiples canales (web, WhatsApp)
 * y los procesa con el agente IA de forma consistente.
 */

import { processMessage } from "@/lib/ai/chat-agent"
import { createServiceClient } from "@/lib/supabase/server"
import { sendWhatsAppMessage, sendWhatsAppImage, sendWhatsAppButtons, sendWhatsAppList } from "@/lib/whatsapp"

export type MessageChannel = "web" | "whatsapp" | "instagram" | "messenger"

interface IncomingMessage {
    channel: MessageChannel
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

        // Fallback: si no hay agente default, buscar cualquier bot disponible
        if (!agentId) {
            const { data: anyAgent } = await supabase
                .from("agents")
                .select("id")
                .eq("organization_id", chat.organization_id)
                .eq("status", "available")
                .eq("type", "bot")
                .limit(1)
                .single()

            agentId = anyAgent?.id
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
            channel: message.channel,
        })

        // Enviar respuesta según el canal
        if (message.channel === "whatsapp") {
            await sendWhatsAppResponse(chat.organization_id, message.chatId, result.response, result.actions)
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
 * Usa el provider agnóstico que decide entre Meta Cloud API o Evolution API.
 * Si hay actions del AI (show_product, etc.), envía mensajes ricos adicionales.
 */
async function sendWhatsAppResponse(
    organizationId: string,
    chatId: string,
    response: string,
    actions?: Array<{ type: string; data: Record<string, unknown> }>
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

        // Enviar respuesta de texto principal
        await sendWhatsAppMessage(organizationId, phoneNumber, response)

        // Enviar mensajes ricos basados en las acciones del AI
        if (actions && actions.length > 0) {
            for (const action of actions) {
                try {
                    await sendRichWhatsAppAction(organizationId, phoneNumber, action)
                } catch (richError) {
                    // No fallar si el mensaje rico no se envía
                    console.error("[Unified Messaging] Error sending rich message:", richError)
                }
            }
        }
    } catch (error) {
        console.error("[Unified Messaging] Error sending WhatsApp response:", error)
    }
}

/**
 * Envía un mensaje rico por WhatsApp basado en la acción del AI
 */
async function sendRichWhatsAppAction(
    organizationId: string,
    phoneNumber: string,
    action: { type: string; data: Record<string, unknown> }
): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = action.data as any

    switch (action.type) {
        case "show_product": {
            const product = data.product
            if (!product) return

            // Enviar imagen del producto
            const imageUrl = product.image_url || (Array.isArray(product.images) ? product.images[0] : undefined)
            if (imageUrl) {
                const caption = `${product.name}\n💰 *$${Number(product.price || 0).toLocaleString()}*`
                await sendWhatsAppImage(organizationId, phoneNumber, imageUrl, caption)
            }

            // Enviar botones de acción
            await sendWhatsAppButtons(
                organizationId,
                phoneNumber,
                `¿Qué deseas hacer con *${product.name}*?`,
                [
                    { id: `add_${product.id}`, title: "Agregar al carrito" },
                    { id: `more_options`, title: "Ver más opciones" },
                ]
            )
            break
        }

        case "search_products": {
            const products = data.products
            if (!Array.isArray(products) || products.length < 2) return

            // Enviar lista interactiva con los productos encontrados
            await sendWhatsAppList(
                organizationId,
                phoneNumber,
                `Encontré ${products.length} producto${products.length > 1 ? "s" : ""} para ti 🔍`,
                "Ver productos",
                [{
                    title: "Resultados",
                    rows: products.slice(0, 10).map((p: { id: string; name: string; price: number }) => ({
                        id: `product_${p.id}`,
                        title: p.name.substring(0, 24),
                        description: `$${Number(p.price || 0).toLocaleString()}`
                    }))
                }]
            )
            break
        }

        case "add_to_cart": {
            await sendWhatsAppButtons(
                organizationId,
                phoneNumber,
                "Producto agregado al carrito ✅",
                [
                    { id: "continue_shopping", title: "Seguir comprando" },
                    { id: "checkout", title: "Ir a pagar 💳" },
                ]
            )
            break
        }

        case "render_checkout_summary": {
            await sendWhatsAppButtons(
                organizationId,
                phoneNumber,
                "Resumen de tu pedido listo 📋",
                [
                    { id: "confirm_checkout", title: "Confirmar datos" },
                    { id: "modify_cart", title: "Modificar carrito" },
                ]
            )
            break
        }
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
