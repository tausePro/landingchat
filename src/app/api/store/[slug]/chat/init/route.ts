import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { chatInitRateLimit, getClientIdentifier, getRateLimitHeaders } from "@/lib/rate-limit"
import { createServiceClient } from "@/lib/supabase/server"
import { resolvePublicOrganization } from "@/lib/storefront/resolvePublicOrganization"
import { getValidatedStorefrontCustomerSession } from "@/lib/storefrontAccess"

const chatInitSchema = z.object({
    customerId: z.string().uuid("Customer ID inválido").optional()
})

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params

    // Rate limiting: 5 sesiones por minuto por IP
    const clientId = getClientIdentifier(request)
    const rateLimitResult = await chatInitRateLimit.limit(clientId)
    const headers = getRateLimitHeaders(rateLimitResult)

    if (!rateLimitResult.success) {
        return NextResponse.json(
            { error: "Demasiadas solicitudes. Intenta de nuevo en un momento." },
            { status: 429, headers }
        )
    }

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

        const { customerId: requestedCustomerId } = validation.data

        const supabase = createServiceClient()

        const organization = await resolvePublicOrganization(supabase, { slug })

        if (!organization) {
            return NextResponse.json({ error: "Tienda no encontrada" }, { status: 404 })
        }

        // Tenant isolation defensivo (Bug G):
        // Cualquier fallo en la obtención/validación de la sesión del storefront
        // se trata como "sin sesión". Incluye excepciones del subsistema de
        // cookies (contexto sin request store válido, corrupciones raras, etc.)
        // para no propagar un 500 distinguible de otros códigos.
        let storefrontSession: Awaited<ReturnType<typeof getValidatedStorefrontCustomerSession>> = null
        try {
            storefrontSession = await getValidatedStorefrontCustomerSession({
                slug,
                organizationId: organization.id,
            })
        } catch {
            storefrontSession = null
        }

        // Si el request trae customerId, toda inconsistencia (sin sesión, sesión
        // de otro tenant, mismatch de customerId) responde 404 "Cliente no
        // encontrado" uniforme. Impide que un atacante enumere customers de
        // otros tenants distinguiendo 401/403/404/500.
        if (requestedCustomerId) {
            if (!storefrontSession || storefrontSession.customerId !== requestedCustomerId) {
                return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404, headers })
            }
        }

        // Sin customerId y sin sesión: cliente legítimo que aún no se ha
        // identificado. Se mantiene 401 para que el flujo de identificación
        // pueda actuar.
        if (!storefrontSession) {
            return NextResponse.json({ error: "Sesión inválida o expirada" }, { status: 401, headers })
        }

        const { data: customer } = await supabase
            .from("customers")
            .select("id, full_name, total_orders")
            .eq("id", storefrontSession.customerId)
            .eq("organization_id", organization.id)
            .single()

        if (!customer) {
            return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404, headers })
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

        const greeting = isReturning
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

    } catch (error: unknown) {
        console.error("Error initializing chat:", error)
        return NextResponse.json({ error: "Error interno" }, { status: 500 })
    }
}
