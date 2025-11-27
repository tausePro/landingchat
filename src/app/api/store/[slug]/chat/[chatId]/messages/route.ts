import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string; chatId: string }> }
) {
    const { slug, chatId } = await params
    const supabase = await createClient()

    // Verify organization
    const { data: organization } = await supabase
        .from("organizations")
        .select("id")
        .eq("slug", slug)
        .single()

    if (!organization) {
        return NextResponse.json({ error: "Organization not found" }, { status: 404 })
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
        // Note: Product cards are currently ephemeral in the frontend state 
        // and might not be fully persisted in message content.
        // Future improvement: Store structured content or actions in metadata.
    }))

    return NextResponse.json({ messages: formattedMessages })
}
