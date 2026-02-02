/**
 * OAuth Callback para Meta WhatsApp Embedded Signup
 *
 * Recibe el authorization code del frontend (después del Embedded Signup)
 * y lo intercambia por un access token vía Graph API.
 * Luego guarda las credenciales en la instancia de WhatsApp de la organización.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { MetaCloudClient, getMetaWhatsAppConfig } from "@/lib/whatsapp"
import { z } from "zod"

const CallbackSchema = z.object({
    code: z.string().min(1),
    phone_number_id: z.string().min(1),
    waba_id: z.string().min(1),
})

export async function POST(request: NextRequest) {
    try {
        // Verificar autenticación del usuario
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 })
        }

        // Obtener organización del usuario
        const { data: profile } = await supabase
            .from("profiles")
            .select("organization_id")
            .eq("id", user.id)
            .single()

        if (!profile?.organization_id) {
            return NextResponse.json({ error: "Sin organizaci\u00f3n" }, { status: 400 })
        }

        const orgId = profile.organization_id

        // Parsear y validar body
        const body = await request.json()
        const validation = CallbackSchema.safeParse(body)

        if (!validation.success) {
            return NextResponse.json(
                { error: "Datos inv\u00e1lidos", details: validation.error.issues },
                { status: 400 }
            )
        }

        const { code, phone_number_id, waba_id } = validation.data

        // Obtener configuración global de Meta WhatsApp
        const config = await getMetaWhatsAppConfig()
        if (!config) {
            return NextResponse.json(
                { error: "Meta WhatsApp no est\u00e1 configurado. Contacta al administrador." },
                { status: 500 }
            )
        }

        // Intercambiar code por access token
        const client = new MetaCloudClient()
        const tokenResponse = await client.exchangeCodeForToken(
            code,
            config.app_id,
            config.app_secret
        )

        if (!tokenResponse.access_token) {
            return NextResponse.json(
                { error: "No se pudo obtener el access token de Meta" },
                { status: 500 }
            )
        }

        // Verificar que el token funciona obteniendo info del número
        const isValid = await client.testConnection(phone_number_id, tokenResponse.access_token)
        if (!isValid) {
            return NextResponse.json(
                { error: "El token obtenido no es v\u00e1lido para el n\u00famero configurado" },
                { status: 500 }
            )
        }

        // Obtener número de teléfono para display
        let phoneNumber = ""
        let phoneNumberDisplay = ""
        try {
            const phoneNumbers = await client.getPhoneNumbers(waba_id, tokenResponse.access_token)
            const matchingPhone = phoneNumbers.find(p => p.id === phone_number_id)
            if (matchingPhone) {
                phoneNumber = matchingPhone.display_phone_number.replace(/\D/g, "")
                phoneNumberDisplay = phoneNumber.slice(-4)
            }
        } catch (phoneError) {
            console.error("[Meta Callback] Error getting phone number:", phoneError)
        }

        // Guardar instancia en DB (usar serviceClient para bypass RLS)
        const serviceClient = createServiceClient()

        // Verificar si ya existe una instancia corporativa
        const { data: existing } = await serviceClient
            .from("whatsapp_instances")
            .select("id")
            .eq("organization_id", orgId)
            .eq("instance_type", "corporate")
            .single()

        const instanceData = {
            organization_id: orgId,
            instance_name: `meta_${orgId}`,
            instance_type: "corporate" as const,
            provider: "meta" as const,
            status: "connected" as const,
            phone_number: phoneNumber || null,
            phone_number_display: phoneNumberDisplay || null,
            meta_phone_number_id: phone_number_id,
            meta_waba_id: waba_id,
            meta_access_token: tokenResponse.access_token,
            connected_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }

        if (existing) {
            const { error: updateError } = await serviceClient
                .from("whatsapp_instances")
                .update(instanceData)
                .eq("id", existing.id)

            if (updateError) {
                console.error("[Meta Callback] Error updating instance:", updateError)
                return NextResponse.json({ error: updateError.message }, { status: 500 })
            }
        } else {
            const { error: insertError } = await serviceClient
                .from("whatsapp_instances")
                .insert(instanceData)

            if (insertError) {
                console.error("[Meta Callback] Error creating instance:", insertError)
                return NextResponse.json({ error: insertError.message }, { status: 500 })
            }
        }

        console.log(`[Meta Callback] WhatsApp Meta connected for org ${orgId}, phone: ${phoneNumber}`)

        return NextResponse.json({
            success: true,
            phone_number: phoneNumber,
            phone_number_display: phoneNumberDisplay,
        })
    } catch (error) {
        console.error("[Meta Callback] Error:", error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Error interno" },
            { status: 500 }
        )
    }
}
