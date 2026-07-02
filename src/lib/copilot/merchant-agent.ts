/**
 * Atlas conversacional (v0) — agente merchant-facing por WhatsApp.
 *
 * Los merchants escriben TEXTO LIBRE al número de la plataforma y Atlas
 * responde: métricas de la semana, reporte on-demand, acciones pendientes.
 *
 * Diseño v0 (decisiones de seguridad):
 * - Tools de LECTURA. La única escritura es crear un insight `on_demand`
 *   (mismo rate-limit 1/24h que el dashboard). Las ACCIONES siguen el
 *   mecanismo de aprobación existente: Atlas lista acciones numeradas y el
 *   merchant responde "1/2/3/todas/no" → eso lo procesa whatsappReplyHandler
 *   con su whitelist. El agente JAMÁS muta directo desde texto libre.
 * - Identidad: matchMerchantByPhone (mismo precedente del loop 1/2/3).
 *   Números desconocidos = silencio total. Multi-org: opera sobre el primer
 *   match y lo dice explícito en la respuesta.
 * - Dedupe por messageId + rate-limit diario por org vía platform_events
 *   (event_type copilot.atlas_chat_reply).
 * - Respuesta free-form (la ventana de 24h está abierta porque el merchant
 *   inició); sendPlatformText hace fallback a template si falla.
 *
 * `createServiceClient()` justificado: corre desde webhook sin sesión; el
 * org se deriva del número del remitente verificado contra datos propios.
 */

import type Anthropic from "@anthropic-ai/sdk"
import { createServiceClient } from "@/lib/supabase/server"
import { createMessage } from "@/lib/ai/anthropic"
import { logger } from "@/lib/logger"
import { emitPlatformEvent } from "@/lib/events/emit"
import { PLATFORM_EVENT_TYPES } from "@/lib/events/platform-event-types"
import { sendPlatformText } from "@/lib/notifications/platform-whatsapp"
import { matchMerchantByPhone } from "./whatsappReplyHandler"
import { loadWeeklyMetrics } from "./weeklyMetrics"
import { composeWeeklyInsight } from "./insightComposer"
import { isAtlasSkillEnabled, type AtlasSkillsConfig } from "./atlas-skills"
import type { CopilotProposedAction } from "./types"
import type { SupportedLocale } from "@/types/organization"

const log = logger("copilot/merchant-agent")

/** Mismo modelo del composer (cost ladder llega después). */
const AGENT_MODEL = "claude-haiku-4-5-20251001"
const MAX_TOKENS = 700
const TEMPERATURE = 0.5
/** Mensajes procesados por org por 24h (control de costos). */
const DAILY_LIMIT = 30
/** Vueltas máximas de tools por mensaje. */
const MAX_TOOL_TURNS = 3

const DASHBOARD_URL = "https://landingchat.co/dashboard"
const FALLBACK_MESSAGE = `🤖 Tuve un problema procesando tu mensaje. Intenta de nuevo en un momento o revisa tu dashboard: ${DASHBOARD_URL}/copilot`

const AGENT_TOOLS: Anthropic.Tool[] = [
    {
        name: "get_weekly_metrics",
        description:
            "Métricas de los últimos 7 días del negocio: ventas, órdenes, conversaciones, carritos abandonados, clientes inactivos y productos top. Úsala para responder preguntas de desempeño.",
        input_schema: { type: "object", properties: {}, required: [] },
    },
    {
        name: "generate_report",
        description:
            "Genera el reporte Atlas del día con acciones propuestas (máximo 1 cada 24h; si ya existe devuelve el existente). Úsala cuando pidan 'mi reporte', 'cómo va todo', o quieran acciones para crecer.",
        input_schema: { type: "object", properties: {}, required: [] },
    },
    {
        name: "list_pending_actions",
        description:
            "Lista las acciones propuestas PENDIENTES de aprobar del reporte más reciente, numeradas. El merchant las aprueba respondiendo con el número.",
        input_schema: { type: "object", properties: {}, required: [] },
    },
]

function buildSystemPrompt(orgName: string, multiOrgNote: string): string {
    return `Eres Atlas, el copiloto de crecimiento de LandingChat para el negocio "${orgName}".
Hablas por WhatsApp con el DUEÑO del negocio. Responde SIEMPRE en español, corto y accionable (máximo ~900 caracteres), estilo WhatsApp: frases directas, saltos de línea, emojis con moderación, sin markdown pesado.
Tu alcance HOY: consultar métricas de los últimos 7 días (get_weekly_metrics), generar el reporte del día (generate_report, máx 1/día) y listar acciones pendientes (list_pending_actions).
NUNCA inventes números: usa las tools. Si el dato no está, dilo.
Si hay acciones propuestas pendientes, cierra SIEMPRE con: 'Responde 1-N para aprobar una, "todas" o "no"'.
Si piden algo fuera de tu alcance (editar productos, campañas masivas, facturación, soporte técnico), dirígelos al dashboard: ${DASHBOARD_URL}${multiOrgNote}`
}

