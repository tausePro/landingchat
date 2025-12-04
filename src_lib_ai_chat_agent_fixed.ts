// Fixed version of src/lib/ai/chat-agent.ts with proper TypeScript types
// This demonstrates how to fix the 226+ TypeScript errors in the codebase

import Anthropic from "@anthropic-ai/sdk"
import { createMessage } from "./anthropic"
import { tools } from "./tools"
import { buildSystemPrompt, buildConversationHistory, buildCustomerContext, buildCartContext } from "./context"
import { executeTool } from "./tool-executor"
import { createClient } from "@/lib/supabase/server"

// 1. Define proper interfaces instead of using 'any'
interface ProcessMessageInput {
    message: string
    chatId: string
    organizationId: string
    agentId: string
    customerId?: string
    currentProductId?: string
}

interface ToolResult {
    success: boolean
    data?: unknown // instead of 'any'
    error?: string
}

interface AgentData {
    id: string
    name: string
    system_prompt?: string
    configuration?: Record<string, unknown>
    organization_id: string
}

interface OrganizationData {
    id: string
    name: string
}

interface Product {
    id: string
    name: string
    description?: string
    price: number
    is_active: boolean
    organization_id: string
}

interface Customer {
    id: string
    full_name?: string
    email?: string
    phone?: string
    organization_id: string
}

interface Message {
    id: string
    chat_id: string
    sender_type: 'user' | 'bot'
    content: string
    created_at: string
}

interface Cart {
    id: string
    chat_id: string
    customer_id?: string
    items: unknown[] // instead of 'any'
    status: string
}

