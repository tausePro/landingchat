"use server"

import { createServiceClient } from "@/lib/supabase/server"
import { type ActionResult, success, failure, type Plan, deserializePlanFromDb } from "@/types"
import { type LandingMainConfig, defaultLandingConfig } from "@/types/landing"

const LANDING_CONFIG_KEY = "landing_main_config"

/**
 * Obtiene la configuración de la landing page principal
 * Merge con defaults para que siempre tenga todos los campos
 */
export async function getLandingConfig(): Promise<ActionResult<LandingMainConfig>> {
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

        // Merge: defaults + lo que haya en DB
        const dbConfig = settings.value as Partial<LandingMainConfig>
        const merged: LandingMainConfig = { ...defaultLandingConfig, ...dbConfig }

        return success(merged)
    } catch {
        // Si no existe el registro, devolver defaults
        return success(defaultLandingConfig)
    }
}

/**
 * Obtiene planes públicos activos para mostrar en el pricing de la landing
 */
export async function getPublicPlans(): Promise<ActionResult<Plan[]>> {
    try {
        const supabase = createServiceClient()

        const { data, error } = await supabase
            .from("plans")
            .select("*")
            .eq("is_active", true)
            .order("price", { ascending: true })

        if (error) {
            return failure(error.message)
        }

        const plans = (data || []).map((row) =>
            deserializePlanFromDb(row as Record<string, unknown>)
        )

        return success(plans)
    } catch (error) {
        return failure(
            error instanceof Error ? error.message : "Error al obtener planes"
        )
    }
}