interface AgentContext {
    supabase: Awaited<ReturnType<typeof createServiceClient>>
    organizationId: string
    locale: SupportedLocale
    growthEnabled: boolean
}

/** Ejecuta una tool del agente y retorna el resultado como texto (JSON compacto). */
async function executeAgentTool(name: string, context: AgentContext): Promise<string> {
    const { supabase, organizationId } = context

    if (name === "get_weekly_metrics") {
        const metrics = await loadWeeklyMetrics(organizationId)
        return JSON.stringify(metrics)
    }

    if (name === "list_pending_actions") {
        const { data: insights } = await supabase
            .from("copilot_insights")
            .select("id, title, proposed_actions, generated_at")
            .eq("organization_id", organizationId)
            .eq("status", "proposed")
            .order("generated_at", { ascending: false })
            .limit(1)
        const insight = insights?.[0]
        if (!insight) return JSON.stringify({ pending: false, note: "No hay acciones pendientes de aprobar." })
        const actions = ((insight.proposed_actions as CopilotProposedAction[]) ?? []).map(
            (action, index) => `${index + 1}. ${action.human_label}`
        )
        return JSON.stringify({ pending: true, title: insight.title, actions })
    }

    if (name === "generate_report") {
        // Mismo rate-limit 1/24h del dashboard (generateOnDemandInsight)
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const { count } = await supabase
            .from("copilot_insights")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", organizationId)
            .eq("scope", "on_demand")
            .gte("generated_at", since)

        if ((count ?? 0) >= 1) {
            const { data: existing } = await supabase
                .from("copilot_insights")
                .select("title, body, proposed_actions")
                .eq("organization_id", organizationId)
                .eq("scope", "on_demand")
                .gte("generated_at", since)
                .order("generated_at", { ascending: false })
                .limit(1)
            const report = existing?.[0]
            return JSON.stringify({
                created: false,
                note: "Ya existe el reporte de hoy (máx 1 cada 24h). Este es:",
                title: report?.title,
                body: report?.body,
                actions: ((report?.proposed_actions as CopilotProposedAction[]) ?? []).map(
                    (action, index) => `${index + 1}. ${action.human_label}`
                ),
            })
        }

        const metrics = await loadWeeklyMetrics(organizationId)
        const payload = await composeWeeklyInsight({
            organizationId,
            locale: context.locale,
            metrics,
            growthEnabled: context.growthEnabled,
        })
        const { data: insight, error } = await supabase
            .from("copilot_insights")
            .insert({
                organization_id: organizationId,
                scope: "on_demand",
                status: "proposed",
                title: payload.title,
                body: payload.body,
                proposed_actions: payload.proposed_actions,
                metrics_snapshot: payload.metrics_snapshot,
            })
            .select("id")
            .single()
        if (error || !insight) return JSON.stringify({ created: false, note: "No se pudo generar el reporte." })

        await emitPlatformEvent({
            organizationId,
            eventType: PLATFORM_EVENT_TYPES.COPILOT_INSIGHT_PROPOSED,
            source: "whatsapp",
            payload: { insight_id: insight.id, scope: "on_demand", via: "atlas_chat" },
        })
        return JSON.stringify({
            created: true,
            title: payload.title,
            body: payload.body,
            actions: (payload.proposed_actions ?? []).map(
                (action, index) => `${index + 1}. ${action.human_label}`
            ),
        })
    }

    return JSON.stringify({ error: `Tool desconocida: ${name}` })
}

