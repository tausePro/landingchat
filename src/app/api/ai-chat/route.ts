import { NextRequest, NextResponse } from "next/server"
import { processMessage } from "@/lib/ai/chat-agent"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"

const aiChatSchema = z.object({
    message: z.string().min(1, "Message is required").max(2000, "Message too long"),
    chatId: z.string().uuid().optional(),
    slug: z.string().min(1, "Slug is required"),
    customerId: z.string().uuid().optional(),
    currentProductId: z.string().uuid().optional()
})

export async function POST(request: NextRequest) {
    console.log("API /api/ai-chat called")
    try {
        const body = await request.json()

        // Validate request body with Zod
        const validation = aiChatSchema.safeParse(body)
        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error.issues[0].message },
                { status: 400 }
            )
        }

        const { message, chatId, slug, customerId, currentProductId } = validation.data

        const supabase = await createClient()

        // Get organization from slug
        const { data: organization, error: orgError } = await supabase
            .from("organizations")
            .select("id")
            .eq("slug", slug)
            .single()

        if (orgError || !organization) {
            return NextResponse.json(
                { error: "Organization not found" },
                { status: 404 }
            )
        }

        // Get or create chat
        let currentChatId = chatId
        let agentId: string
        let effectiveCustomerId: string | undefined = customerId

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
                    { status: 404 }
                )
            }

            const { data: newChat, error: chatError } = await supabase
                .from("chats")
                .insert({
                    organization_id: organization.id,
                    assigned_agent_id: agent.id,
                    customer_id: customerId || null,
                    status: "active"
                })
                .select()
                .single()

            if (chatError || !newChat) {
                console.error("Chat creation error:", chatError)
                return NextResponse.json(
                    { error: "Failed to create chat", details: chatError?.message },
                    { status: 500 }
                )
            }

            currentChatId = newChat.id
            agentId = agent.id
        } else {
            // Get agent ID from existing chat
            const { data: chat, error: chatQueryError } = await supabase
                .from("chats")
                .select("assigned_agent_id, customer_id")
                .eq("id", currentChatId)
                .single()

            if (chatQueryError || !chat) {
                console.error("Chat query error:", chatQueryError)
                return NextResponse.json(
                    { error: "Chat not found", details: chatQueryError?.message },
                    { status: 404 }
                )
            }

            agentId = chat.assigned_agent_id
            effectiveCustomerId = customerId || chat.customer_id
        }

        // Process message with AI agent
        const result = await processMessage({
            message,
            chatId: currentChatId!,
            organizationId: organization.id,
            agentId: agentId,
            customerId: effectiveCustomerId,
            currentProductId: currentProductId // Pass the product ID from context
        })

        return NextResponse.json({
            message: result.response,
            actions: result.actions,
            chatId: currentChatId,
            metadata: result.metadata
        })

    } catch (error: any) {
        console.error("Error in chat API:", error)
        console.error("Error details:", JSON.stringify(error, Object.getOwnPropertyNames(error)))
        return NextResponse.json(
            { error: "Internal server error", details: error.message },
            { status: 500 }
        )
    }
}
