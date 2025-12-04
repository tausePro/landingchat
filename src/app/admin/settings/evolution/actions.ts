"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { EvolutionClient } from "@/lib/evolution"
import { type ActionResult, success, failure, EvolutionConfigSchema } from "@/types"

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
 * Obtiene la configuración de Evolution API
 */
export async function getEvolutionConfig(): Promise<
    ActionResult<{ url: string; apiKey: string } | null>
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
            .eq("key", "evolution_api_config")
            .single()

        if (error && error.code !== "PGRST116") {
            return failure(error.message)
        }

        if (!data) {
            return success(null)
        }

        const config = data.value as { url: string; apiKey: string }
        // No devolver la API Key completa, solo los últimos 4 caracteres
        return success({
            url: config.url,
            apiKey: config.apiKey ? `****${config.apiKey.slice(-4)}` : "",
        })
    } catch (error) {
        return failure(
            error instanceof Error ? error.message : "Error al obtener configuración"
        )
    }
}

/**
 * Guarda la configuración de Evolution API
 */
export async function saveEvolutionConfig(input: unknown): Promise<ActionResult<void>> {
    try {
        const isSuperAdmin = await checkSuperAdmin()
        if (!isSuperAdmin) {
            return failure("No autorizado")
        }

        // Validar input
        const validation = EvolutionConfigSchema.safeParse(input)
        if (!validation.success) {
            return failure(validation.error.issues[0].message)
        }

        const data = validation.data
        const supabase = await createClient()

        // Guardar configuración
        const { error } = await supabase.from("system_settings").upsert(
            {
                key: "evolution_api_config",
                value: {
                    url: data.url,
                    apiKey: data.apiKey,
                    webhookSecret: data.webhookSecret,
                },
                updated_at: new Date().toISOString(),
            },
            { onConflict: "key" }
        )

        if (error) {
            return failure(error.message)
        }

        revalidatePath("/admin/settings/evolution")
        return success(undefined)
    } catch (error) {
        return failure(
            error instanceof Error ? error.message : "Error al guardar configuración"
        )
    }
}

/**
 * Prueba la conexión con Evolution API
 */
export async function testEvolutionConnection(): Promise<
    ActionResult<{ success: boolean; message: string }>
> {
    try {
        const isSuperAdmin = await checkSuperAdmin()
        if (!isSuperAdmin) {
            return failure("No autorizado")
        }

        const supabase = await createClient()
        const { data: settings, error } = await supabase
            .from("system_settings")
            .select("value")
            .eq("key", "evolution_api_config")
            .single()

        if (error || !settings?.value) {
            return failure("No hay configuración de Evolution API")
        }

        const config = settings.value as { url: string; apiKey: string }
        const client = new EvolutionClient({
            baseUrl: config.url,
            apiKey: config.apiKey,
        })

        const isConnected = await client.testConnection()

        if (isConnected) {
            return success({
                success: true,
                message: "Conexión exitosa con Evolution API",
            })
        } else {
            return success({
                success: false,
                message: "No se pudo conectar. Verifica la URL y API Key.",
            })
        }
    } catch (error) {
        return failure(
            error instanceof Error ? error.message : "Error al probar conexión"
        )
    }
}
