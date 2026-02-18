/**
 * OAuth Callback para Instagram DM y Facebook Messenger
 *
 * Recibe el access token del frontend (después del Facebook Login)
 * y obtiene las páginas/cuentas de IG del usuario para guardarlas.
 *
 * Flujo:
 * 1. Frontend hace FB.login → obtiene short-lived user token
 * 2. Frontend envía token + platform aquí
 * 3. Backend intercambia por long-lived token
 * 4. Backend obtiene páginas del usuario (con page access tokens)
 * 5. Backend guarda en social_channels
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { z } from "zod"

const META_GRAPH_API = "https://graph.facebook.com/v24.0"

const CallbackSchema = z.object({
    access_token: z.string().min(1),
    platform: z.enum(["instagram", "messenger"]),
    selected_page_id: z.string().optional(),
})

export async function POST(request: NextRequest) {
    try {
        // Verificar autenticación
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 })
        }

        // Obtener organización
        const { data: profile } = await supabase
            .from("profiles")
            .select("organization_id")
            .eq("id", user.id)
            .single()

        if (!profile?.organization_id) {
            return NextResponse.json({ error: "Sin organización" }, { status: 400 })
        }

        const orgId = profile.organization_id

        // Parsear body
        const body = await request.json()
        const validation = CallbackSchema.safeParse(body)

        if (!validation.success) {
            return NextResponse.json(
                { error: "Datos inválidos", details: validation.error.issues },
                { status: 400 }
            )
        }

        const { access_token, platform, selected_page_id } = validation.data

        // Obtener config global de Meta (app_id, app_secret)
        const serviceClient = createServiceClient()
        const { data: settings } = await serviceClient
            .from("system_settings")
            .select("value")
            .eq("key", "meta_whatsapp_config")
            .single()

        if (!settings?.value) {
            return NextResponse.json(
                { error: "Meta no está configurado" },
                { status: 500 }
            )
        }

        const metaConfig = settings.value as Record<string, string>

        // Intercambiar por long-lived user token
        const longLivedRes = await fetch(
            `${META_GRAPH_API}/oauth/access_token?` +
            `grant_type=fb_exchange_token&` +
            `client_id=${metaConfig.app_id}&` +
            `client_secret=${metaConfig.app_secret}&` +
            `fb_exchange_token=${access_token}`
        )

        const longLivedData = await longLivedRes.json()
        if (!longLivedData.access_token) {
            console.error("[Social Channels Callback] Failed to get long-lived token:", longLivedData)
            return NextResponse.json(
                { error: "Error al obtener token de larga duración" },
                { status: 500 }
            )
        }

        const longLivedToken = longLivedData.access_token

        // Obtener páginas del usuario (con page access tokens)
        const pagesRes = await fetch(
            `${META_GRAPH_API}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,profile_picture_url}&access_token=${longLivedToken}`
        )

        const pagesData = await pagesRes.json()
        if (!pagesData.data || pagesData.data.length === 0) {
            return NextResponse.json(
                { error: "No se encontraron páginas de Facebook. Asegúrate de tener una página de Facebook vinculada." },
                { status: 400 }
            )
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pages = pagesData.data as any[]

        // Si hay varias páginas y no se seleccionó una, devolver lista para que el usuario elija
        if (pages.length > 1 && !selected_page_id) {
            return NextResponse.json({
                success: false,
                needs_selection: true,
                pages: pages.map(p => ({
                    id: p.id,
                    name: p.name,
                    instagram_account: p.instagram_business_account ? {
                        id: p.instagram_business_account.id,
                        username: p.instagram_business_account.username,
                        profile_picture_url: p.instagram_business_account.profile_picture_url,
                    } : null,
                })),
            })
        }

        // Seleccionar la página (primera o la seleccionada)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const selectedPage = selected_page_id
            ? pages.find(p => p.id === selected_page_id)
            : pages[0]

        if (!selectedPage) {
            return NextResponse.json(
                { error: "Página no encontrada" },
                { status: 400 }
            )
        }

        const pageAccessToken = selectedPage.access_token

        if (platform === "instagram") {
            // Para Instagram, necesitamos la cuenta de IG Business vinculada a la página
            const igAccount = selectedPage.instagram_business_account

            if (!igAccount) {
                return NextResponse.json(
                    { error: "Esta página no tiene una cuenta de Instagram Business vinculada. Ve a la configuración de tu página de Facebook y vincula tu cuenta de Instagram." },
                    { status: 400 }
                )
            }

            // Guardar canal de Instagram
            await upsertSocialChannel(serviceClient, {
                organization_id: orgId,
                platform: "instagram",
                platform_page_id: igAccount.id,
                page_access_token: pageAccessToken,
                platform_username: igAccount.username ? `@${igAccount.username}` : null,
                status: "connected",
                metadata: {
                    facebook_page_id: selectedPage.id,
                    facebook_page_name: selectedPage.name,
                    ig_profile_picture: igAccount.profile_picture_url,
                },
            })

            console.log(`[Social Channels Callback] Instagram connected for org ${orgId}: @${igAccount.username}`)

            return NextResponse.json({
                success: true,
                platform: "instagram",
                username: igAccount.username ? `@${igAccount.username}` : null,
                page_name: selectedPage.name,
            })
        } else {
            // Messenger — guardar la página directamente
            await upsertSocialChannel(serviceClient, {
                organization_id: orgId,
                platform: "messenger",
                platform_page_id: selectedPage.id,
                page_access_token: pageAccessToken,
                platform_username: selectedPage.name,
                status: "connected",
                metadata: {
                    facebook_page_name: selectedPage.name,
                },
            })

            // Suscribir la página al webhook para recibir mensajes
            await subscribePageWebhook(selectedPage.id, pageAccessToken)

            console.log(`[Social Channels Callback] Messenger connected for org ${orgId}: ${selectedPage.name}`)

            return NextResponse.json({
                success: true,
                platform: "messenger",
                page_name: selectedPage.name,
            })
        }
    } catch (error) {
        console.error("[Social Channels Callback] Error:", error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Error interno" },
            { status: 500 }
        )
    }
}

// ============================================
// Helpers
// ============================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsertSocialChannel(supabase: any, data: Record<string, unknown>) {
    const { data: existing } = await supabase
        .from("social_channels")
        .select("id")
        .eq("organization_id", data.organization_id)
        .eq("platform", data.platform)
        .single()

    if (existing) {
        const { error } = await supabase
            .from("social_channels")
            .update({
                ...data,
                updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id)

        if (error) throw error
    } else {
        const { error } = await supabase
            .from("social_channels")
            .insert(data)

        if (error) throw error
    }
}

/**
 * Suscribe una página de Facebook al webhook para recibir mensajes de Messenger.
 * Ref: https://developers.facebook.com/docs/messenger-platform/webhooks#subscribe
 */
async function subscribePageWebhook(pageId: string, pageAccessToken: string) {
    try {
        const res = await fetch(
            `${META_GRAPH_API}/${pageId}/subscribed_apps`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    subscribed_fields: ["messages", "messaging_postbacks", "messaging_optins"],
                    access_token: pageAccessToken,
                }),
            }
        )

        const data = await res.json()
        if (!data.success) {
            console.warn("[Social Channels Callback] Webhook subscription failed:", data)
        } else {
            console.log(`[Social Channels Callback] Page ${pageId} subscribed to webhook`)
        }
    } catch (error) {
        console.error("[Social Channels Callback] Webhook subscription error:", error)
    }
}
