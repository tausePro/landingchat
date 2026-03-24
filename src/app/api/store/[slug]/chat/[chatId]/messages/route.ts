import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string; chatId: string }> }
) {
    const { slug, chatId } = await params
    const supabase = createServiceClient()

    // Verify organization
    const { data: organization } = await supabase
        .from("organizations")
        .select("id")
        .eq("slug", slug)
        .single()

    if (!organization) {
        return NextResponse.json({ error: "Organization not found" }, { status: 404 })
    }

    // Security: Verify chat belongs to this organization
    const { data: chat } = await supabase
        .from("chats")
        .select("id, assigned_agent_id")
        .eq("id", chatId)
        .eq("organization_id", organization.id)
        .single()

    if (!chat) {
        return NextResponse.json({ error: "Chat not found" }, { status: 404 })
    }

    // Fetch agent info
    let agent: { name: string; avatar_url: string | null } | null = null
    if (chat.assigned_agent_id) {
        const { data: agentData } = await supabase
            .from("agents")
            .select("name, avatar_url")
            .eq("id", chat.assigned_agent_id)
            .single()
        if (agentData) {
            agent = { name: agentData.name, avatar_url: agentData.avatar_url }
        }
    }

    // Fetch messages
    const { data: messages, error } = await supabase
        .from("messages")
        .select("*")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true })

    if (error) {
        console.error("Error fetching messages:", error)
        return NextResponse.json({ error: "Error fetching messages" }, { status: 500 })
    }

    // Map to frontend format
    const formattedMessages = messages.map((msg: any) => ({
        id: msg.id,
        role: msg.sender_type === "user" ? "user" : "assistant",
        content: msg.content,
        timestamp: msg.created_at,
    }))

    return NextResponse.json({ messages: formattedMessages, agent })
}
