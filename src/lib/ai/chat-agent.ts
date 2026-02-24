import Anthropic from "@anthropic-ai/sdk"
import { createMessage } from "./anthropic"
import { getOrgMode, getToolsForMode, getModePromptAddendum } from "./agent-factory"
import { buildSystemPromptOptimized, buildCustomerContext, buildConversationHistory, buildCartContext } from "./context"
import { executeTool } from "./tool-executor"
import { createServiceClient } from "@/lib/supabase/server"

const AI_MODEL = "claude-haiku-4-5-20251001"

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
        console.log("[processMessage] Starting with input:", { chatId: input.chatId, agentId: input.agentId, currentProductId: input.currentProductId })
        const supabase = createServiceClient()

        // 1. Load agent configuration
        const { data: agent } = await supabase
            .from("agents")
            .select("*")
            .eq("id", input.agentId)
            .single()

        if (!agent) throw new Error("Agent not found")

        // Debug: Log agent configuration to verify custom prompt is loaded
        console.log("[processMessage] Agent loaded:", {
            name: agent.name,
            hasSystemPrompt: !!agent.system_prompt,
            hasConfig: !!agent.configuration,
            configPersonality: agent.configuration?.personality,
            customInstructions: agent.configuration?.personality?.instructions?.substring(0, 100) + "..."
        })

        // 2. Load organization (incluye industry para determinar modo)
        const { data: organization } = await supabase
            .from("organizations")
            .select("name, industry")
            .eq("id", input.organizationId)
            .single()

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
            console.log("[processMessage] Loading current product:", input.currentProductId, "for org:", input.organizationId)
            const { data: product, error: productError } = await supabase
                .from("products")
                .select("*")
                .eq("id", input.currentProductId)
                .eq("organization_id", input.organizationId)
                .single()

            if (productError) {
                console.error("[processMessage] Error loading current product:", productError)
            } else {
                console.log("[processMessage] Current product loaded:", product?.name, "| Price:", product?.price)
                currentProduct = product
            }
        } else {
            console.log("[processMessage] No currentProductId provided")
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
        console.log("[processMessage] Building system prompt with currentProduct:", currentProduct?.name || "NONE")
        let systemPrompt = buildSystemPromptOptimized(
            agent,
            organization?.name || "la tienda",
            productCount || 0,
            customer || undefined,
            currentProduct || undefined
        )

        // Determinar modo de la org via factory (prioridad: features → industry → conteo)
        const orgMode = getOrgMode({
            industry: organization?.industry,
            features: planFeatures,
            productCount: productCount || 0,
            propertyCount: propertyCount || 0,
        })
        const agentSkillsConfig = agent.configuration?.skills || null
        console.log(`[processMessage] Org mode: ${orgMode} (industry: ${organization?.industry}, features: ${JSON.stringify(planFeatures)}, products: ${productCount}, properties: ${propertyCount})`)
        systemPrompt += getModePromptAddendum(orgMode, propertyCount || 0, agentSkillsConfig)

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
                        recentChannelMessages.push(`[${channelLabel} - ${new Date(otherChat.updated_at).toLocaleDateString()}]\n${summary}`)
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
            console.log(`[processMessage] Loop ${loopCount}, calling Claude...`)

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
                console.log(`[processMessage] Executing tool: ${toolUse.name}`)

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
        console.error("[processMessage] ========== ERROR DETAILS ==========")
        console.error("[processMessage] Error name:", err.name)
        console.error("[processMessage] Error message:", err.message)
        console.error("[processMessage] Error stack:", err.stack)
        console.error("[processMessage] Full error object:", JSON.stringify(err, Object.getOwnPropertyNames(err), 2))
        console.error("[processMessage] =====================================")

        return {
            response: "Lo siento, tuve un problema procesando tu mensaje. ¿Podrías intentarlo de nuevo?",
            actions: [],
            metadata: {
                model: AI_MODEL,
                latency_ms: Date.now() - startTime,
                tools_used: toolsUsed
            }
        }
    }
}
