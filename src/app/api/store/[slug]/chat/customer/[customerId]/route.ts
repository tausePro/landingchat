import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string; customerId: string }> }
) {
    const { slug, customerId } = await params

    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        // Verify organization
        const { data: organization } = await supabase
            .from("organizations")
            .select("id")
            .eq("slug", slug)
            .single()

        if (!organization) {
            return NextResponse.json({ error: "Organization not found" }, { status: 404 })
        }

        // Fetch chats for the customer
        const { data: chats, error } = await supabase
            .from("chats")
            .select(`
                id,
                created_at,
                status,
                messages (
                    content,
                    created_at
                )
            `)
            .eq("organization_id", organization.id)
            .eq("customer_id", customerId)
            .order("created_at", { ascending: false })

        if (error) {
            console.error("Error fetching chats:", error)
            return NextResponse.json({ error: "Error fetching chats" }, { status: 500 })
        }

        // Process chats to get the last message for preview
        const formattedChats = chats.map((chat: any) => {
            // Sort messages by created_at desc to get the last one
            const sortedMessages = chat.messages.sort((a: any, b: any) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )
            const lastMessage = sortedMessages[0]

            return {
                id: chat.id,
                created_at: chat.created_at,
                status: chat.status,
                last_message: lastMessage ? lastMessage.content : "Nueva conversación",
                last_message_at: lastMessage ? lastMessage.created_at : chat.created_at
            }
        })

        return NextResponse.json({ chats: formattedChats })

    } catch (error) {
        console.error("Error in chat history API:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
