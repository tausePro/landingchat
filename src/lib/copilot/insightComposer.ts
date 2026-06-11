/**
 * Composer del insight semanal (T4.3): métricas deterministas → prompt →
 * Claude Haiku → validación Zod → CopilotInsightPayload.
 *
 * Contrato de robustez: el composer NUNCA lanza — cualquier fallo (LLM caído,
 * JSON inválido, schema roto) cae a un insight mínimo sin acciones. El worker
 * (T4.4) siempre recibe un payload persistible.
 *
 * Spec: .kiro/specs/copilot-merchant-loop-v0/design.md §3
 */

import { createMessage } from "@/lib/ai/anthropic"
import { calculateCostCents } from "@/lib/ai/pricing"
import { logger } from "@/lib/logger"
import type { SupportedLocale } from "@/types/organization"
import {
    CopilotInsightPayloadSchema,
    CopilotProposedActionSchema,
    type CopilotInsightPayload,
    type CopilotProposedAction,
} from "./types"
import type { WeeklyMetrics } from "./weeklyMetrics"
import { buildWeeklyInsightPrompt } from "./prompts/weeklyInsightPrompt"

const log = logger("copilot/composer")

/** Mismo modelo que el chat agent — cost ladder llega en D2 (post-v0). */
const COMPOSER_MODEL = "claude-haiku-4-5-20251001"
const MAX_TOKENS = 1500
const TEMPERATURE = 0.4

export interface ComposeWeeklyInsightInput {
    organizationId: string
    locale: SupportedLocale
    metrics: WeeklyMetrics
}

function buildMetricsSnapshot(metrics: WeeklyMetrics): Record<string, unknown> {
    return {
        orders_count: metrics.orders.count,
        orders_revenue: metrics.orders.revenue,
        orders_prev_count: metrics.ordersPrev.count,
        orders_prev_revenue: metrics.ordersPrev.revenue,
        conversations_count: metrics.conversations.count,
        carts_abandoned: metrics.cartsAbandoned.length,
        inactive_customers: metrics.inactiveCustomers.length,
    }
}

/** Insight mínimo seguro: sin acciones, válido contra el schema. */
function buildFallbackInsight(metrics: WeeklyMetrics, locale: SupportedLocale, reason: "thin_data" | "llm_failure"): CopilotInsightPayload {
    const es = locale !== "en-US"
    const title = reason === "thin_data"
        ? (es ? "Semana con pocos datos" : "A quiet week of data")
        : (es ? "Resumen semanal" : "Weekly summary")
    const body = reason === "thin_data"
        ? (es
            ? `Esta semana hubo muy poca actividad (${metrics.orders.count} órdenes). Con más ventas y conversaciones podré darte recomendaciones accionables. Mientras tanto: comparte el link de tu tienda y activa tus canales.`
            : `There was very little activity this week (${metrics.orders.count} orders). With more sales and conversations I can give you actionable recommendations. Meanwhile: share your store link and activate your channels.`)
        : (es
            ? `Tu tienda registró ${metrics.orders.count} órdenes y ${metrics.conversations.count} conversaciones esta semana (la anterior: ${metrics.ordersPrev.count} órdenes). No pude generar el análisis detallado esta vez — el próximo reporte llegará con normalidad.`
            : `Your store recorded ${metrics.orders.count} orders and ${metrics.conversations.count} conversations this week (previous week: ${metrics.ordersPrev.count} orders). I couldn't generate the detailed analysis this time — the next report will arrive as usual.`)

    return CopilotInsightPayloadSchema.parse({
        title,
        body,
        proposed_actions: [],
        metrics_snapshot: buildMetricsSnapshot(metrics),
    })
}

/** Quita fences de markdown si el LLM desobedeció el "JSON only". */
function stripMarkdownFences(text: string): string {
    return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim()
}

export async function composeWeeklyInsight(input: ComposeWeeklyInsightInput): Promise<CopilotInsightPayload> {
    const { organizationId, locale, metrics } = input

    // Datos demasiado pobres: no quemamos tokens — insight determinista
    if (metrics.orders.count === 0 && metrics.ordersPrev.count === 0 && metrics.conversations.count === 0) {
        log.info("thin data, skipping LLM", { organizationId })
        return buildFallbackInsight(metrics, locale, "thin_data")
    }

    try {
        const prompt = buildWeeklyInsightPrompt(metrics, locale)
        const response = await createMessage({
            model: COMPOSER_MODEL,
            max_tokens: MAX_TOKENS,
            temperature: TEMPERATURE,
            messages: [{ role: "user", content: prompt }],
        })

        const costCents = calculateCostCents(COMPOSER_MODEL, response.usage)
        log.info("insight composed", {
            organizationId,
            costUsdCents: costCents,
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
        })

        const textBlock = response.content.find((block) => block.type === "text")
        if (!textBlock || textBlock.type !== "text") {
            log.warn("LLM response without text block", { organizationId })
            return buildFallbackInsight(metrics, locale, "llm_failure")
        }

        const candidate = JSON.parse(stripMarkdownFences(textBlock.text)) as {
            proposed_actions?: unknown[]
        } & Record<string, unknown>

        // Filtrar acciones fuera de whitelist SIN tumbar el payload completo
        const validActions: CopilotProposedAction[] = []
        for (const action of candidate.proposed_actions ?? []) {
            const parsed = CopilotProposedActionSchema.safeParse(action)
            if (parsed.success) {
                validActions.push(parsed.data)
            } else {
                log.warn("dropping non-whitelisted action from LLM", {
                    organizationId,
                    kind: (action as { kind?: unknown })?.kind,
                })
            }
        }

        const validation = CopilotInsightPayloadSchema.safeParse({
            ...candidate,
            proposed_actions: validActions.slice(0, 5),
            metrics_snapshot: candidate.metrics_snapshot ?? buildMetricsSnapshot(metrics),
        })

        if (!validation.success) {
            log.warn("LLM payload failed schema validation", {
                organizationId,
                issue: validation.error.issues[0]?.message,
            })
            return buildFallbackInsight(metrics, locale, "llm_failure")
        }

        return validation.data
    } catch (error) {
        log.error("composer failed, using fallback", {
            organizationId,
            message: error instanceof Error ? error.message : "unknown",
        })
        return buildFallbackInsight(metrics, locale, "llm_failure")
    }
}
