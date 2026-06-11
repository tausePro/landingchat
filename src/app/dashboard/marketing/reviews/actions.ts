"use server"

import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { type ActionResult, success, failure } from "@/types"
import {
    resolveReviewRequestConfig,
    type ReviewRequestConfig,
} from "@/lib/reviews/request-config"
import type { OrganizationSettingsOverrides } from "@/types"

const updateSchema = z.object({
    enabled: z.boolean(),
    delayDays: z.number().int().min(1).max(60),
})

async function getOrganizationForUser() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { supabase, organization: null }

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) return { supabase, organization: null }

    const { data: organization } = await supabase
        .from("organizations")
        .select("id, settings")
        .eq("id", profile.organization_id)
        .single()

    return { supabase, organization }
}

export async function getReviewRequestSettings(): Promise<ActionResult<ReviewRequestConfig>> {
    try {
        const { organization } = await getOrganizationForUser()
        if (!organization) return failure("Organización no encontrada")

        return success(resolveReviewRequestConfig(organization.settings))
    } catch (error) {
        console.error("[reviews/settings] Error fetching settings:", error)
        return failure("Error al cargar la configuración")
    }
}

/**
 * Guarda la config de solicitud de reseñas en organizations.settings.reviews
 * preservando el resto del JSONB (read-modify-write). RLS limita el UPDATE
 * a la organización del usuario.
 */
export async function updateReviewRequestSettings(
    input: z.infer<typeof updateSchema>
): Promise<ActionResult<void>> {
    try {
        const validation = updateSchema.safeParse(input)
        if (!validation.success) {
            return failure(validation.error.issues[0]?.message || "Datos inválidos")
        }

        const { supabase, organization } = await getOrganizationForUser()
        if (!organization) return failure("Organización no encontrada")

        const currentSettings = (organization.settings as OrganizationSettingsOverrides | null) ?? {}
        const nextSettings: OrganizationSettingsOverrides = {
            ...currentSettings,
            reviews: {
                ...(currentSettings.reviews ?? {}),
                request_enabled: validation.data.enabled,
                request_delay_days: validation.data.delayDays,
            },
        }

        const { error } = await supabase
            .from("organizations")
            .update({ settings: nextSettings })
            .eq("id", organization.id)

        if (error) {
            console.error("[reviews/settings] Error updating settings:", error)
            return failure("Error al guardar la configuración")
        }

        revalidatePath("/dashboard/marketing/reviews")
        return success(undefined)
    } catch (error) {
        console.error("[reviews/settings] Unexpected error:", error)
        return failure("Error inesperado al guardar la configuración")
    }
}
