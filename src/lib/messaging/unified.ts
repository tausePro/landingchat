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
import { logger } from "@/lib/logger"

const log = logger("messaging/unified")

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

        // Obtener información del chat (incluye campos de control IA: hard pause y soft pause)
        const { data: chat, error: chatError } = await supabase
            .from("chats")
            .select("organization_id, customer_id, assigned_agent_id, ai_enabled, ai_paused_until")
            .eq("id", message.chatId)
            .single()

        if (chatError || !chat) {
            return {
                success: false,
                error: "Chat no encontrado",
            }
        }

        // Check 0: cliente en whitelist human-only (la IA NUNCA responde a este contacto)
        // Tiene precedencia sobre cualquier otro flag.
        if (chat.customer_id) {
            const { data: customer } = await supabase
                .from("customers")
                .select("is_human_only")
                .eq("id", chat.customer_id)
                .single()

            if (customer?.is_human_only === true) {
                log.info("Customer is human-only, skipping AI", {
                    chatId: message.chatId,
                    customerId: chat.customer_id,
                })
                return {
                    success: true,
                    response: undefined,
                }
            }
        }

        // Check 1: IA desactivada manualmente en esta conversación (hard pause)
        if (chat.ai_enabled === false) {
            log.info("AI disabled for chat (hard pause)", { chatId: message.chatId })
            return {
                success: true,
                response: undefined,
            }
        }

        // Check 1.5: pausa suave con expiración (se activa al responder el operador desde WhatsApp)
        if (chat.ai_paused_until) {
            const pausedUntil = new Date(chat.ai_paused_until)
            const now = new Date()

            if (pausedUntil > now) {
                log.info("AI in soft pause", {
                    chatId: message.chatId,
                    pausedUntil: chat.ai_paused_until,
                    remainingMs: pausedUntil.getTime() - now.getTime(),
                })
                return {
                    success: true,
                    response: undefined,
                }
            }

            // Soft-pause expirada: limpiar campo y dejar pasar (auto-reanudación)
            // No bloqueamos en caso de error: la IA debe responder aunque falle el cleanup.
            await supabase
                .from("chats")
                .update({ ai_paused_until: null })
                .eq("id", message.chatId)

            log.info("Soft pause expired, AI auto-resumed", {
                chatId: message.chatId,
                expiredAt: chat.ai_paused_until,
            })
        }

        // Obtener agente asignado o el agente por defecto de la organización
        let agentId = chat.assigned_agent_id

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

        // Check 2: Horario humano del agente por canal.
        //
        // Semantica del schedule (debe coincidir con el editor en el dashboard):
        //   - Los dias/horas configurados representan cuando el HUMANO atiende,
        //     por lo tanto la IA esta PAUSADA dentro de esa ventana.
        //   - Los dias sin horario (null/undefined) o las horas fuera del rango
        //     son los momentos en que la IA responde automaticamente 24/7.
        //
        // Ver: docs/AGENTS_GUIDE.md y el card "Como funciona" en agent-config.tsx.
        if (message.channel !== "web") {
            const { data: agent } = await supabase
                .from("agents")
                .select("configuration")
                .eq("id", agentId)
                .single()

            if (agent?.configuration?.schedule?.enabled) {
                const schedule = agent.configuration.schedule
                const channelSchedule = schedule.channels?.[message.channel]

                if (channelSchedule) {
                    const aiPaused = isAiPausedBySchedule(channelSchedule, schedule.timezone || "America/Bogota")
                    if (aiPaused) {
                        log.info("AI paused by schedule (within human attention window)", { chatId: message.chatId, channel: message.channel, agentId })
                        return {
                            success: true,
                            response: undefined,
                        }
                    }
                }
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
        log.error("Error processing message", { chatId: message.chatId, error: error instanceof Error ? error.message : String(error) })
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
            log.error("No phone number in chat", { chatId })
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
                    log.warn("Error sending rich WhatsApp message", { chatId, error: richError instanceof Error ? richError.message : String(richError) })
                }
            }
        }
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        log.error("FAILED to send WhatsApp response", {
            orgId: organizationId,
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

        case "show_property": {
            const property = data.property
            if (!property) return

            // Enviar imagen principal con caption estilo Wasi
            const mainImage = Array.isArray(property.images) ? property.images[0] : null
            const specs = []
            if (property.specs?.bedrooms) specs.push(`🛏️ ${property.specs.bedrooms} hab`)
            if (property.specs?.bathrooms) specs.push(`🚿 ${property.specs.bathrooms} baños`)
            if (property.specs?.area) specs.push(`📐 ${property.specs.area}`)

            let caption = `🏠 *${property.title || "Propiedad"}*\n`
            if (property.location?.neighborhood || property.location?.city) {
                caption += `📍 ${property.location.neighborhood || ""}${property.location.neighborhood && property.location.city ? ", " : ""}${property.location.city || ""}\n`
            }
            if (specs.length > 0) caption += `${specs.join(" | ")}\n`
            if (property.prices?.rent) caption += `💰 Arriendo: *${property.prices.rent}*\n`
            if (property.prices?.sale) caption += `💰 Venta: *${property.prices.sale}*\n`
            if (property.prices?.admin) caption += `📋 Admin: ${property.prices.admin}\n`
            if (property.url) caption += `\n👉 Ver ficha completa: ${property.url}`

            if (mainImage) {
                await sendWhatsAppImage(organizationId, phoneNumber, mainImage, caption)
            }

            // Enviar botones de acción
            await sendWhatsAppButtons(
                organizationId,
                phoneNumber,
                `¿Qué te gustaría hacer con *${property.title || "esta propiedad"}*?`,
                [
                    { id: "schedule_visit", title: "Agendar visita" },
                    { id: "more_options", title: "Ver más opciones" },
                ]
            )
            break
        }

        case "search_properties": {
            const properties = data.properties
            if (!Array.isArray(properties) || properties.length === 0) return

            // Enviar lista interactiva con las propiedades encontradas
            if (properties.length >= 2) {
                await sendWhatsAppList(
                    organizationId,
                    phoneNumber,
                    `🏠 Encontré ${properties.length} propiedad${properties.length > 1 ? "es" : ""} para ti`,
                    "Ver propiedades",
                    [{
                        title: "Resultados",
                        rows: properties.slice(0, 10).map((p: { id: string; title: string; priceRent?: string; priceSale?: string; location?: string }) => ({
                            id: `property_${p.id}`,
                            title: (p.title || "Propiedad").substring(0, 24),
                            description: `${p.priceRent || p.priceSale || ""} ${p.location ? `· ${p.location}` : ""}`.substring(0, 72)
                        }))
                    }]
                )
            }
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
            log.error("No recipient ID in social chat", { chatId, platform })
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
                    log.warn("Error sending social rich message", { chatId, platform, error: richError instanceof Error ? richError.message : String(richError) })
                }
            }
        }
    } catch (error) {
        log.error("Error sending social response", { platform, error: error instanceof Error ? error.message : String(error) })
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
            log.error("Error creating customer", { error: error instanceof Error ? error.message : String(error) })
            return null
        }

        return { id: newCustomer.id, isNew: true }
    } catch (error) {
        log.error("Error identifying customer", { error: error instanceof Error ? error.message : String(error) })
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
        log.error("Error sending response", { error: error instanceof Error ? error.message : String(error) })
        return false
    }
}

