import Anthropic from "@anthropic-ai/sdk"
import { createMessage } from "./anthropic"
import { getOrgMode, getToolsForMode, getModePromptAddendum } from "./agent-factory"
import { buildSystemPromptOptimized, buildCustomerContext, buildConversationHistory, buildCartContext } from "./context"
import { executeTool } from "./tool-executor"
import { createServiceClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { formatBogotaDate } from "@/lib/utils/date"
import { getTenantLocale } from "@/lib/i18n/tenant-locale"
import {
    PRODUCT_WITH_VARIANTS_VARIANT_SELECT,
    normalizeVariantRow,
} from "@/lib/commerce/getProductWithVariants"
import type { ProductVariantRow } from "@/types/product"

const AI_MODEL = "claude-haiku-4-5-20251001"

function buildVariantOptionsForPrompt(variants: ProductVariantRow[]) {
    const optionValues = new Map<string, Set<string>>()

    for (const variant of variants) {
        for (const optionValue of variant.option_values) {
            const values = optionValues.get(optionValue.option_name) ?? new Set<string>()
            values.add(optionValue.value)
            optionValues.set(optionValue.option_name, values)
        }
    }

    if (optionValues.size === 0) {
        const titles = variants
            .map((variant) => variant.title.trim())
            .filter((title) => title.length > 0 && title.toLowerCase() !== "default")

        return titles.length > 0 ? [{ name: "Variante", values: Array.from(new Set(titles)) }] : []
    }

    return Array.from(optionValues.entries()).map(([name, values]) => ({
        name,
        values: Array.from(values),
    }))
}

function buildAvailableVariantsForPrompt(variants: ProductVariantRow[]) {
    return variants.map((variant) => ({
        title: variant.title,
        price: variant.price,
        compare_at_price: variant.compare_at_price,
        stock: Math.max(0, variant.stock_quantity),
        available: variant.stock_quantity > 0,
    }))
}

 interface OrgMediaPromptFile {
     id: string
     name: string
     description: string | null
     media_category: string
     tags: string[] | null
 }

 const MEDIA_REQUEST_PATTERNS = [
     "requisit",
     "document",
     "archivo",
     "adjunt",
     "pdf",
     "formato",
     "brochure",
     "catalog",
     "papel",
     "documentacion",
     "manual",
     "enviame",
     "mandame",
     "compart",
     "pasame",
     "que necesito",
     "necesito para",
     "solicitud",
 ]

 function normalizeMediaText(value: string): string {
     return value
         .normalize("NFD")
         .replace(/[\u0300-\u036f]/g, "")
         .toLowerCase()
 }

 function formatMediaPromptLine(media: OrgMediaPromptFile): string {
     return `- ID: "${media.id}" | Nombre: "${media.name}" | Tipo: ${media.media_category}${media.description ? ` | Cuándo usar: ${media.description}` : ""}${media.tags?.length ? ` | Tags: ${media.tags.join(", ")}` : ""}`
 }

 function getRelevantMediaForMessage(message: string, mediaFiles: OrgMediaPromptFile[]): OrgMediaPromptFile[] {
     const normalizedMessage = normalizeMediaText(message)
     if (!normalizedMessage) return []

     const isMediaRequest = MEDIA_REQUEST_PATTERNS.some(pattern => normalizedMessage.includes(pattern))
     if (!isMediaRequest) return []

     const messageWords = Array.from(new Set(
         normalizedMessage
             .split(/[^a-z0-9]+/)
             .filter(word => word.length >= 4)
     ))

     return mediaFiles
         .map(media => {
             const normalizedName = normalizeMediaText(media.name)
             const normalizedDescription = normalizeMediaText(media.description || "")
             const normalizedTags = (media.tags || []).map(tag => normalizeMediaText(tag))

             let score = 0

             if (normalizedName && normalizedMessage.includes(normalizedName)) {
                 score += 10
             }

             for (const tag of normalizedTags) {
                 if (tag && normalizedMessage.includes(tag)) {
                     score += 6
                 }
             }

             for (const word of messageWords) {
                 if (normalizedName.includes(word)) {
                     score += 3
                 }
                 if (normalizedDescription.includes(word)) {
                     score += 2
                 }
                 if (normalizedTags.some(tag => tag.includes(word))) {
                     score += 2
                 }
             }

             return { media, score }
         })
         .filter(item => item.score >= 4)
         .sort((a, b) => b.score - a.score)
         .slice(0, 3)
         .map(item => item.media)
 }

interface ProcessMessageInput {
    message: string
    chatId: string
    organizationId: string
    agentId: string
    customerId?: string
    currentProductId?: string
    channel?: "web" | "whatsapp" | "instagram" | "messenger"
}

interface ProcessMessageOutput {
    response: string
    actions: Array<{
        type: string
        data: Record<string, unknown>
    }>
    metadata: {
        model: string
        tokens_used?: {
            input: number
            output: number
        }
        latency_ms: number
        tools_used: string[]
    }
}

export async function processMessage(input: ProcessMessageInput): Promise<ProcessMessageOutput> {
    const startTime = Date.now()
    const toolsUsed: string[] = []
    const actions: Array<{ type: string; data: Record<string, unknown> }> = []

    try {
        const log = logger("ai/chat-agent").withContext({ orgId: input.organizationId, chatId: input.chatId })
        log.info("Starting processMessage", { agentId: input.agentId, currentProductId: input.currentProductId })
        const supabase = createServiceClient()

        // 1. Load agent configuration
        const { data: agent } = await supabase
            .from("agents")
            .select("*")
            .eq("id", input.agentId)
            .single()

        if (!agent) throw new Error("Agent not found")

        log.debug("Agent loaded", {
            name: agent.name,
            hasSystemPrompt: !!agent.system_prompt,
            hasConfig: !!agent.configuration,
            configPersonality: agent.configuration?.personality,
            customInstructions: agent.configuration?.personality?.instructions?.substring(0, 100) + "..."
        })

        // 2. Load organization (incluye industry + locale i18n para sistema bilingue)
        // T1.7 — cargamos locale/currency/country para parametrizar el system
        // prompt. Tantor's House (en-US) recibe instrucciones en inglés y
        // responde en inglés. Tenants legacy CO siguen con es-CO sin cambios.
        const { data: organization } = await supabase
            .from("organizations")
            .select("name, industry, locale, currency_code, country_code")
            .eq("id", input.organizationId)
            .single()

        const tenantLocale = getTenantLocale(organization)

        // 2.1 Load subscription features (flags del plan activo)
        const { data: subscription } = await supabase
            .from("subscriptions")
            .select("features")
            .eq("organization_id", input.organizationId)
            .in("status", ["active", "trialing"])
            .order("created_at", { ascending: false })
            .limit(1)
            .single()

        const planFeatures = (subscription?.features as Record<string, boolean>) || null

        // 3. Get product count only (NOT all products - optimization)
        // The agent uses search_products tool to find products when needed
        const { count: productCount } = await supabase
            .from("products")
            .select("*", { count: "exact", head: true })
            .eq("organization_id", input.organizationId)
            .eq("is_active", true)

        // 3.0 Get property count (for real estate orgs)
        const { count: propertyCount } = await supabase
            .from("properties")
            .select("*", { count: "exact", head: true })
            .eq("organization_id", input.organizationId)
            .eq("status", "active")

        // 3.1 Load current product context if available
        let currentProduct = null
        if (input.currentProductId) {
            log.debug("Loading current product", { productId: input.currentProductId })
            const { data: product, error: productError } = await supabase
                .from("products")
                .select("*")
                .eq("id", input.currentProductId)
                .eq("organization_id", input.organizationId)
                .single()

            if (productError) {
                log.warn("Error loading current product", { error: productError.message })
            } else {
                log.debug("Current product loaded", { name: product?.name, price: product?.price })
                const { data: variantRows, error: variantsError } = await supabase
                    .from("product_variants")
                    .select(PRODUCT_WITH_VARIANTS_VARIANT_SELECT)
                    .eq("product_id", input.currentProductId)
                    .eq("organization_id", input.organizationId)
                    .eq("is_active", true)

                if (variantsError) {
                    log.warn("Error loading current product variants", { error: variantsError.message })
                    currentProduct = product
                } else {
                    const variants = (variantRows || [])
                        .map((variant) => normalizeVariantRow(variant))
                        .filter((variant) => variant.is_active)

                    currentProduct = {
                        ...product,
                        variant_options: buildVariantOptionsForPrompt(variants),
                        available_variants: buildAvailableVariantsForPrompt(variants),
                    }
                }
            }
        } else {
            log.debug("No currentProductId provided")
        }

        // 4. Load conversation history
        const { data: messages } = await supabase
            .from("messages")
            .select("sender_type, content")
            .eq("chat_id", input.chatId)
            .order("created_at", { ascending: false })
            .limit(10)

        const conversationHistory = messages ? buildConversationHistory(
            messages.reverse().map(m => ({
                role: m.sender_type === 'user' ? 'user' as const : 'assistant' as const,
                content: m.content
            }))
        ) : []

        // 5. Load customer context if exists
        let customer = null
        let customerOrders = null
        if (input.customerId) {
            const { data: customerData } = await supabase
                .from("customers")
                .select("*")
                .eq("id", input.customerId)
                .single()

            const { data: ordersData } = await supabase
                .from("orders")
                .select("*")
                .eq("customer_id", input.customerId)
                .order("created_at", { ascending: false })
                .limit(5)

            customer = customerData
            customerOrders = ordersData
        }

        // 6. Load cart state
        const { data: cart } = await supabase
            .from("carts")
            .select("*")
            .eq("chat_id", input.chatId)
            .eq("status", "active")
            .single()

        // 7. Build system prompt (optimized: only pass product count, not all products)
        log.debug("Building system prompt", { currentProduct: currentProduct?.name || "NONE", locale: tenantLocale.locale })
        let systemPrompt = buildSystemPromptOptimized(
            agent,
            organization?.name || "la tienda",
            productCount || 0,
            customer || undefined,
            currentProduct || undefined,
            tenantLocale.locale,
        )

        // 7.5. Inyectar documentos de conocimiento del agente (si existen)
        try {
            const { data: agentDocs } = await supabase
                .from("agent_documents")
                .select("name, extracted_text")
                .eq("agent_id", agent.id)
                .eq("status", "ready")
                .not("extracted_text", "is", null)
                .order("created_at", { ascending: true })

            if (agentDocs && agentDocs.length > 0) {
                const docsText = agentDocs.map(doc =>
                    `--- DOCUMENTO: ${doc.name} ---\n${doc.extracted_text}`
                ).join("\n\n")

                systemPrompt += `\n\nDOCUMENTOS DE REFERENCIA DEL NEGOCIO:
Tienes acceso a ${agentDocs.length} documento(s) con información del negocio. Usa esta información para responder preguntas del cliente sobre políticas, garantías, procedimientos, etc.

${docsText}

IMPORTANTE: Si la respuesta está en estos documentos, cita la información. Si no está, di que no tienes esa información específica.`

                log.debug("Injected knowledge docs", { count: agentDocs.length, chars: docsText.length })
            }
        } catch (docsError) {
            log.warn("Error loading agent documents", { error: docsError instanceof Error ? docsError.message : String(docsError) })
        }

        // 7.6. Inyectar archivos media disponibles (para tool send_media)
        try {
            const { data: orgMedia } = await supabase
                .from("organization_media")
                .select("id, name, description, media_category, tags")
                .eq("organization_id", input.organizationId)
                .eq("is_active", true)
                .order("created_at", { ascending: true })

            if (orgMedia && orgMedia.length > 0) {
                const typedOrgMedia = orgMedia as OrgMediaPromptFile[]
                const relevantMedia = getRelevantMediaForMessage(input.message, typedOrgMedia)
                const mediaList = typedOrgMedia.map(formatMediaPromptLine).join("\n")

                if (relevantMedia.length > 0) {
                    const relevantMediaList = relevantMedia.map(formatMediaPromptLine).join("\n")
                    systemPrompt += `\n\nARCHIVOS PRIORITARIOS PARA ESTE MENSAJE:
El último mensaje del cliente parece pedir un documento o archivo. Estos son los archivos más relevantes para responderle ahora mismo:
${relevantMediaList}

REGLA CRÍTICA: Si el cliente está pidiendo requisitos, documentos, PDF, adjuntos o un archivo que coincide con alguno de estos elementos, usa send_media con el ID correspondiente en esta misma respuesta y luego explica brevemente qué le estás compartiendo.`
                }

                systemPrompt += `\n\nARCHIVOS DISPONIBLES PARA ENVIAR AL CLIENTE:
Puedes usar la herramienta send_media con el ID del archivo para compartirlo con el cliente.
${mediaList}

INSTRUCCIÓN: Envía estos archivos cuando sea pertinente según su descripción. No los envíes todos de golpe, solo cuando el contexto de la conversación lo amerite.`

                log.debug("Injected media files into prompt", { count: typedOrgMedia.length, prioritized: relevantMedia.map(media => media.id) })
            }
        } catch (mediaError) {
            log.warn("Error loading org media", { error: mediaError instanceof Error ? mediaError.message : String(mediaError) })
        }

        // Determinar modo de la org via factory (prioridad: features → industry → conteo)
        const orgMode = getOrgMode({
            industry: organization?.industry,
            features: planFeatures,
            productCount: productCount || 0,
            propertyCount: propertyCount || 0,
        })
        const agentSkillsConfig = agent.configuration?.skills || null
        log.info("Org mode resolved", { mode: orgMode, industry: organization?.industry, products: productCount, properties: propertyCount })
        systemPrompt += getModePromptAddendum(orgMode, propertyCount || 0, agentSkillsConfig, tenantLocale.locale)

        // Add channel-specific instructions
        const channel = input.channel || "web"
        if (channel === "whatsapp") {
            systemPrompt += `
CANAL: Estás respondiendo por WhatsApp.
REGLAS DE FORMATO WHATSAPP:
- Mensajes CORTOS y directos (máximo 3-4 párrafos)
- Usa emojis con moderación para hacer el mensaje amigable
- Usa formato nativo de WhatsApp: *negrita*, _cursiva_, ~tachado~
- NO uses markdown estándar: nada de **doble asterisco**, [links](url), ## títulos
- Para listas usa: 1. 2. 3. o • viñetas simples
- Los links de pago envíalos como URL directa (WhatsApp los hace clickeables automáticamente)
- NO digas "mira la tarjeta del producto" ni "haz clic en el botón" — no hay tarjetas visuales aquí
- Resalta nombres de productos con *negrita* y precios con *negrita*
- Si el cliente quiere comprar, guíalo paso a paso por texto
`
        } else if (channel === "instagram" || channel === "messenger") {
            const channelName = channel === "instagram" ? "Instagram DM" : "Facebook Messenger"
            systemPrompt += `
CANAL: Estás respondiendo por ${channelName}.

IDENTIFICACIÓN CROSS-CHANNEL (PRIORIDAD ALTA):
- Al inicio de CADA conversación nueva, preséntate brevemente y pide al cliente su NÚMERO DE TELÉFONO o WHATSAPP.
- Ejemplo: "¡Hola! Soy [nombre]. Para darte la mejor atención, ¿me compartes tu número de WhatsApp o teléfono? Así puedo ver si ya hemos conversado antes 😊"
- Cuando el cliente dé su número, usa INMEDIATAMENTE identify_customer con ese teléfono.
- Si identify_customer devuelve isReturning=true, salúdalo por su nombre y menciona que ya lo conoces de otro canal.
- Si devuelve crossChannelMerge=true, di algo como "¡[Nombre]! Qué bueno verte también por ${channelName}. Ya tengo tu historial aquí 💚"
- NUNCA procedas a vender o hacer checkout sin antes identificar al cliente.

REGLAS DE FORMATO ${channelName.toUpperCase()}:
- Mensajes CORTOS y conversacionales (máximo 2-3 párrafos)
- Tono casual y cercano, como hablar con un amigo
- Usa emojis de forma natural para dar vida al mensaje
- NO uses markdown: nada de **negrita**, _cursiva_, [links](url), ## títulos
- Para listas usa: 1. 2. 3. o viñetas con emoji (✨, 🌿, etc.)
- Los links de pago envíalos como URL directa (se hacen clickeables automáticamente)
- NO digas "mira la tarjeta del producto" — no hay tarjetas visuales aquí
- Si el cliente quiere comprar, guíalo paso a paso por texto
- ${channel === "instagram" ? "Puedes referenciar stories o posts si el cliente los menciona" : "Si el cliente viene de un anuncio de Facebook, reconócelo"}

REGLAS CRÍTICAS DE LINKS Y PAGOS:
- JAMÁS inventes URLs de pago. SIEMPRE usa EXACTAMENTE el URL que devuelve la herramienta create_payment_link.
- Si create_payment_link falla, dile al cliente que hubo un problema técnico y que reintentes.
- Los URLs correctos de pago tienen el formato: https://[dominio]/checkout/{wompi|epayco}/[id] — NUNCA generes URLs externas (epayco.co, wompi.co) directamente.
`
        }

        // Load cross-channel context (recent interactions from other channels)
        let crossChannelContext = ""
        if (input.customerId) {
            const { data: otherChats } = await supabase
                .from("chats")
                .select("id, channel, updated_at")
                .eq("customer_id", input.customerId)
                .neq("id", input.chatId)
                .order("updated_at", { ascending: false })
                .limit(3)

            if (otherChats && otherChats.length > 0) {
                // Cargar últimos mensajes de otros canales
                const recentChannelMessages: string[] = []
                for (const otherChat of otherChats) {
                    const { data: recentMsgs } = await supabase
                        .from("messages")
                        .select("content, sender_type, created_at")
                        .eq("chat_id", otherChat.id)
                        .order("created_at", { ascending: false })
                        .limit(3)

                    if (recentMsgs && recentMsgs.length > 0) {
                        const channelLabel = otherChat.channel === "web" ? "web chat" : otherChat.channel
                        const summary = recentMsgs.reverse().map(m =>
                            `${m.sender_type === "user" ? "Cliente" : "Agente"}: ${m.content.substring(0, 100)}`
                        ).join("\n")
                        recentChannelMessages.push(`[${channelLabel} - ${formatBogotaDate(otherChat.updated_at)}]\n${summary}`)
                    }
                }

                if (recentChannelMessages.length > 0) {
                    crossChannelContext = `
CONTEXTO CROSS-CHANNEL (interacciones recientes del cliente en otros canales):
${recentChannelMessages.join("\n\n")}
INSTRUCCIÓN: Usa este contexto para dar continuidad. Si el cliente estaba viendo un producto en la web, puedes mencionarlo. No repitas información que ya se le dio.`
                }
            }
        }

        // Add customer and cart context to system prompt
        let fullSystemPrompt = systemPrompt
        if (customer) {
            fullSystemPrompt += "\n\n" + buildCustomerContext(customer, customerOrders || [])
        } else {
            fullSystemPrompt += "\n\n" + buildCustomerContext(undefined, undefined)
        }

        if (cart) {
            fullSystemPrompt += "\n\n" + buildCartContext(cart)
        }

        if (crossChannelContext) {
            fullSystemPrompt += "\n\n" + crossChannelContext
        }

        // 8. Prepare message history
        const currentMessages: Anthropic.MessageParam[] = [
            ...conversationHistory,
            { role: 'user' as const, content: input.message }
        ]

        let finalResponseText = ""
        let loopCount = 0
        const MAX_LOOPS = 5

        // 9. Main Loop
        while (loopCount < MAX_LOOPS) {
            loopCount++
            log.debug(`Loop ${loopCount}, calling Claude`)

            const response = await createMessage({
                model: AI_MODEL,
                max_tokens: 1024,
                system: fullSystemPrompt,
                messages: currentMessages,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Anthropic SDK type incompatibility
                tools: getToolsForMode(orgMode) as any
            })

            // Add assistant response to history
            currentMessages.push({
                role: "assistant",
                content: response.content
            })

            // Check if we have tool calls
            const toolUseBlocks = response.content.filter(block => block.type === "tool_use")
            const textBlocks = response.content.filter(block => block.type === "text")

            if (textBlocks.length > 0) {
                finalResponseText += textBlocks.map(b => (b as Anthropic.TextBlock).text).join("\n")
            }

            if (toolUseBlocks.length === 0) {
                // No more tools, we are done
                break
            }

            // Process tool calls
            const toolResults: Anthropic.ToolResultBlockParam[] = []

            for (const toolBlock of toolUseBlocks) {
                const toolUse = toolBlock as Anthropic.ToolUseBlock
                toolsUsed.push(toolUse.name)
                log.info("Executing tool", { tool: toolUse.name })

                const toolResult = await executeTool(
                    toolUse.name,
                    toolUse.input,
                    {
                        chatId: input.chatId,
                        organizationId: input.organizationId,
                        customerId: input.customerId
                    }
                )

                // Add to actions list for frontend
                if (toolResult.success && toolResult.data) {
                    actions.push({
                        type: toolUse.name,
                        data: toolResult.data
                    })
                }

                toolResults.push({
                    type: "tool_result",
                    tool_use_id: toolUse.id,
                    content: JSON.stringify(toolResult)
                })
            }

            // Add tool results to history for next iteration
            currentMessages.push({
                role: "user",
                content: toolResults
            })
        }

        // 10. Save assistant response to DB
        // Nota: El mensaje del usuario ya fue guardado por el webhook/caller
        await supabase.from("messages").insert({
            chat_id: input.chatId,
            sender_type: "bot",
            content: finalResponseText,
            metadata: {
                model: AI_MODEL,
                tools_used: toolsUsed,
                latency_ms: Date.now() - startTime
            }
        })

        // Si hay un producto en contexto y es el primer mensaje, agregar acción show_product
        if (currentProduct && !actions.some(a => a.type === 'show_product')) {
            actions.unshift({
                type: 'show_product',
                data: {
                    product: {
                        id: currentProduct.id,
                        name: currentProduct.name,
                        description: currentProduct.description,
                        price: currentProduct.price,
                        image_url: currentProduct.image_url || currentProduct.images?.[0],
                        stock: currentProduct.stock,
                        variants: currentProduct.variants
                    }
                }
            })
        }

        return {
            response: finalResponseText,
            actions,
            metadata: {
                model: AI_MODEL,
                latency_ms: Date.now() - startTime,
                tools_used: toolsUsed
            }
        }

    } catch (error) {
        const err = error as Error
        const log = logger("ai/chat-agent").withContext({ orgId: input.organizationId, chatId: input.chatId })
        log.error("processMessage failed", { name: err.name, message: err.message, stack: err.stack?.split("\n").slice(0, 3).join(" | ") })

        // T1.7 — fallback locale-aware. Tantor recibe error en inglés.
        // No usamos `t()` aquí para no agregar otra dependencia: ya tenemos
        // input.organizationId pero NO el locale resuelto en este catch
        // (la falla pudo ocurrir antes del query). Hard-coded ES + EN cubre
        // ambos verticales sin ramificar.
        const fallbackErrorByLocale: Record<string, string> = {
            "es-CO": "Lo siento, tuve un problema procesando tu mensaje. ¿Podrías intentarlo de nuevo?",
            "en-US": "Sorry, I had trouble processing your message. Could you try again?",
        }
        // Best effort: re-leer el locale del org desde DB. Si falla, default es-CO.
        let errorLocale = "es-CO"
        try {
            const supabase = createServiceClient()
            const { data: org } = await supabase
                .from("organizations")
                .select("locale")
                .eq("id", input.organizationId)
                .single()
            if (org?.locale === "en-US") errorLocale = "en-US"
        } catch {
            // si la lectura falla, fallback a es-CO
        }

        return {
            response: fallbackErrorByLocale[errorLocale] || fallbackErrorByLocale["es-CO"],
            actions: [],
            metadata: {
                model: AI_MODEL,
                latency_ms: Date.now() - startTime,
                tools_used: toolsUsed
            }
        }
    }
}
