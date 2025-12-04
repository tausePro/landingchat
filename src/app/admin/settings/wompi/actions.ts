"use server"

import { createServiceClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { type ActionResult, success, failure } from "@/types"
import { WompiClient } from "@/lib/wompi/client"
import { WompiConfigSchema, type WompiConfig } from "@/lib/wompi/types"

const WOMPI_CONFIG_KEY = "wompi_config"

/**
 * Obtiene la configuración de Wompi
 */
export async function getWompiConfig(): Promise<ActionResult<WompiConfig | null>> {
    try {
        const supabase = await createServiceClient()

        const { data, error } = await supabase
            .from("system_settings")
            .select("value")
            .eq("key", WOMPI_CONFIG_KEY)
            .single()

        if (error) {
            if (error.code === "PGRST116") {
                // No existe configuración
                return success(null)
            }
            console.error("Error fetching Wompi config:", error)
            return failure("Error al obtener la configuración")
        }

        // Validar y parsear
        const config = WompiConfigSchema.safeParse(data.value)
        if (!config.success) {
            return success(null)
        }

        // Ocultar llaves sensibles para el frontend
        return success({
            ...config.data,
            privateKey: config.data.privateKey ? "••••••••" : "",
            integritySecret: config.data.integritySecret ? "••••••••" : "",
        })
    } catch (error) {
        console.error("Error in getWompiConfig:", error)
        return failure("Error inesperado al obtener la configuración")
    }
}

/**
 * Guarda la configuración de Wompi
 */
export async function saveWompiConfig(config: WompiConfig): Promise<ActionResult<void>> {
    try {
        // Validar con Zod
        const validation = WompiConfigSchema.safeParse(config)
        if (!validation.success) {
            const errorMessage = validation.error.issues[0]?.message || "Datos inválidos"
            return failure(errorMessage)
        }

        const supabase = await createServiceClient()

        // Obtener configuración existente para preservar llaves si no se actualizan
        const { data: existing } = await supabase
            .from("system_settings")
            .select("value")
            .eq("key", WOMPI_CONFIG_KEY)
            .single()

        const existingConfig = existing?.value as WompiConfig | undefined

        // Si las llaves vienen ocultas, mantener las existentes
        const finalConfig = {
            ...validation.data,
            privateKey: validation.data.privateKey === "••••••••"
                ? existingConfig?.privateKey || ""
                : validation.data.privateKey,
            integritySecret: validation.data.integritySecret === "••••••••"
                ? existingConfig?.integritySecret || ""
                : validation.data.integritySecret,
        }

        // Upsert configuración
        const { error } = await supabase
            .from("system_settings")
            .upsert({
                key: WOMPI_CONFIG_KEY,
                value: finalConfig,
                updated_at: new Date().toISOString(),
            }, {
                onConflict: "key",
            })

        if (error) {
            console.error("Error saving Wompi config:", error)
            return failure("Error al guardar la configuración")
        }

        revalidatePath("/admin/settings/wompi")
        return success(undefined)
    } catch (error) {
        console.error("Error in saveWompiConfig:", error)
        return failure("Error inesperado al guardar la configuración")
    }
}

/**
 * Prueba la conexión con Wompi
 */
export async function testWompiConnection(): Promise<ActionResult<boolean>> {
    try {
        const supabase = await createServiceClient()

        const { data, error } = await supabase
            .from("system_settings")
            .select("value")
            .eq("key", WOMPI_CONFIG_KEY)
            .single()

        if (error || !data) {
            return failure("No hay configuración de Wompi guardada")
        }

        const config = data.value as WompiConfig

        const client = new WompiClient(config)
        const isConnected = await client.testConnection()

        if (isConnected) {
            return success(true)
        } else {
            return failure("No se pudo conectar con Wompi. Verifica las credenciales.")
        }
    } catch (error) {
        console.error("Error testing Wompi connection:", error)
        return failure("Error al probar la conexión")
    }
}
