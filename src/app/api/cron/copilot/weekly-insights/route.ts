import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { computeIsoWeek } from "@/lib/utils/iso-week"
import { fetchAllPages } from "@/lib/supabase/fetch-all"
import { loadWeeklyMetrics } from "@/lib/copilot/weeklyMetrics"
import { composeWeeklyInsight } from "@/lib/copilot/insightComposer"
import { emitPlatformEvent } from "@/lib/events/emit"
import { PLATFORM_EVENT_TYPES } from "@/lib/events/platform-event-types"
import { sendCopilotInsight } from "@/lib/notifications/whatsapp"
import { sendCopilotInsightEmail } from "@/lib/notifications/email"
import { logNotification } from "@/lib/notifications/log"
import { getTenantLocale } from "@/lib/i18n/tenant-locale"

export const dynamic = "force-dynamic"
// El batch llama al LLM por org: darle aire más allá del default
export const maxDuration = 300

const log = logger("copilot/weekly")

interface EligibleOrg {
    id: string
    slug: string
    name: string | null
    contact_email: string | null
    notification_emails: string[] | null
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

    // Mismo patrón que los otros 4 crons: enforce SOLO si CRON_SECRET está
    // seteado. Antes usaba `!cronSecret || ...` (estricto) y era el ÚNICO cron
    // así → como CRON_SECRET no está en Vercel, devolvía 401 SIEMPRE y nunca
    // ejecutaba (bug 2026-06-15, confirmado en logs: GET 401 vercel-cron/1.0).
    // Recomendado: setear CRON_SECRET en Vercel para asegurar los 5 crons.
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createServiceClient()
    const isoWeek = computeIsoWeek(new Date())

    // Elegibilidad v2 (platform-notifier T4): orgs con ACTIVIDAD en la
    // semana (≥1 orden o conversación) y onboarding completo. Ya NO se
    // exige WhatsApp conectado: la entrega pasa por la cadena notifyMerchant
    // (personal → platform → solo dashboard) y el feed de /dashboard/copilot
    // es la fuente de verdad. Nota: sin JOIN embebido — la FK de
    // whatsapp_instances no existe en el schema cache de prod (T0b).
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    // fetchAllPages: sin paginar, PostgREST capa en 1000 filas y con volumen
    // cross-tenant las orgs más antiguas del scan quedarían fuera del cron
    const [ordersRes, chatsRes] = await Promise.all([
        fetchAllPages<{ organization_id: string }>((from, to) =>
            supabase.from("orders").select("organization_id").gte("created_at", weekAgo).range(from, to),
            { maxRows: 50_000 }
        ),
        fetchAllPages<{ organization_id: string }>((from, to) =>
            supabase.from("chats").select("organization_id").gte("created_at", weekAgo).range(from, to),
            { maxRows: 50_000 }
        ),
    ])

    if (ordersRes.error || chatsRes.error) {
        const error = ordersRes.error ?? chatsRes.error ?? "unknown"
        log.error("failed to load weekly activity", { error })
        return NextResponse.json({ error: "Failed to load activity" }, { status: 500 })
    }

    const activeOrgIds = [...new Set([
        ...ordersRes.rows.map((row) => row.organization_id),
        ...chatsRes.rows.map((row) => row.organization_id),
    ])]

    if (activeOrgIds.length === 0) {
        return NextResponse.json({ message: "No eligible orgs", generated: 0, skipped: 0, errors: [] })
    }

    const { data: orgs, error: orgsError } = await supabase
        .from("organizations")
        .select("id, slug, name, contact_email, notification_emails, locale, currency_code, country_code, copilot_autonomy_level")
        .in("id", activeOrgIds)
        .eq("onboarding_completed", true)

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

            // Canal REDUNDANTE por correo: el insight llega aunque el WhatsApp
            // del merchant falle. Se registra en notification_logs (channel=email).
            const emailResult = await sendCopilotInsightEmail({
                ownerEmail: org.contact_email ?? "",
                additionalEmails: org.notification_emails ?? [],
                title: payload.title,
                body: payload.body,
                proposedActions: payload.proposed_actions ?? [],
                organizationName: org.name ?? org.slug,
            })
            await logNotification({
                organizationId: org.id,
                kind: "copilot_insight",
                channel: "email",
                recipientType: "owner",
                status: emailResult.status,
                channelUsed: "resend",
                error: emailResult.error ?? null,
            })

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