interface ProcessMessageOutput {
    response: string
    actions: Array<{
        type: string
        data: unknown // instead of 'any'
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

interface ToolContext {
    chatId: string
    organizationId: string
    customerId?: string
}

export async function processMessage(input: ProcessMessageInput): Promise<ProcessMessageOutput> {
    const startTime = Date.now()
    const toolsUsed: string[] = []
    const actions: Array<{ type: string; data: unknown }> = []

    try {
        // 2. Remove sensitive logging for production
        if (process.env.NODE_ENV !== 'production') {
            console.log("[processMessage] Starting with input:", { 
                chatId: input.chatId, 
                agentId: input.agentId, 
                currentProductId: input.currentProductId 
            })
        }

        const supabase = await createClient()

        // 3. Properly type database queries
        const { data: agent, error: agentError } = await supabase
            .from("agents")
            .select("*")
            .eq("id", input.agentId)
            .single()

        if (agentError || !agent) {
            throw new Error(`Agent not found: ${agentError?.message || 'Unknown error'}`)
        }

        // 4. Type organization query
        const { data: organization, error: orgError } = await supabase
            .from("organizations")
            .select("id, name")
            .eq("id", input.organizationId)
            .single()

        if (orgError || !organization) {
            throw new Error(`Organization not found: ${orgError?.message || 'Unknown error'}`)
        }

        // 5. Type products query
        const { data: products, error: productsError } = await supabase
            .from("products")
            .select("id, name, description, price, is_active, organization_id")
            .eq("organization_id", input.organizationId)
            .eq("is_active", true)

        if (productsError) {
            console.error("Error fetching products:", productsError)
            // Continue with empty array instead of failing
        }

        // 6. Type current product query
        let currentProduct: Product | null = null
        if (input.currentProductId) {
            const { data: product, error: productError } = await supabase
                .from("products")
                .select("id, name, description, price, is_active, organization_id")
                .eq("id", input.currentProductId)
                .single()

            if (productError || !product) {
                console.error("Error fetching current product:", productError)
            } else {
                currentProduct = product
            }
        }

        // 7. Type messages query
        const { data: messages, error: messagesError } = await supabase
            .from("messages")
            .select("sender_type, content, created_at")
            .eq("chat_id", input.chatId)
            .order("created_at", { ascending: false })
            .limit(10)

        if (messagesError) {
            console.error("Error fetching messages:", messagesError)
        }

        const conversationHistory = messages ? buildConversationHistory(
            messages.reverse().map(m => ({
                role: m.sender_type === 'user' ? 'user' as const : 'assistant' as const,
                content: m.content
            }))
        ) : []

        // 8. Type customer data
        let customer: Customer | null = null
        let customerOrders: unknown[] | null = null // instead of 'any'
        if (input.customerId) {
            const { data: customerData, error: customerError } = await supabase
                .from("customers")
                .select("id, full_name, email, phone, organization_id")
                .eq("id", input.customerId)
                .single()

            if (customerError || !customerData) {
                console.error("Error fetching customer:", customerError)
            } else {
                customer = customerData

                const { data: ordersData, error: ordersError } = await supabase
                    .from("orders")
                    .select("*")
                    .eq("customer_id", input.customerId)
                    .order("created_at", { ascending: false })
                    .limit(5)

                if (ordersError) {
                    console.error("Error fetching orders:", ordersError)
                } else {
                    customerOrders = ordersData || []
                }
            }
        }

        // 9. Type cart query
        const { data: cart, error: cartError } = await supabase
            .from("carts")
            .select("id, chat_id, customer_id, items, status")
            .eq("chat_id", input.chatId)
            .eq("status", "active")
            .single()

        if (cartError && cartError.code !== 'PGRST116') { // PGRST116 = no rows
            console.error("Error fetching cart:", cartError)
        }

        // 10. Build system prompt with proper typing
        const systemPrompt = buildSystemPrompt(
            agent as AgentData,
            organization.name,
            products || [],
            customer || undefined,
            currentProduct || undefined
        )

        // Add strict rules about inventory and variants
        let fullSystemPrompt = systemPrompt + `
        
REGLAS CRÍTICAS DE INVENTARIO:
1. ANTES de confirmar cualquier compra o agregar al carrito, DEBES verificar si el producto tiene variantes (talla, color).
2. Si el producto tiene variantes, PREGUNTA al cliente cuál desea.
3. SOLO ofrece las variantes que existen en el catálogo. NO INVENTES tallas o colores.
4. Si el cliente pide una variante que no existe, dile amablemente que no está disponible y ofrece las que sí hay.
5. Verifica siempre el stock disponible antes de prometer un producto.
        `

        // Add customer and cart context
        if (customer) {
            fullSystemPrompt += "\n\n" + buildCustomerContext(customer, customerOrders || [])
        } else {
            fullSystemPrompt += "\n\n" + buildCustomerContext(undefined, undefined)
        }

        if (cart) {
            fullSystemPrompt += "\n\n" + buildCartContext(cart)
        }

        // 11. Properly type message history
        const messageHistory: Anthropic.MessageParam[] = [
            ...conversationHistory,
            { role: 'user' as const, content: input.message }
        ]

        let finalResponseText = ""
        let loopCount = 0
        const MAX_LOOPS = 5

        // 12. Main processing loop with proper typing
        while (loopCount < MAX_LOOPS) {
            loopCount++

            if (process.env.NODE_ENV !== 'production') {
                console.log(`[processMessage] Loop ${loopCount}, calling Claude...`)
            }

            const response = await createMessage({
                model: "claude-sonnet-4-20250514",
                max_tokens: 1024,
                system: fullSystemPrompt,
                messages: messageHistory,
                tools: tools // No more 'as any'
            })

            // Add assistant response to history
            messageHistory.push({
                role: "assistant",
                content: response.content
            })

            // 13. Properly type response content processing
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
                break // No more tools, we are done
            }

            // 14. Process tool calls with proper typing
            const toolResults: Anthropic.ToolResultBlockParam[] = []

            for (const toolBlock of toolUseBlocks) {
                const toolUse = toolBlock
                toolsUsed.push(toolUse.name)

                if (process.env.NODE_ENV !== 'production') {
                    console.log(`[processMessage] Executing tool: ${toolUse.name}`)
                }

                // 15. Properly type tool execution
                const toolContext: ToolContext = {
                    chatId: input.chatId,
                    organizationId: input.organizationId,
                    customerId: input.customerId
                }

                const toolResult: ToolResult = await executeTool(
                    toolUse.name,
                    toolUse.input,
                    toolContext
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
            messageHistory.push({
                role: "user",
                content: toolResults
            })
        }

        // 16. Save messages to database with proper error handling
        const messageInserts = [
            {
                chat_id: input.chatId,
                sender_type: "user" as const,
                content: input.message,
                metadata: {}
            },
            {
                chat_id: input.chatId,
                sender_type: "bot" as const,
                content: finalResponseText,
                metadata: {
                    model: "claude-sonnet-4-20250514",
                    tools_used: toolsUsed,
                    latency_ms: Date.now() - startTime
                }
            }
        ]

        const { error: saveError } = await supabase
            .from("messages")
            .insert(messageInserts)

        if (saveError) {
            console.error("Error saving messages:", saveError)
        }

        // 17. Return properly typed response
        return {
            response: finalResponseText,
            actions,
            metadata: {
                model: "claude-sonnet-4-20250514",
                latency_ms: Date.now() - startTime,
                tools_used: toolsUsed
            }
        }

    } catch (error: unknown) { // instead of 'any'
        // 18. Properly handle errors without logging sensitive info
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        
        if (process.env.NODE_ENV === 'production') {
            console.error("[processMessage] Error:", errorMessage)
        } else {
            console.error("[processMessage] ========== ERROR DETAILS ==========")
            console.error("[processMessage] Error name:", error instanceof Error ? error.name : 'Unknown')
            console.error("[processMessage] Error message:", errorMessage)
            console.error("[processMessage] Error stack:", error instanceof Error ? error.stack : 'No stack')
            console.error("[processMessage] =====================================")
        }

        // 19. Return fallback response
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