/**
 * Respuestas del merchant al copilot por WhatsApp (Copilot v1 — slice 1).
 *
 * Cierra el loop del modelo Hermes: el reporte semanal termina con
 * "Responde 1, 2, 3 o todas" — este handler procesa esa respuesta desde
 * el webhook de la instancia platform y ejecuta las acciones aprobadas.
 *
 * Seguridad:
 * - Solo responde a números que matcheen un merchant conocido
 *   (organizations.notification_phone o instancia personal conectada).
 *   Números desconocidos se ignoran EN SILENCIO (el número platform es
 *   público por naturaleza — cero superficie para spam/probing).
 * - Solo opera sobre el insight `proposed` MÁS RECIENTE del org.
 * - Dedupe por messageId vía idempotency_key de platform_events
 *   (los reintentos del webhook no re-ejecutan acciones).
 * - El parser es ESTRICTO: nada de LLM aquí — "1".."5", "todas", "no".
 *
 * `createServiceClient` justificado: webhook sin sesión; el org se deriva
 * del número del remitente verificado contra datos propios.
 */

import { createServiceClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { sendPlatformNotification } from "@/lib/notifications/platform-whatsapp"
import { emitPlatformEvent } from "@/lib/events/emit"
import { PLATFORM_EVENT_TYPES } from "@/lib/events/platform-event-types"
import { executeProposedAction } from "./actionExecutor"
import type { CopilotProposedAction } from "./types"

const log = logger("copilot/wa-reply")

export type ReplyIntent =
    | { kind: "action"; index: number }
    | { kind: "all" }
    | { kind: "dismiss" }
    | { kind: "unknown" }

/**
 * Parser ESTRICTO de la respuesta del merchant. Pure — exportado para tests.
 */
export function parseReplyIntent(text: string): ReplyIntent {
    const normalized = text
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")

    if (/^[1-5]$/.test(normalized)) {
        return { kind: "action", index: Number(normalized) - 1 }
    }
    if (["todas", "todo", "todos", "all", "si a todas", "ok a todas"].includes(normalized)) {
        return { kind: "all" }
    }
    if (["no", "rechazar", "ninguna", "ninguno", "nada", "descartar"].includes(normalized)) {
        return { kind: "dismiss" }
    }
    return { kind: "unknown" }
}

interface MatchedMerchant {
    organizationId: string
    orgName: string
}

/**
 * Match del remitente contra merchants conocidos (ambas vías de la cadena).
 * Exportado: también identifica al merchant en el agente conversacional
 * (merchant-agent.ts) — misma política de seguridad para todo inbound.
 */
export async function matchMerchantByPhone(
    supabase: Awaited<ReturnType<typeof createServiceClient>>,
    senderPhone: string
): Promise<MatchedMerchant[]> {
    const digits = senderPhone.replace(/[^\d]/g, "")
    if (digits.length < 10) return []
    const lastTen = digits.slice(-10)

    const [orgsRes, instancesRes] = await Promise.all([
        supabase
            .from("organizations")
            .select("id, name, notification_phone")
            .not("notification_phone", "is", null),
        supabase
            .from("whatsapp_instances")
            .select("organization_id, phone_number")
            .eq("instance_type", "personal")
            .eq("status", "connected"),
    ])

    const matches = new Map<string, MatchedMerchant>()

    for (const org of orgsRes.data ?? []) {
        const phone = (org.notification_phone ?? "").replace(/[^\d]/g, "")
        if (phone && (phone === digits || phone.slice(-10) === lastTen)) {
            matches.set(org.id, { organizationId: org.id, orgName: org.name })
        }
    }

    const instanceOrgIds = (instancesRes.data ?? [])
        .filter((row) => {
            const phone = (row.phone_number ?? "").replace(/[^\d]/g, "")
            return phone && (phone === digits || phone.slice(-10) === lastTen)
        })
        .map((row) => row.organization_id)

    if (instanceOrgIds.length > 0) {
        const { data: orgs } = await supabase
            .from("organizations")
            .select("id, name")
            .in("id", instanceOrgIds)
        for (const org of orgs ?? []) {
            matches.set(org.id, { organizationId: org.id, orgName: org.name })
        }
    }

    return Array.from(matches.values())
}

export interface HandleReplyResult {
    handled: boolean
    replied: boolean
}

export async function handleCopilotWhatsAppReply(params: {
    senderPhone: string
    text: string
    messageId: string
}): Promise<HandleReplyResult> {
    const { senderPhone, text, messageId } = params

    try {
        const supabase = await createServiceClient()

        // 1. Solo merchants conocidos — desconocidos se ignoran en silencio
        const merchants = await matchMerchantByPhone(supabase, senderPhone)
        if (merchants.length === 0) {
            return { handled: false, replied: false }
        }

        // 2. Insight proposed más reciente entre los orgs del remitente
        const { data: insights } = await supabase
            .from("copilot_insights")
            .select("id, organization_id, title, proposed_actions, generated_at")
            .in("organization_id", merchants.map((merchant) => merchant.organizationId))
            .eq("status", "proposed")
            .order("generated_at", { ascending: false })
            .limit(1)

        const insight = insights?.[0]
        const intent = parseReplyIntent(text)

        if (!insight) {
            // Merchant conocido sin nada pendiente: responder solo a intents
            // claros (evita contestar conversación casual al número platform)
            if (intent.kind !== "unknown") {
                await sendPlatformNotification(
                    senderPhone,
                    "🤖 No tengo acciones pendientes por aprobar. Tu próximo reporte llega el lunes a las 9:00 AM. Detalle: https://landingchat.co/dashboard/copilot"
                )
                return { handled: true, replied: true }
            }
            return { handled: false, replied: false }
        }

        const actions = (insight.proposed_actions as CopilotProposedAction[]) ?? []

        // 3. Intent ambiguo → ayuda
        if (intent.kind === "unknown") {
            await sendPlatformNotification(
                senderPhone,
                `🤖 Sobre "${insight.title}": responde con el número de la acción (1-${actions.length}), "todas" para aprobarlas, o "no" para descartar. Detalle: https://landingchat.co/dashboard/copilot`
            )
            return { handled: true, replied: true }
        }

        // 4. Dedupe por messageId: los reintentos del webhook no re-ejecutan
        const dedupe = await emitPlatformEvent({
            organizationId: insight.organization_id,
            eventType: intent.kind === "dismiss"
                ? PLATFORM_EVENT_TYPES.COPILOT_INSIGHT_DISMISSED
                : PLATFORM_EVENT_TYPES.COPILOT_INSIGHT_APPROVED,
            source: "copilot",
            payload: { insight_id: insight.id, via: "whatsapp_reply", reply: text.slice(0, 50) },
            idempotencyKey: `copilot.wa_reply.${messageId}`,
        })
        if (dedupe.duplicate) {
            log.info("duplicate reply webhook, skipping", { messageId })
            return { handled: true, replied: false }
        }

        const now = new Date().toISOString()

        // 5a. Rechazo
        if (intent.kind === "dismiss") {
            await supabase
                .from("copilot_insights")
                .update({
                    status: "dismissed",
                    decided_at: now,
                    decision_note: `Rechazado por WhatsApp ("${text.trim().slice(0, 50)}")`,
                })
                .eq("id", insight.id)
                .eq("status", "proposed")

            await sendPlatformNotification(senderPhone, "👍 Entendido, descarté las acciones de esta semana. Nos vemos el próximo lunes.")
            return { handled: true, replied: true }
        }

        // 5b. Aprobación (una acción o todas)
        const selected = intent.kind === "all"
            ? actions
            : intent.index < actions.length ? [actions[intent.index]] : []

        if (selected.length === 0) {
            await sendPlatformNotification(
                senderPhone,
                `🤖 Ese número no corresponde a ninguna acción (hay ${actions.length}). Responde 1-${actions.length}, "todas" o "no".`
            )
            return { handled: true, replied: true }
        }

        const results: string[] = []
        let executed = 0
        for (const action of selected) {
            const result = await executeProposedAction({
                insightId: insight.id,
                action,
                decidedBy: "whatsapp_reply",
                organizationId: insight.organization_id,
            })
            if (result.ok) {
                executed++
                results.push(`✅ ${action.human_label}`)
            } else {
                results.push(`⚠️ ${action.human_label} — no se pudo ejecutar`)
            }
        }

        await supabase
            .from("copilot_insights")
            .update({
                status: executed > 0 ? "executed" : "dismissed",
                decided_at: now,
                executed_at: executed > 0 ? now : null,
                decision_note: `Aprobado por WhatsApp ("${text.trim().slice(0, 50)}")${executed < selected.length ? " — con fallos" : ""}`,
            })
            .eq("id", insight.id)
            .eq("status", "proposed")

        await sendPlatformNotification(
            senderPhone,
            `${results.join("\n")}\n\n${executed > 0 ? "Listo. " : ""}Detalle: https://landingchat.co/dashboard/copilot`
        )

        log.info("reply processed", { insightId: insight.id, intent: intent.kind, executed })
        return { handled: true, replied: true }
    } catch (error) {
        log.error("reply handler failed", {
            error: error instanceof Error ? error.message : "unknown",
        })
        return { handled: false, replied: false }
    }
}