// ============================================
// Schedule helpers
// ============================================

interface DaySchedule {
    from: string // "08:00"
    to: string   // "18:00"
}

type ChannelSchedule = Record<string, DaySchedule | null>

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]

/**
 * Determina si la IA debe estar PAUSADA segun el horario humano configurado.
 *
 * Semantica (debe coincidir con la UI del editor de agente):
 *   - Dia sin horario (null/undefined) -> la IA responde 24/7 (NO pausada).
 *   - Dia con horario configurado -> la IA esta PAUSADA dentro del rango
 *     (porque ahi atiende el humano) y responde fuera del rango.
 *
 * Esta funcion se exporta para tests unitarios. Es una funcion pura: no toca
 * BD ni hace IO; solo evalua hora actual + zona horaria + schedule.
 *
 * Comportamiento ante errores (fail-open): si el calculo falla por cualquier
 * razon (zona horaria invalida, schedule malformado, etc.) NO se pausa la IA.
 * Es preferible que responda de mas a que se quede muda silenciosamente.
 */
export function isAiPausedBySchedule(channelSchedule: ChannelSchedule, timezone: string): boolean {
    try {
        const now = new Date()
        const formatter = new Intl.DateTimeFormat("en-US", {
            timeZone: timezone,
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
            weekday: "short",
        })

        const parts = formatter.formatToParts(now)
        const weekday = parts.find(p => p.type === "weekday")?.value?.toLowerCase() || ""
        const hour = parts.find(p => p.type === "hour")?.value || "00"
        const minute = parts.find(p => p.type === "minute")?.value || "00"
        const currentTime = `${hour}:${minute}`

        // Mapear weekday corto de Intl a nuestras keys
        const dayMap: Record<string, string> = {
            sun: "sun", mon: "mon", tue: "tue", wed: "wed", thu: "thu", fri: "fri", sat: "sat",
        }
        const dayKey = dayMap[weekday] || DAY_KEYS[now.getDay()]

        const daySchedule = channelSchedule[dayKey]

        // Dia inactivo (sin horario configurado) -> la IA responde 24/7
        if (!daySchedule) return false

        // Dia activo -> la IA esta pausada DENTRO del rango (ahi atiende el humano).
        // Fuera del rango la IA responde automaticamente.
        return currentTime >= daySchedule.from && currentTime < daySchedule.to
    } catch (error) {
        log.error("Error checking schedule", { error: error instanceof Error ? error.message : String(error) })
        // Fail-open: ante error, no pausar la IA.
        return false
    }
}