/** Loop de tools con Claude — máx MAX_TOOL_TURNS vueltas. */
async function runAgentLoop(text: string, system: string, context: AgentContext): Promise<string> {
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: text.slice(0, 1000) }]

    for (let turn = 0; turn <= MAX_TOOL_TURNS; turn++) {
        const response = await createMessage({
            model: AGENT_MODEL,
            max_tokens: MAX_TOKENS,
            temperature: TEMPERATURE,
            system,
            tools: AGENT_TOOLS,
            messages,
        })

        const toolUses = response.content.filter(
            (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
        )

        if (response.stop_reason === "tool_use" && toolUses.length > 0 && turn < MAX_TOOL_TURNS) {
            messages.push({ role: "assistant", content: response.content })
            const results: Anthropic.ToolResultBlockParam[] = []
            for (const toolUse of toolUses) {
                let result: string
                try {
                    result = await executeAgentTool(toolUse.name, context)
                } catch (error) {
                    log.error("tool failed", {
                        tool: toolUse.name,
                        error: error instanceof Error ? error.message : "unknown",
                    })
                    result = JSON.stringify({ error: "La tool falló, discúlpate y sugiere el dashboard." })
                }
                results.push({ type: "tool_result", tool_use_id: toolUse.id, content: result })
            }
            messages.push({ role: "user", content: results })
            continue
        }

        const finalText = response.content
            .filter((block): block is Anthropic.TextBlock => block.type === "text")
            .map((block) => block.text)
            .join("\n")
            .trim()
        if (finalText) return finalText.slice(0, 1200)
        break
    }

    return FALLBACK_MESSAGE
}

export interface MerchantMessageResult {
    handled: boolean
    replied: boolean
}

/**
 * Procesa un mensaje de texto libre de un merchant al número de la
 * plataforma. Contrato: nunca lanza (el webhook responde 200 a Meta).
 */
export async function processMerchantMessage(params: {
    senderPhone: string
    text: string
    messageId: string
}): Promise<MerchantMessageResult> {
    const { senderPhone, text, messageId } = params

    try {
        const supabase = await createServiceClient()

        // 1. Solo merchants conocidos — desconocidos se ignoran en silencio
        const merchants = await matchMerchantByPhone(supabase, senderPhone)
        if (merchants.length === 0) {
            return { handled: false, replied: false }
        }
        const merchant = merchants[0]

        // 2. Dedupe por messageId (reintentos del webhook no reprocesan)
        const emitted = await emitPlatformEvent({
            organizationId: merchant.organizationId,
            eventType: PLATFORM_EVENT_TYPES.ATLAS_CHAT_REPLY,
            source: "whatsapp",
            payload: { message_id: messageId, preview: text.slice(0, 80) },
            idempotencyKey: `copilot.atlas_chat.${messageId}`,
        })
        if (emitted.duplicate) {
            return { handled: true, replied: false }
        }

        // 3. Rate limit diario por org (control de costos)
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const { count } = await supabase
            .from("platform_events")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", merchant.organizationId)
            .eq("event_type", PLATFORM_EVENT_TYPES.ATLAS_CHAT_REPLY)
            .gte("occurred_at", since)
        const used = count ?? 0
        if (used > DAILY_LIMIT) {
            log.info("daily limit exceeded, silent", { organizationId: merchant.organizationId })
            return { handled: true, replied: false }
        }
        if (used === DAILY_LIMIT) {
            await sendPlatformText(
                senderPhone,
                `🤖 Llegamos al límite de mensajes de hoy. Seguimos mañana, o revisa tu dashboard: ${DASHBOARD_URL}/copilot`
            )
            return { handled: true, replied: true }
        }

        // 4. Contexto del org para el prompt + tools
        const { data: org } = await supabase
            .from("organizations")
            .select("name, locale, settings")
            .eq("id", merchant.organizationId)
            .single()
        const locale: SupportedLocale = org?.locale === "en-US" ? "en-US" : "es-CO"
        const growthEnabled = isAtlasSkillEnabled(
            "growth",
            ((org?.settings as Record<string, unknown> | null)?.atlas_skills as AtlasSkillsConfig) ?? null
        )
        const multiOrgNote = merchants.length > 1
            ? `\nOJO: este número está asociado a ${merchants.length} negocios; estás respondiendo por "${merchant.orgName}". Menciónalo brevemente.`
            : ""

        const context: AgentContext = {
            supabase,
            organizationId: merchant.organizationId,
            locale,
            growthEnabled,
        }

        // 5. Agente + respuesta free-form (fallback interno a template)
        let reply: string
        try {
            reply = await runAgentLoop(text, buildSystemPrompt(org?.name ?? merchant.orgName, multiOrgNote), context)
        } catch (error) {
            log.error("agent loop failed", { error: error instanceof Error ? error.message : "unknown" })
            reply = FALLBACK_MESSAGE
        }

        const sent = await sendPlatformText(senderPhone, reply)
        log.info("merchant message processed", {
            organizationId: merchant.organizationId,
            replied: sent.delivered,
        })
        return { handled: true, replied: sent.delivered }
    } catch (error) {
        log.error("processMerchantMessage failed", {
            error: error instanceof Error ? error.message : "unknown",
        })
        return { handled: false, replied: false }
    }
}
