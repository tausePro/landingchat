import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { getValidatedStorefrontCustomerSession } from "@/lib/storefrontAccess"
import { formatBogotaDate } from "@/lib/utils/date"

/**
 * GET /api/store/[slug]/customer/[customerId]/chats
 * Returns list of chats for a specific customer in an organization
 */
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ slug: string; customerId: string }> }
) {
    const { slug, customerId } = await params
    const supabase = createServiceClient()

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

    const storefrontSession = await getValidatedStorefrontCustomerSession({
        slug,
        organizationId: organization.id,
        customerId,
    })

    if (!storefrontSession) {
        return NextResponse.json(
            { error: "Acceso no autorizado" },
            { status: 403 }
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
        .eq("customer_id", storefrontSession.customerId)
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
    const formattedChats = (chats || []).map((chat: {
        id: string
        created_at: string
        updated_at: string
        status: string
        messages: Array<{ content: string | null; created_at: string }> | null
    }) => {
        // Get first user message as title, or use date
        const firstMessage = chat.messages?.find((message) => message.content)
        const title = firstMessage?.content?.slice(0, 40) ||
            `Conversación del ${formatBogotaDate(chat.created_at)}`
        const shouldTruncateTitle = (firstMessage?.content?.length ?? 0) > 40

        return {
            id: chat.id,
            title: title + (shouldTruncateTitle ? '...' : ''),
            created_at: chat.created_at,
            updated_at: chat.updated_at,
            status: chat.status
        }
    })

    return NextResponse.json({ chats: formattedChats })
}
