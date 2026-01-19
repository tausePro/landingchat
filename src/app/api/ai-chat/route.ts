import { NextRequest, NextResponse } from "next/server"
import { processMessage } from "@/lib/ai/chat-agent"
import { createServiceClient } from "@/lib/supabase/server"
import { aiChatRateLimit, getClientIdentifier, getRateLimitHeaders } from "@/lib/rate-limit"
import { z } from "zod"

const aiChatSchema = z.object({
    message: z.string().min(1, "Message is required").max(2000, "Message too long"),
    chatId: z.string().uuid().optional(),
    slug: z.string().min(1, "Slug is required"),
    customerId: z.string().uuid().optional(),
    currentProductId: z.string().uuid().optional(),
    context: z.string().optional()
})

export async function POST(request: NextRequest) {
    console.log("API /api/ai-chat called")
    console.log("[ai-chat] ANTHROPIC_API_KEY configured:", !!process.env.ANTHROPIC_API_KEY)
    console.log("[ai-chat] SUPABASE_SERVICE_ROLE_KEY configured:", !!process.env.SUPABASE_SERVICE_ROLE_KEY)

    // Apply rate limiting
    const clientId = getClientIdentifier(request)
    const rateLimitResult = await aiChatRateLimit.limit(clientId)

    // Add rate limit headers to all responses
    const headers = getRateLimitHeaders(rateLimitResult)

    if (!rateLimitResult.success) {
        return NextResponse.json(
            {
                error: "Rate limit exceeded. Please wait before sending another message.",
                retryAfter: Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
            },
            {
                status: 429,
                headers
            }
        )
    }

    try {
        const body = await request.json()

        // Validate request body with Zod
        const validation = aiChatSchema.safeParse(body)
        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error.issues[0].message },
                { status: 400, headers }
            )
        }

        const { message, chatId, slug, customerId: bodyCustomerId, currentProductId } = validation.data

        const supabase = createServiceClient()

        // Get organization from slug
        const { data: organization, error: orgError } = await supabase
            .from("organizations")
            .select("id")
            .eq("slug", slug)
            .single()

        if (orgError || !organization) {
            return NextResponse.json(
                { error: "Organization not found" },
                { status: 404, headers }
            )
        }

        // Get or create chat
        let currentChatId = chatId
        let agentId: string
        let customerId: string | undefined

        if (!currentChatId) {
            // Create new chat
            const { data: agent } = await supabase
                .from("agents")
                .select("id")
                .eq("organization_id", organization.id)
                .eq("status", "available")
                .eq("type", "bot")
                .single()

            if (!agent) {
                return NextResponse.json(
                    { error: "No active agent found for this organization" },
                    { status: 404, headers }
                )
            }

            const { data: newChat, error: chatError } = await supabase
                .from("chats")
                .insert({
                    organization_id: organization.id,
                    assigned_agent_id: agent.id,
                    status: "active"
                })
                .select()
                .single()

            if (chatError || !newChat) {
                console.error("Chat creation error:", chatError)
                return NextResponse.json(
                    { error: "Failed to create chat", details: chatError?.message },
                    { status: 500, headers }
                )
            }

            currentChatId = newChat.id
            agentId = agent.id
            customerId = undefined
        } else {
            // Get agent ID from existing chat - SECURITY: validate ownership
            const { data: chat, error: chatQueryError } = await supabase
                .from("chats")
                .select("assigned_agent_id, customer_id, organization_id")
                .eq("id", currentChatId)
                .eq("organization_id", organization.id) // Security: validate chat belongs to this org
                .single()

            if (chatQueryError || !chat) {
                console.error("Chat query error:", chatQueryError)
                return NextResponse.json(
                    { error: "Chat not found" },
                    { status: 404, headers }
                )
            }

            agentId = chat.assigned_agent_id
            // Usar customerId del body si existe, sino del chat
            customerId = bodyCustomerId || chat.customer_id
        }

        // Process message with AI agent
        const result = await processMessage({
            message,
            chatId: currentChatId!,
            organizationId: organization.id,
            agentId: agentId,
            customerId: customerId,
            currentProductId: currentProductId // Pass the product ID from context
        })

        return NextResponse.json({
            message: result.response,
            actions: result.actions,
            chatId: currentChatId,
            metadata: result.metadata
        }, { headers })

    } catch (error: any) {
        console.error("Error in chat API:", error)
        console.error("Error details:", JSON.stringify(error, Object.getOwnPropertyNames(error)))
        return NextResponse.json(
            { error: "Internal server error", details: error.message },
            { status: 500, headers }
        )
    }
}
