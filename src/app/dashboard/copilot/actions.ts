"use server"

import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { type ActionResult, success, failure } from "@/types"
import { executeProposedAction } from "@/lib/copilot/actionExecutor"
import { emitPlatformEvent } from "@/lib/events/emit"
import { PLATFORM_EVENT_TYPES } from "@/lib/events/platform-event-types"
import { COPILOT_AUTONOMY_LEVELS, type CopilotInsightRow, type CopilotProposedAction } from "@/lib/copilot/types"
import { ATLAS_SKILLS, type AtlasSkillId, type AtlasSkillsConfig } from "@/lib/copilot/atlas-skills"

const decideSchema = z.object({
    insightId: z.string().uuid(),
    decision: z.enum(["approve", "dismiss"]),
    note: z.string().trim().max(500).optional(),
    actionIndices: z.array(z.number().int().min(0).max(4)).max(5).optional(),
})

export type DecideCopilotInsightInput = z.infer<typeof decideSchema>

/**
 * Decide un insight del feed (aprobar y ejecutar acciones / rechazar).
 *
 * Seguridad: el insight se lee con el cliente AUTENTICADO — RLS garantiza
 * que pertenece al org del usuario. El executor recibe el organization_id
 * del row leído bajo RLS, nunca del input.
 */
export async function decideCopilotInsight(
    input: DecideCopilotInsightInput
): Promise<ActionResult<{ executed: number; failed: number }>> {
    try {
        const validation = decideSchema.safeParse(input)
        if (!validation.success) {
            return failure(validation.error.issues[0]?.message || "Datos inválidos")
        }
        const { insightId, decision, note, actionIndices } = validation.data

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return failure("No autorizado")

        // RLS: si el insight es de otro org, este SELECT retorna vacío
        const { data: insight } = await supabase
            .from("copilot_insights")
            .select("id, organization_id, status, proposed_actions")
            .eq("id", insightId)
            .maybeSingle()

        if (!insight) return failure("not_found")

        // Idempotencia: decisiones son terminales en v0
        if (insight.status !== "proposed") {
            return failure(`insight_already_${insight.status}`)
        }

        const now = new Date().toISOString()

        if (decision === "dismiss") {
            const { error } = await supabase
                .from("copilot_insights")
                .update({ status: "dismissed", decided_at: now, decided_by: user.id, decision_note: note ?? null })
                .eq("id", insightId)

            if (error) return failure("No se pudo guardar la decisión")

            await emitPlatformEvent({
                organizationId: insight.organization_id,
                eventType: PLATFORM_EVENT_TYPES.COPILOT_INSIGHT_DISMISSED,
                source: "copilot",
                payload: { insight_id: insightId },
                actorId: user.id,
            })

            revalidatePath("/dashboard/copilot")
            return success({ executed: 0, failed: 0 })
        }

        // decision === "approve": ejecutar las acciones seleccionadas
        const allActions = (insight.proposed_actions as CopilotProposedAction[]) ?? []
        const selected = actionIndices && actionIndices.length > 0
            ? actionIndices.filter((index) => index < allActions.length).map((index) => allActions[index])
            : allActions

        await emitPlatformEvent({
            organizationId: insight.organization_id,
            eventType: PLATFORM_EVENT_TYPES.COPILOT_INSIGHT_APPROVED,
            source: "copilot",
            payload: { insight_id: insightId, actions_selected: selected.length },
            actorId: user.id,
        })

        let executed = 0
        let failed = 0
        const failures: string[] = []
        for (const action of selected) {
            const result = await executeProposedAction({
                insightId,
                action,
                decidedBy: user.id,
                organizationId: insight.organization_id,
            })
            if (result.ok) {
                executed++
            } else {
                failed++
                failures.push(`${action.kind}: ${result.error}`)
            }
        }

        const finalStatus = failed > 0 && executed === 0 ? "dismissed" : "executed"
        const decisionNote = failed > 0
            ? `execution_failed: ${failures.join("; ")}`.slice(0, 500)
            : note ?? null

        const { error: updateError } = await supabase
            .from("copilot_insights")
            .update({
                status: finalStatus,
                decided_at: now,
                decided_by: user.id,
                decision_note: decisionNote,
                executed_at: executed > 0 ? now : null,
            })
            .eq("id", insightId)

        if (updateError) return failure("Las acciones corrieron pero no se pudo actualizar el estado")

        revalidatePath("/dashboard/copilot")
        return success({ executed, failed })
    } catch (error) {
        console.error("[copilot/decide] Unexpected error:", error)
        return failure("Error inesperado al decidir el insight")
    }
}

const settingsSchema = z.object({
    autonomyLevel: z.enum(COPILOT_AUTONOMY_LEVELS),
    notifyOnInsight: z.boolean(),
})

export type CopilotSettingsInput = z.infer<typeof settingsSchema>

export interface CopilotSettingsData {
    autonomyLevel: (typeof COPILOT_AUTONOMY_LEVELS)[number]
    notifyOnInsight: boolean
    hasPersonalInstance: boolean
    atlasSkills: AtlasSkillsConfig
}

