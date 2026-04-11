import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { getValidatedStorefrontCustomerSession } from "@/lib/storefrontAccess"

export async function GET(
    _request: NextRequest,
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

    const storefrontSession = await getValidatedStorefrontCustomerSession({
        slug,
        organizationId: organization.id,
    })

    if (!storefrontSession) {
        return NextResponse.json({ error: "Acceso no autorizado" }, { status: 403 })
    }

    // Security: Verify chat belongs to this organization and storefront customer
    const { data: chat } = await supabase
        .from("chats")
        .select("id, customer_id")
        .eq("id", chatId)
        .eq("organization_id", organization.id)
        .single()

    if (!chat || chat.customer_id !== storefrontSession.customerId) {
        return NextResponse.json({ error: "Chat not found" }, { status: 404 })
    }

    // Fetch messages (now secure - chat ownership verified)
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
    const formattedMessages = (messages ?? []).map((msg: {
        id: string
        sender_type: string
        content: string | null
        created_at: string
    }) => ({
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
