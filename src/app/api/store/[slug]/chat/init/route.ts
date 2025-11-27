import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params

    try {
        const body = await request.json()
        const { customerId } = body

        if (!customerId) {
            return NextResponse.json(
                { error: "Customer ID requerido" },
                { status: 400 }
            )
        }

        const supabase = await createClient()

        // Obtener organización
        const { data: organization } = await supabase
            .from("organizations")
            .select("id, name")
            .eq("slug", slug)
            .single()

        if (!organization) {
            return NextResponse.json(
                { error: "Tienda no encontrada" },
                { status: 404 }
            )
        }

        // Obtener cliente
        const { data: customer } = await supabase
            .from("customers")
            .select("id, full_name, total_orders")
            .eq("id", customerId)
            .single()

        if (!customer) {
            return NextResponse.json(
                { error: "Cliente no encontrado" },
                { status: 404 }
            )
        }

        // Buscar agente bot disponible
        const { data: agent } = await supabase
            .from("agents")
            .select("id, name, configuration, avatar_url")
            .eq("organization_id", organization.id)
            .eq("type", "bot")
            .eq("status", "available")
            .single()

        if (!agent) {
            return NextResponse.json(
                { error: "No hay agentes disponibles" },
                { status: 503 }
            )
        }

        // Buscar chat activo existente
        const { data: existingChat } = await supabase
            .from("chats")
            .select("id, assigned_agent_id")
            .eq("organization_id", organization.id)
            .eq("customer_id", customer.id)
            .eq("status", "active")
            .order("created_at", { ascending: false })
            .limit(1)
            .single()

        let chat: any
        let greeting: string = ""

        if (existingChat) {
            chat = existingChat
            // Si ya existe chat, no generamos saludo nuevo, o recuperamos el último?
            // Por ahora devolvemos vacío y dejamos que el historial cargue los mensajes
        } else {
            // Crear nuevo chat vinculado al customer
            const { data: newChat, error: chatError } = await supabase
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
                return NextResponse.json(
                    { error: "Error al crear chat" },
                    { status: 500 }
                )
            }
            chat = newChat

            // Generar saludo personalizado
            const firstName = customer.full_name.split(" ")[0]
            const isReturning = (customer.total_orders || 0) > 0

            if (isReturning) {
                greeting = `¡Hola ${firstName}! Qué gusto verte de nuevo. ¿En qué puedo ayudarte hoy?`
            } else {
                greeting = agent.configuration?.greeting?.replace("{name}", firstName)
                    || `¡Hola ${firstName}! Bienvenido/a a ${organization.name}. Soy ${agent.name}, ¿qué estás buscando hoy?`
            }

            // Guardar mensaje de bienvenida
            await supabase.from("messages").insert({
                chat_id: chat.id,
                sender_type: "bot",
                sender_id: agent.id,
                content: greeting,
                metadata: { type: "greeting" }
            })
        }

        return NextResponse.json({
            chatId: chat.id,
            greeting,
            agent: {
                name: agent.name,
                avatar: agent.avatar_url
            }
        })

    } catch (error: any) {
        console.error("Error initializing chat:", error)
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        )
    }
}
