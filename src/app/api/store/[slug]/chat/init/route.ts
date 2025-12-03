import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { z } from "zod"

const chatInitSchema = z.object({
    customerId: z.string().uuid("Customer ID inválido")
})

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params

    try {
        const body = await request.json()

        // Validate request body with Zod
        const validation = chatInitSchema.safeParse(body)
        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error.issues[0].message },
                { status: 400 }
            )
        }

        const { customerId } = validation.data

        // Use service role key to bypass RLS
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        const { data: organization } = await supabase
            .from("organizations")
            .select("id, name")
            .eq("slug", slug)
            .single()

        if (!organization) {
            return NextResponse.json({ error: "Tienda no encontrada" }, { status: 404 })
        }

        const { data: customer } = await supabase
            .from("customers")
            .select("id, full_name, total_orders")
            .eq("id", customerId)
            .single()

        if (!customer) {
            return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 })
        }

        const { data: agent } = await supabase
            .from("agents")
            .select("id, name, configuration, avatar_url")
            .eq("organization_id", organization.id)
            .eq("type", "bot")
            .eq("status", "available")
            .single()

        if (!agent) {
            return NextResponse.json({ error: "No hay agentes disponibles" }, { status: 503 })
        }

        const { data: chat, error: chatError } = await supabase
            .from("chats")
            .insert({
                organization_id: organization.id,
                customer_id: customer.id,
                assigned_agent_id: agent.id,
                status: "active"
            })
            .select("id")
            .single()

        if (chatError) {
            console.error("Error creating chat:", chatError)
            return NextResponse.json({ error: "Error al crear chat" }, { status: 500 })
        }

        const firstName = customer.full_name.split(" ")[0]
        const isReturning = (customer.total_orders || 0) > 0

        let greeting = isReturning
            ? `¡Hola ${firstName}! Qué gusto verte de nuevo. ¿En qué puedo ayudarte hoy?`
            : `¡Hola ${firstName}! Bienvenido/a a ${organization.name}. Soy ${agent.name}, ¿qué estás buscando hoy?`

        await supabase.from("messages").insert({
            chat_id: chat.id,
            sender_type: "bot",
            sender_id: agent.id,
            content: greeting,
            metadata: { type: "greeting" }
        })

        return NextResponse.json({
            chatId: chat.id,
            greeting,
            agent: {
                id: agent.id,
                name: agent.name,
                avatar_url: agent.avatar_url
            }
        })

    } catch (error: any) {
        console.error("Error initializing chat:", error)
        return NextResponse.json({ error: "Error interno" }, { status: 500 })
    }
}
