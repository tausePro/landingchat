import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

/**
 * DELETE /api/store/[slug]/customer/[customerId]/chats/[chatId]
 * Deletes a specific chat for a customer
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string; customerId: string; chatId: string }> }
) {
    const { slug, customerId, chatId } = await params

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

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

    // Verify chat belongs to this customer and organization
    const { data: chat, error: chatError } = await supabase
        .from("chats")
        .select("id")
        .eq("id", chatId)
        .eq("customer_id", customerId)
        .eq("organization_id", organization.id)
        .single()

    if (chatError || !chat) {
        return NextResponse.json(
            { error: "Chat not found or not authorized" },
            { status: 404 }
        )
    }

    // Delete messages first (foreign key constraint)
    await supabase
        .from("messages")
        .delete()
        .eq("chat_id", chatId)

    // Delete the chat
    const { error: deleteError } = await supabase
        .from("chats")
        .delete()
        .eq("id", chatId)

    if (deleteError) {
        console.error("Error deleting chat:", deleteError)
        return NextResponse.json(
            { error: "Error deleting chat" },
            { status: 500 }
        )
    }

    return NextResponse.json({ success: true })
}
