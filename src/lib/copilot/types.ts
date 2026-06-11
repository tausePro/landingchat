/**
 * Tipos y schemas del Copilot Merchant Loop v0.
 *
 * Los schemas Zod validan el output del LLM (composer) ANTES de persistir
 * en `copilot_insights` — el LLM nunca escribe shapes arbitrarios en DB.
 * La whitelist de acciones es el contrato de seguridad del executor:
 * cualquier `kind` fuera de ella se rechaza aunque el insight esté aprobado.
 *
 * Spec: .kiro/specs/copilot-merchant-loop-v0/design.md §2.2
 */

import { z } from "zod"

/** Whitelist v0 de acciones ejecutables (Level 2). */
export const CopilotActionKindSchema = z.enum([
    "send_coupon_to_customers",
    "pause_product",
    "enable_product",
    "notify_owner",
])
export type CopilotActionKind = z.infer<typeof CopilotActionKindSchema>

export const CopilotProposedActionSchema = z.object({
    kind: CopilotActionKindSchema,
    human_label: z.string().min(1).max(200),
    requires_approval: z.boolean().default(true),
    params: z.record(z.string(), z.unknown()).default({}),
})
export type CopilotProposedAction = z.infer<typeof CopilotProposedActionSchema>

export const CopilotInsightPayloadSchema = z.object({
    title: z.string().min(1).max(200),
    body: z.string().min(1).max(4000),
    proposed_actions: z.array(CopilotProposedActionSchema).max(5),
    metrics_snapshot: z.record(z.string(), z.unknown()).default({}),
})
export type CopilotInsightPayload = z.infer<typeof CopilotInsightPayloadSchema>

export const COPILOT_INSIGHT_STATUSES = ["proposed", "approved", "executed", "dismissed", "expired"] as const
export type CopilotInsightStatus = typeof COPILOT_INSIGHT_STATUSES[number]

export const COPILOT_AUTONOMY_LEVELS = ["level_1_propose", "level_2_act_with_whitelist", "level_3_full_autonomy"] as const
export type CopilotAutonomyLevel = typeof COPILOT_AUTONOMY_LEVELS[number]

/** Fila de copilot_insights tal como la lee el dashboard. */
export interface CopilotInsightRow {
    id: string
    organization_id: string
    generated_at: string
    scope: "weekly" | "daily" | "on_demand"
    iso_week: string | null
    status: CopilotInsightStatus
    title: string
    body: string
    proposed_actions: CopilotProposedAction[]
    metrics_snapshot: Record<string, unknown>
    decided_at: string | null
    decided_by: string | null
    decision_note: string | null
    executed_at: string | null
    expires_at: string
    created_at: string
}
