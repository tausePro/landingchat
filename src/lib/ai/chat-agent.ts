import Anthropic from "@anthropic-ai/sdk"
import { createMessage } from "./anthropic"
import { tools } from "./tools"
import { buildSystemPromptOptimized, buildCustomerContext, buildConversationHistory, buildCartContext } from "./context"
import { executeTool } from "./tool-executor"
import { createServiceClient } from "@/lib/supabase/server"
import { logger } from "@/lib/utils/logger"

interface ProcessMessageInput {
    message: string
    chatId: string
    organizationId: string
    agentId: string
    customerId?: string
    currentProductId?: string
}

interface ProcessMessageOutput {
    response: string
    actions: Array<{
        type: string
        data: unknown
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
    const actions: Array<{ type: string; data: unknown }> = []

    try {
        logger.debug("[processMessage] Starting", {
            chatId: input.chatId,
            agentId: input.agentId,
            currentProductId: input.currentProductId,
        })
        const supabase = createServiceClient()

        // 1. Load agent configuration
        const { data: agent } = await supabase
            .from("agents")
            .select("*")
            .eq("id", input.agentId)
            .single()

        if (!agent) throw new Error("Agent not found")

        // Debug: Log agent configuration to verify custom prompt is loaded
        logger.debug("[processMessage] Agent loaded", {
            name: agent.name,
            hasSystemPrompt: !!agent.system_prompt,
            hasConfig: !!agent.configuration,
            configPersonality: agent.configuration?.personality,
            customInstructions: agent.configuration?.personality?.instructions?.substring(0, 100) + "..."
        })

        // 2. Load organization
        const { data: organization } = await supabase
            .from("organizations")
            .select("name")
            .eq("id", input.organizationId)
            .single()

        // 3. Get product count only (NOT all products - optimization)
        // The agent uses search_products tool to find products when needed
        const { count: productCount } = await supabase
            .from("products")
            .select("*", { count: "exact", head: true })
            .eq("organization_id", input.organizationId)
            .eq("is_active", true)

        // 3.1 Load current product context if available
        let currentProduct = null
        if (input.currentProductId) {
            logger.debug("[processMessage] Loading current product", {
                currentProductId: input.currentProductId,
                organizationId: input.organizationId,
            })
            const { data: product, error: productError } = await supabase
                .from("products")
                .select("*")
                .eq("id", input.currentProductId)
                .eq("organization_id", input.organizationId)
                .single()

            if (productError) {
                logger.error("[processMessage] Error loading current product", {
                    message: productError.message,
                })
            } else {
                logger.debug("[processMessage] Current product loaded", {
                    productName: product?.name,
                })
                currentProduct = product
            }
        } else {
            logger.debug("[processMessage] No currentProductId provided")
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
        logger.debug("[processMessage] Building system prompt", {
            hasCurrentProduct: !!currentProduct,
        })
        let systemPrompt = buildSystemPromptOptimized(
            agent,
            organization?.name || "la tienda",
            productCount || 0,
            customer || undefined,
            currentProduct || undefined
        )

        // Add strict rules about inventory and variants
        systemPrompt += `
        
REGLAS CRÍTICAS DE INVENTARIO:
1. ANTES de confirmar cualquier compra o agregar al carrito, DEBES verificar si el producto tiene variantes (talla, color).
2. Si el producto tiene variantes, PREGUNTA al cliente cuál desea.
3. SOLO ofrece las variantes que existen en el catálogo. NO INVENTES tallas o colores.
4. Si el cliente pide una variante que no existe, dile amablemente que no está disponible y ofrece las que sí hay.
5. Verifica siempre el stock disponible antes de prometer un producto.
`

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
            logger.debug("[processMessage] Calling model", { loopCount })

            const response = await createMessage({
                model: "claude-sonnet-4-20250514",
                max_tokens: 1024,
                system: fullSystemPrompt,
                messages: currentMessages,
                tools
            })

            // Add assistant response to history
            currentMessages.push({
                role: "assistant",
                content: response.content
            })

            // Check if we have tool calls
            const toolUseBlocks = response.content.filter(
                (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
            )
            const textBlocks = response.content.filter(
                (block): block is Anthropic.TextBlock => block.type === "text"
            )

            if (textBlocks.length > 0) {
                finalResponseText += textBlocks.map(b => b.text).join("\n")
            }

            if (toolUseBlocks.length === 0) {
                // No more tools, we are done
                break
            }

            // Process tool calls
            const toolResults: Anthropic.ToolResultBlockParam[] = []

            for (const toolUse of toolUseBlocks) {
                toolsUsed.push(toolUse.name)
                logger.debug("[processMessage] Executing tool", { toolName: toolUse.name })

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
                model: "claude-sonnet-4-20250514",
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
                model: "claude-sonnet-4-20250514",
                latency_ms: Date.now() - startTime,
                tools_used: toolsUsed
            }
        }

    } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error))
        logger.error("[processMessage] Error", {
            name: err.name,
            message: err.message,
            stack: err.stack,
        })

        return {
            response: "Lo siento, tuve un problema procesando tu mensaje. ¿Podrías intentarlo de nuevo?",
            actions: [],
            metadata: {
                model: "claude-sonnet-4-20250514",
                latency_ms: Date.now() - startTime,
                tools_used: toolsUsed
            }
        }
    }
}
