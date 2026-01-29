"use server"

import { createServiceClient } from "@/lib/supabase/server"
import { type ActionResult, success, failure } from "@/types"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LandingConfig = Record<string, any>

/**
 * Obtiene la configuración de la landing del programa founding activo
 */
export async function getLandingConfig(): Promise<ActionResult<LandingConfig | null>> {
    try {
        const supabase = createServiceClient()

        const { data: program, error } = await supabase
            .from("founding_program")
            .select("id, landing_config")
            .eq("is_active", true)
            .limit(1)
            .single()

        if (error) {
            console.error("[getLandingConfig] Error:", error)
            return failure("No se encontró programa founding activo")
        }

        return success(program.landing_config || {})
    } catch (error) {
        console.error("[getLandingConfig] Error:", error)
        return failure("Error al obtener configuración")
    }
}

/**
 * Actualiza la configuración de la landing del programa founding activo
 */
export async function updateLandingConfig(
    config: LandingConfig
): Promise<ActionResult<void>> {
    try {
        const supabase = createServiceClient()

        // Obtener programa activo
        const { data: program } = await supabase
            .from("founding_program")
            .select("id")
            .eq("is_active", true)
            .limit(1)
            .single()

        if (!program) {
            return failure("No se encontró programa founding activo")
        }

        // Actualizar configuración
        const { error } = await supabase
            .from("founding_program")
            .update({
                landing_config: config,
                updated_at: new Date().toISOString(),
            })
            .eq("id", program.id)

        if (error) {
            console.error("[updateLandingConfig] Error:", error)
            return failure("Error al guardar configuración")
        }

        return success(undefined)
    } catch (error) {
        console.error("[updateLandingConfig] Error:", error)
        return failure("Error inesperado")
    }
}
