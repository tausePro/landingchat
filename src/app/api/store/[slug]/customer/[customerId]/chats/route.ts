import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * GET /api/store/[slug]/customer/[customerId]/chats
 * Returns list of chats for a specific customer in an organization
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string; customerId: string }> }
) {
    const { slug, customerId } = await params
    const supabase = await createClient()

    // Get organization by slug
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

    // Fetch customer's chats for this organization
    const { data: chats, error: chatsError } = await supabase
        .from("chats")
        .select(`
            id,
            created_at,
            updated_at,
            status,
            messages:messages(content, created_at)
        `)
        .eq("organization_id", organization.id)
        .eq("customer_id", customerId)
        .order("updated_at", { ascending: false })
        .limit(20)

    if (chatsError) {
        console.error("Error fetching customer chats:", chatsError)
        return NextResponse.json(
            { error: "Error fetching chats" },
            { status: 500 }
        )
    }

    // Format chats with a title derived from first message or date
    const formattedChats = (chats || []).map((chat: any) => {
        // Get first user message as title, or use date
        const firstMessage = chat.messages?.find((m: any) => m.content)
        const title = firstMessage?.content?.slice(0, 40) ||
            `Conversación del ${new Date(chat.created_at).toLocaleDateString('es-CO')}`

        return {
            id: chat.id,
            title: title + (firstMessage?.content?.length > 40 ? '...' : ''),
            created_at: chat.created_at,
            updated_at: chat.updated_at,
            status: chat.status
        }
    })

    return NextResponse.json({ chats: formattedChats })
}
