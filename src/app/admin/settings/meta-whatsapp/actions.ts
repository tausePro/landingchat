"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { MetaCloudClient } from "@/lib/whatsapp"
import { type ActionResult, success, failure } from "@/types"
import { z } from "zod"

// Schema de validación para la configuración
const MetaWhatsAppConfigSchema = z.object({
    app_id: z.string().min(1, "App ID es requerido"),
    app_secret: z.string().min(1, "App Secret es requerido"),
    verify_token: z.string().min(1, "Verify Token es requerido"),
    config_id: z.string().optional(),
    solution_id: z.string().optional(),
})

/**
 * Verifica que el usuario sea superadmin
 */
async function checkSuperAdmin() {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) return false

    const { data: profile } = await supabase
        .from("profiles")
        .select("is_superadmin")
        .eq("id", user.id)
        .single()

    return profile?.is_superadmin === true
}

/**
 * Obtiene la configuración de Meta WhatsApp Cloud API
 */
export async function getMetaWhatsAppConfig(): Promise<
    ActionResult<{
        app_id: string
        app_secret: string
        verify_token: string
        config_id?: string
        solution_id?: string
        webhook_url: string
    } | null>
> {
    try {
        const isSuperAdmin = await checkSuperAdmin()
        if (!isSuperAdmin) {
            return failure("No autorizado")
        }

        const supabase = await createClient()
        const { data, error } = await supabase
            .from("system_settings")
            .select("value")
            .eq("key", "meta_whatsapp_config")
            .single()

        if (error && error.code !== "PGRST116") {
            return failure(error.message)
        }

        if (!data) {
            return success(null)
        }

        const config = data.value as Record<string, string>
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.landingchat.co"

        // Enmascarar el app_secret
        return success({
            app_id: config.app_id || "",
            app_secret: config.app_secret ? `****${config.app_secret.slice(-4)}` : "",
            verify_token: config.verify_token || "",
            config_id: config.config_id,
            solution_id: config.solution_id,
            webhook_url: `${appUrl}/api/webhooks/whatsapp-meta`,
        })
    } catch (error) {
        return failure(
            error instanceof Error ? error.message : "Error al obtener configuración"
        )
    }
}

/**
 * Guarda la configuración de Meta WhatsApp Cloud API
 */
export async function saveMetaWhatsAppConfig(input: unknown): Promise<ActionResult<void>> {
    try {
        const isSuperAdmin = await checkSuperAdmin()
        if (!isSuperAdmin) {
            return failure("No autorizado")
        }

        const validation = MetaWhatsAppConfigSchema.safeParse(input)
        if (!validation.success) {
            return failure(validation.error.issues[0].message)
        }

        const data = validation.data
        const supabase = await createClient()

        // Si el app_secret empieza con ****, no actualizarlo (mantener el existente)
        let appSecret = data.app_secret
        if (appSecret.startsWith("****")) {
            const { data: existing } = await supabase
                .from("system_settings")
                .select("value")
                .eq("key", "meta_whatsapp_config")
                .single()

            if (existing?.value) {
                appSecret = (existing.value as Record<string, string>).app_secret || ""
            }
        }

        const { error } = await supabase.from("system_settings").upsert(
            {
                key: "meta_whatsapp_config",
                value: {
                    app_id: data.app_id,
                    app_secret: appSecret,
                    verify_token: data.verify_token,
                    config_id: data.config_id || "",
                    solution_id: data.solution_id || "",
                },
                updated_at: new Date().toISOString(),
            },
            { onConflict: "key" }
        )

        if (error) {
            return failure(error.message)
        }

        revalidatePath("/admin/settings/meta-whatsapp")
        return success(undefined)
    } catch (error) {
        return failure(
            error instanceof Error ? error.message : "Error al guardar configuración"
        )
    }
}

/**
 * Prueba la conexión con Meta Graph API usando un test phone number ID
 */
export async function testMetaConnection(
    phoneNumberId?: string,
    accessToken?: string
): Promise<ActionResult<{ success: boolean; message: string }>> {
    try {
        const isSuperAdmin = await checkSuperAdmin()
        if (!isSuperAdmin) {
            return failure("No autorizado")
        }

        if (!phoneNumberId || !accessToken) {
            return success({
                success: false,
                message: "Se necesita un Phone Number ID y Access Token para probar. Conecta un número primero.",
            })
        }

        const client = new MetaCloudClient()
        const isConnected = await client.testConnection(phoneNumberId, accessToken)

        if (isConnected) {
            return success({
                success: true,
                message: "Conexión exitosa con Meta WhatsApp Cloud API",
            })
        } else {
            return success({
                success: false,
                message: "No se pudo conectar. Verifica las credenciales.",
            })
        }
    } catch (error) {
        return failure(
            error instanceof Error ? error.message : "Error al probar conexión"
        )
    }
}
