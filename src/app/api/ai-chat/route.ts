import { NextRequest, NextResponse } from "next/server"
import { processMessage } from "@/lib/ai/chat-agent"
import { createServiceClient } from "@/lib/supabase/server"
import { aiChatRateLimit, getClientIdentifier, getRateLimitHeaders } from "@/lib/rate-limit"
import { canCreateResource } from "@/lib/utils/subscription"
import { resolvePublicOrganization } from "@/lib/storefront/resolvePublicOrganization"
import { getValidatedStorefrontCustomerSession } from "@/lib/storefrontAccess"
import { z } from "zod"
import { logger } from "@/lib/logger"

const log = logger("api/ai-chat")

const cartItemSchema = z.object({
    id: z.string(),
    name: z.string(),
    price: z.number(),
    quantity: z.number(),
    image_url: z.string().optional()
})

const aiChatSchema = z.object({
    message: z.string().min(1, "Message is required").max(2000, "Message too long"),
    chatId: z.string().uuid().optional(),
    slug: z.string().min(1, "Slug is required"),
    customerId: z.string().uuid().optional(),
    currentProductId: z.string().uuid().optional(),
    context: z.string().optional(),
    cartItems: z.array(cartItemSchema).optional() // Carrito del frontend
})

export async function POST(request: NextRequest) {
    // Apply rate limiting
    const clientId = getClientIdentifier(request)
    const rateLimitResult = await aiChatRateLimit.limit(clientId)

    // Add rate limit headers to all responses
    const headers = getRateLimitHeaders(rateLimitResult)

    if (!rateLimitResult.success) {
        return NextResponse.json(
            {
                error: "Rate limit exceeded. Please wait before sending another message.",
                retryAfter: Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
            },
            {
                status: 429,
                headers
            }
        )
    }

    try {
        const body = await request.json()

        // Validate request body with Zod
        const validation = aiChatSchema.safeParse(body)
        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error.issues[0].message },
                { status: 400, headers }
            )
        }

        const { message, chatId, slug, customerId: requestedCustomerId, currentProductId, cartItems } = validation.data

        const supabase = createServiceClient()

        const organization = await resolvePublicOrganization(supabase, { slug })

        if (!organization) {
            return NextResponse.json(
                { error: "Organization not found" },
                { status: 404, headers }
            )
        }

        const storefrontSession = await getValidatedStorefrontCustomerSession({
            slug,
            organizationId: organization.id,
        })

        if (!storefrontSession) {
            return NextResponse.json(
                { error: "Sesión inválida o expirada" },
                { status: 401, headers }
            )
        }

        if (requestedCustomerId && requestedCustomerId !== storefrontSession.customerId) {
            return NextResponse.json(
                { error: "Sesión inválida o expirada" },
                { status: 403, headers }
            )
        }

        // Get or create chat
        let currentChatId = chatId
        let agentId: string
        const customerId = storefrontSession.customerId

        if (!currentChatId) {
            const { data: existingActiveChat } = await supabase
                .from("chats")
                .select("id, assigned_agent_id")
                .eq("organization_id", organization.id)
                .eq("customer_id", customerId)
                .eq("status", "active")
                .is("channel", null)
                .order("updated_at", { ascending: false })
                .limit(1)
                .maybeSingle()

            if (existingActiveChat?.assigned_agent_id) {
                currentChatId = existingActiveChat.id
                agentId = existingActiveChat.assigned_agent_id
            } else {
                const { data: agent } = await supabase
                    .from("agents")
                    .select("id")
                    .eq("organization_id", organization.id)
                    .eq("status", "available")
                    .eq("type", "bot")
                    .single()

                if (!agent) {
                    return NextResponse.json(
                        { error: "No active agent found for this organization" },
                        { status: 404, headers }
                    )
                }

                // Verificar límite de conversaciones mensuales del plan solo al crear una nueva
                const resourceCheck = await canCreateResource(organization.id, "conversation", supabase)
                if (!resourceCheck.allowed) {
                    return NextResponse.json(
                        { error: resourceCheck.message || "Esta tienda ha alcanzado el límite de conversaciones de su plan." },
                        { status: 429, headers }
                    )
                }

                const { data: newChat, error: chatError } = await supabase
                    .from("chats")
                    .insert({
                        organization_id: organization.id,
                        customer_id: storefrontSession.customerId,
                        assigned_agent_id: agent.id,
                        status: "active"
                    })
                    .select()
                    .single()

                if (chatError || !newChat) {
                    log.error("Chat creation error", { error: chatError?.message })
                    return NextResponse.json(
                        { error: "Failed to create chat", details: chatError?.message },
                        { status: 500, headers }
                    )
                }

                currentChatId = newChat.id
                agentId = agent.id
            }
        } else {
            // Get agent ID from existing chat - SECURITY: validate ownership
            const { data: chat, error: chatQueryError } = await supabase
                .from("chats")
                .select("assigned_agent_id, customer_id, organization_id")
                .eq("id", currentChatId)
                .eq("organization_id", organization.id) // Security: validate chat belongs to this org
                .single()

            if (chatQueryError || !chat) {
                log.error("Chat query error", { error: chatQueryError?.message })
                return NextResponse.json(
                    { error: "Chat not found" },
                    { status: 404, headers }
                )
            }

            if (chat.customer_id !== storefrontSession.customerId) {
                return NextResponse.json(
                    { error: "Chat not found" },
                    { status: 404, headers }
                )
            }

            agentId = chat.assigned_agent_id
        }

        // Sync frontend cart with database (if cartItems provided)
        if (cartItems && cartItems.length > 0 && currentChatId) {
            // Transform frontend cart items to DB format
            const dbCartItems = cartItems.map(item => ({
                product_id: item.id,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                image_url: item.image_url || null
            }))

            // Upsert cart in database
            const { data: existingCart } = await supabase
                .from("carts")
                .select("id")
                .eq("chat_id", currentChatId)
                .eq("status", "active")
                .single()

            if (existingCart) {
                // Update existing cart
                await supabase
                    .from("carts")
                    .update({
                        items: dbCartItems,
                        updated_at: new Date().toISOString()
                    })
                    .eq("id", existingCart.id)
            } else {
                // Create new cart
                await supabase
                    .from("carts")
                    .insert({
                        organization_id: organization.id,
                        chat_id: currentChatId,
                        customer_id: customerId || null,
                        items: dbCartItems,
                        status: "active"
                    })
            }
        }

        // Guardar mensaje del usuario en la base de datos
        await supabase.from("messages").insert({
            chat_id: currentChatId,
            sender_type: "user",
            content: message,
            metadata: {
                source: "web_chat",
                ...(currentProductId ? { product_context: currentProductId } : {})
            }
        })

        // Process message with AI agent
        const result = await processMessage({
            message,
            chatId: currentChatId!,
            organizationId: organization.id,
            agentId: agentId,
            customerId: customerId,
            currentProductId: currentProductId // Pass the product ID from context
        })

        return NextResponse.json({
            message: result.response,
            actions: result.actions,
            chatId: currentChatId,
            metadata: result.metadata
        }, { headers })

    } catch (error: unknown) {
        const errorName = error instanceof Error ? error.name : "UnknownError"
        const errorMessage = error instanceof Error ? error.message : "Unknown error"

        log.error("Error in chat API", { name: errorName, message: errorMessage })
        return NextResponse.json(
            { error: "Internal server error", details: errorMessage },
            { status: 500, headers }
        )
    }
}
