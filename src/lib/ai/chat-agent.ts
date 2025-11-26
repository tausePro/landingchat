import Anthropic from "@anthropic-ai/sdk"
import { createMessage } from "./anthropic"
import { tools } from "./tools"
import { buildSystemPrompt, buildProductContext, buildCustomerContext, buildConversationHistory, buildCartContext } from "./context"
import { executeTool } from "./tool-executor"
import { createClient } from "@/lib/supabase/server"

interface ProcessMessageInput {
    message: string
    chatId: string
    organizationId: string
    agentId: string
    customerId?: string
}

interface ProcessMessageOutput {
    response: string
    actions: Array<{
        type: string
        data: any
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
    const actions: Array<{ type: string; data: any }> = []

    try {
        console.log("[processMessage] Starting with input:", { chatId: input.chatId, agentId: input.agentId })
        const supabase = await createClient()

        // 1. Load agent configuration
        console.log("[processMessage] Loading agent configuration...")
        const { data: agent } = await supabase
            .from("agents")
            .select("*")
            .eq("id", input.agentId)
            .single()

        if (!agent) {
            throw new Error("Agent not found")
        }
        console.log("[processMessage] Agent loaded:", agent.name)

        // 2. Load organization
        console.log("[processMessage] Loading organization...")
        const { data: organization } = await supabase
            .from("organizations")
            .select("name")
            .eq("id", input.organizationId)
            .single()

        // 3. Load products catalog
        console.log("[processMessage] Loading products...")
        const { data: products } = await supabase
            .from("products")
            .select("*")
            .eq("organization_id", input.organizationId)
            .eq("is_active", true)

        console.log("[processMessage] Products loaded:", products?.length || 0)

        // 4. Load conversation history (last 10 messages)
        console.log("[processMessage] Loading conversation history...")
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
        console.log("[processMessage] Loading customer context...")
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
        console.log("[processMessage] Loading cart...")
        const { data: cart } = await supabase
            .from("carts")
            .select("*")
            .eq("chat_id", input.chatId)
            .eq("status", "active")
            .single()

        // 7. Build system prompt
        console.log("[processMessage] Building system prompt...")
        const systemPrompt = buildSystemPrompt(
            agent,
            organization?.name || "la tienda",
            products || []
        )

        // Add customer and cart context to system prompt
        let fullSystemPrompt = systemPrompt
        if (customer) {
            fullSystemPrompt += "\n\n" + buildCustomerContext(customer, customerOrders || [])
        }
        if (cart) {
            fullSystemPrompt += "\n\n" + buildCartContext(cart)
        }

        // 8. Add user message to history
        const currentHistory = [
            ...conversationHistory,
            { role: 'user' as const, content: input.message }
        ]

        // 9. Call Claude with tools
        console.log("[processMessage] Calling Claude API...")
        let response = await createMessage({
            model: "claude-3-5-sonnet-20240620",
            max_tokens: 1024,
            system: fullSystemPrompt,
            messages: currentHistory,
            tools: tools as any
        })

        console.log("[processMessage] Claude response received")

        let finalResponse = ""
        let continueLoop = true

        // 10. Process tool calls (may require multiple iterations)
        while (continueLoop) {
            continueLoop = false

            for (const content of response.content) {
                if (content.type === "text") {
                    finalResponse += content.text
                } else if (content.type === "tool_use") {
                    toolsUsed.push(content.name)

                    // Execute the tool
                    const toolResult = await executeTool(
                        content.name,
                        content.input,
                        {
                            chatId: input.chatId,
                            organizationId: input.organizationId,
                            customerId: input.customerId
                        }
                    )

                    // Add action to response
                    if (toolResult.success && toolResult.data) {
                        actions.push({
                            type: content.name,
                            data: toolResult.data
                        })
                    }

                    // If tool execution requires continuation, call Claude again
                    if (response.stop_reason === "tool_use") {
                        const toolResultMessage: Anthropic.MessageParam = {
                            role: "user",
                            content: [{
                                type: "tool_result",
                                tool_use_id: content.id,
                                content: JSON.stringify(toolResult)
                            }]
                        }

                        response = await createMessage({
                            model: "claude-3-5-sonnet-20240620",
                            max_tokens: 1024,
                            system: fullSystemPrompt,
                            messages: [...currentHistory, toolResultMessage],
                            tools: tools as any
                        })

                        continueLoop = true
                        break
                    }
                }
            }
        }

        // 11. Save user message to DB
        await supabase.from("messages").insert({
            chat_id: input.chatId,
            sender_type: "user",
            content: input.message,
            metadata: {}
        })

        // 12. Save assistant response to DB
        await supabase.from("messages").insert({
            chat_id: input.chatId,
            sender_type: "bot",
            content: finalResponse,
            metadata: {
                model: "claude-3-5-sonnet-20240620",
                tokens: {
                    input: response.usage.input_tokens,
                    output: response.usage.output_tokens
                },
                tools_used: toolsUsed,
                latency_ms: Date.now() - startTime
            }
        })

        // 13. Return response
        return {
            response: finalResponse,
            actions,
            metadata: {
                model: "claude-3-5-sonnet-20240620",
                tokens_used: {
                    input: response.usage.input_tokens,
                    output: response.usage.output_tokens
                },
                latency_ms: Date.now() - startTime,
                tools_used: toolsUsed
            }
        }

    } catch (error: any) {
        console.error("[processMessage] ERROR:", error)
        console.error("[processMessage] Error stack:", error.stack)
        console.error("[processMessage] Error details:", JSON.stringify(error, Object.getOwnPropertyNames(error)))

        // Return fallback response
        return {
            response: "Lo siento, tuve un problema procesando tu mensaje. ¿Podrías intentarlo de nuevo?",
            actions: [],
            metadata: {
                model: "claude-3-5-sonnet-20240620",
                latency_ms: Date.now() - startTime,
                tools_used: toolsUsed
            }
        }
    }
}