/** Lee la config del copilot del org del usuario (RLS scoping). */
export async function getCopilotSettings(): Promise<ActionResult<CopilotSettingsData>> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return failure("No autorizado")

        const { data: profile } = await supabase
            .from("profiles")
            .select("organization_id")
            .eq("id", user.id)
            .single()
        if (!profile?.organization_id) return failure("Organización no encontrada")

        const [{ data: org }, { data: instance }] = await Promise.all([
            supabase
                .from("organizations")
                .select("copilot_autonomy_level, settings")
                .eq("id", profile.organization_id)
                .single(),
            supabase
                .from("whatsapp_instances")
                .select("notify_on_copilot_insight")
                .eq("organization_id", profile.organization_id)
                .eq("instance_type", "personal")
                .eq("status", "connected")
                .maybeSingle(),
        ])

        const level = COPILOT_AUTONOMY_LEVELS.includes(org?.copilot_autonomy_level)
            ? org!.copilot_autonomy_level
            : "level_1_propose"

        const atlasSkills = ((org?.settings as Record<string, unknown> | null)?.atlas_skills as AtlasSkillsConfig) ?? {}

        return success({
            autonomyLevel: level,
            notifyOnInsight: instance?.notify_on_copilot_insight !== false,
            hasPersonalInstance: Boolean(instance),
            atlasSkills,
        })
    } catch (error) {
        console.error("[copilot/settings] Error:", error)
        return failure("Error al cargar la configuración")
    }
}

/** Persiste autonomía + toggle de notificación (RLS limita al org propio). */
export async function updateCopilotSettings(input: CopilotSettingsInput): Promise<ActionResult<void>> {
    try {
        const validation = settingsSchema.safeParse(input)
        if (!validation.success) {
            return failure(validation.error.issues[0]?.message || "Datos inválidos")
        }

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return failure("No autorizado")

        const { data: profile } = await supabase
            .from("profiles")
            .select("organization_id")
            .eq("id", user.id)
            .single()
        if (!profile?.organization_id) return failure("Organización no encontrada")

        const { error: orgError } = await supabase
            .from("organizations")
            .update({ copilot_autonomy_level: validation.data.autonomyLevel })
            .eq("id", profile.organization_id)
        if (orgError) return failure("No se pudo guardar el nivel de autonomía")

        // Toggle de WhatsApp solo si hay instancia personal (no es error si no hay)
        await supabase
            .from("whatsapp_instances")
            .update({ notify_on_copilot_insight: validation.data.notifyOnInsight })
            .eq("organization_id", profile.organization_id)
            .eq("instance_type", "personal")

        revalidatePath("/dashboard/copilot/settings")
        revalidatePath("/dashboard/copilot")
        return success(undefined)
    } catch (error) {
        console.error("[copilot/settings] Error updating:", error)
        return failure("Error inesperado al guardar la configuración")
    }
}

const atlasSkillSchema = z.object({
    skillId: z.enum(["growth", "paid_social", "creative", "aeo"]),
    enabled: z.boolean(),
})

/**
 * Activa/desactiva un skill de Atlas para el org (persistido en
 * organizations.settings.atlas_skills, deep-merge sin pisar otras llaves).
 * Solo skills "active" son toggleables; los "coming_soon" se rechazan.
 */
export async function setAtlasSkillEnabled(input: { skillId: AtlasSkillId; enabled: boolean }): Promise<ActionResult<void>> {
    try {
        const validation = atlasSkillSchema.safeParse(input)
        if (!validation.success) return failure("Datos inválidos")
        const { skillId, enabled } = validation.data

        const def = ATLAS_SKILLS.find((s) => s.id === skillId)
        if (!def || def.status !== "active") return failure("Esa habilidad aún no está disponible")

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return failure("No autorizado")

        const { data: profile } = await supabase
            .from("profiles")
            .select("organization_id")
            .eq("id", user.id)
            .single()
        if (!profile?.organization_id) return failure("Organización no encontrada")

        const { data: org } = await supabase
            .from("organizations")
            .select("settings")
            .eq("id", profile.organization_id)
            .single()

        const currentSettings = (org?.settings as Record<string, unknown> | null) ?? {}
        const currentSkills = (currentSettings.atlas_skills as AtlasSkillsConfig | undefined) ?? {}
        const nextSettings = {
            ...currentSettings,
            atlas_skills: { ...currentSkills, [skillId]: { ...currentSkills[skillId], enabled } },
        }

        const { error } = await supabase
            .from("organizations")
            .update({ settings: nextSettings })
            .eq("id", profile.organization_id)
        if (error) return failure("No se pudo guardar la habilidad")

        revalidatePath("/dashboard/copilot/settings")
        revalidatePath("/dashboard/copilot")
        return success(undefined)
    } catch (error) {
        console.error("[copilot/atlas-skill] Error:", error)
        return failure("Error inesperado al guardar la habilidad")
    }
}

/** Feed del dashboard: pendientes + historial del org (RLS scoping). */
export async function getCopilotInsights(): Promise<ActionResult<{ pending: CopilotInsightRow[]; history: CopilotInsightRow[] }>> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return failure("No autorizado")

        const { data, error } = await supabase
            .from("copilot_insights")
            .select("*")
            .order("generated_at", { ascending: false })
            .limit(50)

        if (error) return failure("Error al cargar los insights")

        const insights = (data ?? []) as CopilotInsightRow[]
        return success({
            pending: insights.filter((insight) => insight.status === "proposed"),
            history: insights.filter((insight) => insight.status !== "proposed"),
        })
    } catch (error) {
        console.error("[copilot/feed] Error:", error)
        return failure("Error al cargar los insights")
    }
}
