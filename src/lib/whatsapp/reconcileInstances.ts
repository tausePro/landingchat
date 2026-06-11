/**
 * Reconciliación whatsapp_instances ↔ server Evolution (T0, Platform
 * Notifier v0).
 *
 * Contexto (2026-06-11): el server Evolution de la plataforma tenía 6
 * instancias reales mientras la tabla en Supabase estaba VACÍA — el sync
 * existente (`syncEvolutionStatus`) solo actualiza filas, nunca crea.
 * Consecuencia: notificaciones de venta y elegibilidad del copilot
 * muertas, dashboard de canales mintiendo.
 *
 * Esta reconciliación es idempotente y conservadora: instancias sin org
 * resoluble se reportan en `unmatched` sin tocar DB.
 *
 * `createServiceClient` justificado: operación cross-org disparada solo
 * por super admin (gate en el server action que la invoca).
 *
 * Spec: .kiro/specs/platform-notifier-v0/design.md §1
 */

import { createServiceClient } from "@/lib/supabase/server"
import { createEvolutionClient } from "@/lib/evolution"
import { logger } from "@/lib/logger"

const log = logger("whatsapp/reconcile")

/** Instancia reservada del canal de notificaciones de la plataforma (T1). */
export const PLATFORM_INSTANCE_NAME = "platform_notifications"

export interface ReconcileResult {
    created: number
    updated: number
    unchanged: number
    unmatched: string[]
    errors: string[]
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function mapStatus(evolutionStatus: string): "connected" | "connecting" | "disconnected" {
    if (evolutionStatus === "open") return "connected"
    if (evolutionStatus === "connecting") return "connecting"
    return "disconnected"
}

export async function reconcileEvolutionInstances(): Promise<ReconcileResult> {
    const result: ReconcileResult = { created: 0, updated: 0, unchanged: 0, unmatched: [], errors: [] }

    const supabase = createServiceClient()
    const evolution = await createEvolutionClient(supabase)
    if (!evolution) {
        result.errors.push("Evolution API no configurada en system_settings")
        return result
    }

    let serverInstances: Array<{ name: string; status: string; number: string | null }>
    try {
        serverInstances = await evolution.listInstances()
    } catch (error) {
        result.errors.push(`No se pudo listar instancias del server: ${error instanceof Error ? error.message : "unknown"}`)
        return result
    }

    const { data: orgs } = await supabase.from("organizations").select("id, slug")
    const orgsBySlug = new Map((orgs ?? []).map((org) => [org.slug.trim().toLowerCase(), org.id]))
    const orgIds = new Set((orgs ?? []).map((org) => org.id))

    const { data: existingRows } = await supabase
        .from("whatsapp_instances")
        .select("id, organization_id, instance_name, instance_type, status, phone_number")

    const rowsByInstanceName = new Map((existingRows ?? []).map((row) => [row.instance_name, row]))
    const corporateOrgIds = new Set(
        (existingRows ?? []).filter((row) => row.instance_type === "corporate").map((row) => row.organization_id)
    )

    // org_<uuid> primero (convención canónica), luego nombres libres por slug
    const sorted = [...serverInstances].sort((a, b) =>
        Number(b.name.startsWith("org_")) - Number(a.name.startsWith("org_"))
    )

    for (const instance of sorted) {
        if (instance.name === PLATFORM_INSTANCE_NAME) continue

        // Resolver organización
        let organizationId: string | null = null
        if (instance.name.startsWith("org_")) {
            const candidate = instance.name.slice(4)
            if (UUID_REGEX.test(candidate) && orgIds.has(candidate)) {
                organizationId = candidate
            }
        } else {
            organizationId = orgsBySlug.get(instance.name.trim().toLowerCase()) ?? null
        }

        if (!organizationId) {
            result.unmatched.push(instance.name)
            continue
        }

        const status = mapStatus(instance.status)
        const now = new Date().toISOString()
        const existing = rowsByInstanceName.get(instance.name)

        if (existing) {
            const phoneChanged = instance.number !== null && instance.number !== existing.phone_number
            if (existing.status === status && !phoneChanged) {
                result.unchanged++
                continue
            }
            const updateData: Record<string, string | null> = {
                status,
                provider: "evolution",
                updated_at: now,
            }
            if (instance.number) {
                updateData.phone_number = instance.number
                updateData.phone_number_display = `****${instance.number.slice(-4)}`
            }
            if (status === "connected" && existing.status !== "connected") updateData.connected_at = now
            if (status === "disconnected" && existing.status !== "disconnected") updateData.disconnected_at = now

            const { error } = await supabase.from("whatsapp_instances").update(updateData).eq("id", existing.id)
            if (error) {
                result.errors.push(`${instance.name}: update failed (${error.message})`)
            } else {
                result.updated++
            }
            continue
        }

        // UNIQUE(organization_id, instance_type): si la org ya tiene corporate
        // con OTRO instance_name, no creamos duplicado — se reporta conflicto
        if (corporateOrgIds.has(organizationId)) {
            result.errors.push(`${instance.name}: la org ya tiene otra instancia corporate (conflicto, no se creó)`)
            continue
        }

        const { error } = await supabase.from("whatsapp_instances").insert({
            organization_id: organizationId,
            instance_name: instance.name,
            instance_type: "corporate",
            provider: "evolution",
            status,
            phone_number: instance.number,
            phone_number_display: instance.number ? `****${instance.number.slice(-4)}` : null,
            connected_at: status === "connected" ? now : null,
        })
        if (error) {
            result.errors.push(`${instance.name}: insert failed (${error.message})`)
        } else {
            result.created++
            corporateOrgIds.add(organizationId)
        }
    }

    log.info("reconciliation done", {
        created: result.created,
        updated: result.updated,
        unchanged: result.unchanged,
        unmatched: result.unmatched.length,
        errors: result.errors.length,
    })
    return result
}
