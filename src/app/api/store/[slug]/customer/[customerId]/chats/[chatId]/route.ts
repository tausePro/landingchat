import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { getValidatedStorefrontCustomerSession } from "@/lib/storefrontAccess"

/**
 * DELETE /api/store/[slug]/customer/[customerId]/chats/[chatId]
 * Deletes a specific chat for a customer
 */
export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ slug: string; customerId: string; chatId: string }> }
) {
    const { slug, customerId, chatId } = await params

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

    // Verify chat belongs to this customer and organization
    const { data: chat, error: chatError } = await supabase
        .from("chats")
        .select("id")
        .eq("id", chatId)
        .eq("customer_id", storefrontSession.customerId)
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
