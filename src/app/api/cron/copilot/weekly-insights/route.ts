import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { computeIsoWeek } from "@/lib/utils/iso-week"
import { loadWeeklyMetrics } from "@/lib/copilot/weeklyMetrics"
import { composeWeeklyInsight } from "@/lib/copilot/insightComposer"
import { emitPlatformEvent } from "@/lib/events/emit"
import { PLATFORM_EVENT_TYPES } from "@/lib/events/platform-event-types"
import { sendCopilotInsight } from "@/lib/notifications/whatsapp"
import { getTenantLocale } from "@/lib/i18n/tenant-locale"

export const dynamic = "force-dynamic"
// El batch llama al LLM por org: darle aire más allá del default
export const maxDuration = 300

const log = logger("copilot/weekly")

interface EligibleOrg {
    id: string
    slug: string
    locale: string | null
    currency_code: string | null
    country_code: string | null
    copilot_autonomy_level: string | null
}

/**
 * Cron semanal del copilot (lunes 14:00 UTC = 9am Colombia).
 *
 * Por cada org elegible (WhatsApp Personal conectado con notificaciones e
 * insights activos): métricas → composer (Haiku) → INSERT copilot_insights
 * (proposed) → platform_event → entrega por WhatsApp.
 *
 * Idempotente por (org, weekly, iso_week): re-correrlo el mismo lunes no
 * duplica insights ni notificaciones. Error en una org no aborta el batch.
 * `createServiceClient()` justificado: cron sin sesión; organization_id
 * siempre derivado del SELECT de orgs elegibles.
 */
export async function GET(request: Request) {
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createServiceClient()
    const isoWeek = computeIsoWeek(new Date())

    // Orgs candidatas en 2 pasos: el JOIN embebido (!inner) NO funciona en
    // prod — la FK whatsapp_instances→organizations no existe en el schema
    // cache de PostgREST (hallazgo T0 platform-notifier; habría devuelto
    // 500 en el primer cron real). Query directa + IN es robusta.
    const { data: instances, error: instancesError } = await supabase
        .from("whatsapp_instances")
        .select("organization_id")
        .eq("instance_type", "personal")
        .eq("status", "connected")
        .eq("notifications_enabled", true)
        .eq("notify_on_copilot_insight", true)

    if (instancesError) {
        log.error("failed to load eligible instances", { error: instancesError.message })
        return NextResponse.json({ error: "Failed to load instances" }, { status: 500 })
    }

    const eligibleOrgIds = [...new Set((instances ?? []).map((row) => row.organization_id))]
    if (eligibleOrgIds.length === 0) {
        return NextResponse.json({ message: "No eligible orgs", generated: 0, skipped: 0, errors: [] })
    }

    const { data: orgs, error: orgsError } = await supabase
        .from("organizations")
        .select("id, slug, locale, currency_code, country_code, copilot_autonomy_level")
        .in("id", eligibleOrgIds)

    if (orgsError) {
        log.error("failed to load eligible orgs", { error: orgsError.message })
        return NextResponse.json({ error: "Failed to load organizations" }, { status: 500 })
    }

    const eligibleOrgs = (orgs ?? []) as unknown as EligibleOrg[]
    if (eligibleOrgs.length === 0) {
        return NextResponse.json({ message: "No eligible orgs", generated: 0, skipped: 0, errors: [] })
    }

    const results = { generated: 0, skipped: 0, errors: [] as string[] }

    for (const org of eligibleOrgs) {
        try {
            // Idempotencia: un insight weekly por org por semana ISO
            const { data: existing } = await supabase
                .from("copilot_insights")
                .select("id")
                .eq("organization_id", org.id)
                .eq("scope", "weekly")
                .eq("iso_week", isoWeek)
                .maybeSingle()

            if (existing) {
                results.skipped++
                continue
            }

            const tenantLocale = getTenantLocale(org)
            const metrics = await loadWeeklyMetrics(org.id)
            const payload = await composeWeeklyInsight({
                organizationId: org.id,
                locale: tenantLocale.locale,
                metrics,
            })

            const { data: insight, error: insertError } = await supabase
                .from("copilot_insights")
                .insert({
                    organization_id: org.id,
                    scope: "weekly",
                    iso_week: isoWeek,
                    status: "proposed",
                    title: payload.title,
                    body: payload.body,
                    proposed_actions: payload.proposed_actions,
                    metrics_snapshot: payload.metrics_snapshot,
                })
                .select("id")
                .single()

            if (insertError) throw insertError

            await emitPlatformEvent({
                organizationId: org.id,
                eventType: PLATFORM_EVENT_TYPES.COPILOT_INSIGHT_PROPOSED,
                source: "copilot",
                payload: { insight_id: insight.id, scope: "weekly", iso_week: isoWeek },
                idempotencyKey: `copilot.weekly.${isoWeek}.${org.id}`,
            })

            await sendCopilotInsight({ organizationId: org.id, insightId: insight.id })

            results.generated++
            log.info("insight generated", { organizationId: org.id, slug: org.slug, isoWeek, insightId: insight.id })
        } catch (e) {
            const msg = `${org.id}: ${e instanceof Error ? e.message : "unknown"}`
            results.errors.push(msg)
            log.error("org failed", { msg })
        }
    }

    return NextResponse.json(results)
}

export async function POST(request: Request) {
    return GET(request)
}
