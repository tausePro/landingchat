"use server"

import { createServiceClient } from "@/lib/supabase/server"
import { type ActionResult, success, failure } from "@/types"
import { type LandingMainConfig, defaultLandingConfig } from "@/types/landing"
import { revalidatePath } from "next/cache"

const LANDING_CONFIG_KEY = "landing_main_config"

/**
 * Lee la configuración de landing desde system_settings
 */
export async function getLandingMainConfig(): Promise<ActionResult<LandingMainConfig>> {
    try {
        const supabase = createServiceClient()

        const { data: settings } = await supabase
            .from("system_settings")
            .select("value")
            .eq("key", LANDING_CONFIG_KEY)
            .single()

        if (!settings?.value) {
            return success(defaultLandingConfig)
        }

        const dbConfig = settings.value as Partial<LandingMainConfig>
        const merged: LandingMainConfig = { ...defaultLandingConfig, ...dbConfig }

        return success(merged)
    } catch {
        return success(defaultLandingConfig)
    }
}

/**
 * Guarda la configuración de landing en system_settings
 * Solo guarda los campos que difieren de los defaults
 */
export async function saveLandingMainConfig(
    config: LandingMainConfig
): Promise<ActionResult<boolean>> {
    try {
        const supabase = createServiceClient()

        const { error } = await supabase
            .from("system_settings")
            .upsert(
                {
                    key: LANDING_CONFIG_KEY,
                    value: config,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: "key" }
            )

        if (error) {
            return failure(error.message)
        }

        // Revalidar la landing page y las rutas que la consumen
        revalidatePath("/")
        revalidatePath("/admin/settings/landing")

        return success(true)
    } catch (error) {
        return failure(
            error instanceof Error ? error.message : "Error al guardar configuración"
        )
    }
}
