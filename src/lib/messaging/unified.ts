/**
 * Servicio de Mensajería Unificada
 * 
 * Maneja mensajes entrantes de múltiples canales (web, WhatsApp)
 * y los procesa con el agente IA de forma consistente.
 */

import { processMessage } from "@/lib/ai/chat-agent"
import { createServiceClient } from "@/lib/supabase/server"
import { sendWhatsAppMessage, sendWhatsAppImage, sendWhatsAppMedia, sendWhatsAppButtons, sendWhatsAppList } from "@/lib/whatsapp"
import { sendSocialMessage, sendSocialImage, sendSocialQuickReplies } from "@/lib/messaging/meta-social-client"

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
        } else if (message.channel === "instagram" || message.channel === "messenger") {
            await sendSocialResponse(chat.organization_id, message.chatId, message.channel, result.response, result.actions)
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
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.error("[Unified Messaging] FAILED to send WhatsApp response:", {
            organizationId,
            chatId,
            error: errorMsg,
            responseLength: response?.length,
        })
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

        case "send_media": {
            const media = data.media
            if (!media?.file_url) return

            const fileType = media.file_type as string || ""
            const fileName = media.file_name as string || media.name as string || "archivo"
            const mediaName = media.name as string || fileName

            if (fileType.startsWith("image/")) {
                await sendWhatsAppImage(organizationId, phoneNumber, media.file_url, `📎 ${mediaName}`)
            } else if (fileType.startsWith("audio/")) {
                await sendWhatsAppMedia(organizationId, phoneNumber, media.file_url, "audio")
            } else if (fileType.startsWith("video/")) {
                await sendWhatsAppMedia(organizationId, phoneNumber, media.file_url, "video", `📎 ${mediaName}`)
            } else {
                await sendWhatsAppMedia(organizationId, phoneNumber, media.file_url, "document", `📎 ${mediaName}`, fileName)
            }
            break
        }
    }
}

/**
 * Envía una respuesta por Instagram DM o Messenger.
 * Usa el Meta Social Client para enviar mensajes.
 * Si hay actions del AI, envía mensajes ricos adaptados al canal.
 */
async function sendSocialResponse(
    organizationId: string,
    chatId: string,
    platform: "instagram" | "messenger",
    response: string,
    actions?: Array<{ type: string; data: Record<string, unknown> }>
): Promise<void> {
    try {
        const supabase = await createServiceClient()

        // Obtener el social user ID del chat
        const { data: chat } = await supabase
            .from("chats")
            .select("whatsapp_chat_id, metadata")
            .eq("id", chatId)
            .single()

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const recipientId = chat?.whatsapp_chat_id || (chat?.metadata as any)?.platform_user_id

        if (!recipientId) {
            console.error(`[Unified Messaging] No recipient ID in ${platform} chat:`, chatId)
            return
        }

        // Enviar respuesta de texto principal
        await sendSocialMessage(organizationId, platform, recipientId, response)

        // Enviar mensajes ricos basados en las acciones del AI
        if (actions && actions.length > 0) {
            for (const action of actions) {
                try {
                    await sendRichSocialAction(organizationId, platform, recipientId, action)
                } catch (richError) {
                    console.error(`[Unified Messaging] Error sending ${platform} rich message:`, richError)
                }
            }
        }
    } catch (error) {
        console.error(`[Unified Messaging] Error sending ${platform} response:`, error)
    }
}

/**
 * Envía un mensaje rico por Instagram DM o Messenger basado en la acción del AI.
 * Instagram soporta quick replies e imágenes.
 * Messenger soporta templates genéricos, quick replies e imágenes.
 */
async function sendRichSocialAction(
    organizationId: string,
    platform: "instagram" | "messenger",
    recipientId: string,
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
                const caption = `${product.name}\n\u{1F4B0} $${Number(product.price || 0).toLocaleString()}`
                await sendSocialImage(organizationId, platform, recipientId, imageUrl, caption)
            }

            // Quick replies para acciones
            await sendSocialQuickReplies(
                organizationId,
                platform,
                recipientId,
                `\u00BFQu\u00E9 deseas hacer con ${product.name}?`,
                [
                    { id: `add_${product.id}`, title: "Agregar al carrito" },
                    { id: "more_options", title: "Ver m\u00E1s opciones" },
                ]
            )
            break
        }

        case "search_products": {
            const products = data.products
            if (!Array.isArray(products) || products.length < 2) return

            // Quick replies con nombres de productos
            await sendSocialQuickReplies(
                organizationId,
                platform,
                recipientId,
                `Encontr\u00E9 ${products.length} producto${products.length > 1 ? "s" : ""} \u{1F50D}`,
                products.slice(0, 10).map((p: { id: string; name: string }) => ({
                    id: `product_${p.id}`,
                    title: p.name.substring(0, 20),
                }))
            )
            break
        }

        case "add_to_cart": {
            await sendSocialQuickReplies(
                organizationId,
                platform,
                recipientId,
                "Producto agregado al carrito \u2705",
                [
                    { id: "continue_shopping", title: "Seguir comprando" },
                    { id: "checkout", title: "Ir a pagar \u{1F4B3}" },
                ]
            )
            break
        }

        case "render_checkout_summary": {
            await sendSocialQuickReplies(
                organizationId,
                platform,
                recipientId,
                "Resumen de tu pedido listo \u{1F4CB}",
                [
                    { id: "confirm_checkout", title: "Confirmar datos" },
                    { id: "modify_cart", title: "Modificar carrito" },
                ]
            )
            break
        }

        case "create_payment_link": {
            const paymentUrl = data.paymentUrl
            const order = data.order
            if (!paymentUrl) return

            const total = order?.total ? `$${Number(order.total).toLocaleString()}` : ""
            await sendSocialQuickReplies(
                organizationId,
                platform,
                recipientId,
                `\u{1F6D2} Pedido listo ${total ? `por ${total}` : ""}\n\n\u{1F517} ${paymentUrl}`,
                [
                    { id: "payment_help", title: "Ayuda con el pago" },
                    { id: "modify_order", title: "Modificar pedido" },
                ]
            )
            break
        }

        case "send_media": {
            const media = data.media
            if (!media?.file_url) return

            const fileType = media.file_type as string || ""
            const mediaName = media.name as string || "Archivo"

            if (fileType.startsWith("image/")) {
                await sendSocialImage(organizationId, platform, recipientId, media.file_url, `\u{1F4CE} ${mediaName}`)
            } else {
                await sendSocialMessage(organizationId, platform, recipientId, `\u{1F4CE} ${mediaName}\n${media.file_url}`)
            }
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
        } else if (chat.channel === "instagram" || chat.channel === "messenger") {
            await sendSocialResponse(chat.organization_id, conversationId, chat.channel, response)
        }

        return true
    } catch (error) {
        console.error("[Unified Messaging] Error sending response:", error)
        return false
    }
}
