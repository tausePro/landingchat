/**
 * Tests de los schemas Zod del copilot (T4.2).
 *
 * El contrato de seguridad: el output del LLM se valida con estos schemas
 * antes de persistir, y la whitelist de `kind` es lo único ejecutable.
 */

import { describe, expect, it } from "vitest"
import {
    CopilotInsightPayloadSchema,
    CopilotProposedActionSchema,
    COPILOT_AUTONOMY_LEVELS,
    COPILOT_INSIGHT_STATUSES,
} from "@/lib/copilot/types"

const validAction = {
    kind: "notify_owner",
    human_label: "Avisarte cuando el stock de Serum baje de 5",
    params: { message: "Stock bajo" },
}

const validPayload = {
    title: "Semana fuerte en serums",
    body: "Las ventas de la categoría serums subieron 32% vs la semana pasada.",
    proposed_actions: [validAction],
    metrics_snapshot: { revenue: 1250000 },
}

describe("CopilotProposedActionSchema", () => {
    it("acepta una acción de la whitelist con defaults", () => {
        const parsed = CopilotProposedActionSchema.parse(validAction)
        expect(parsed.requires_approval).toBe(true)
    })

    it("rechaza una acción fuera de la whitelist", () => {
        const result = CopilotProposedActionSchema.safeParse({
            ...validAction,
            kind: "delete_all_products",
        })
        expect(result.success).toBe(false)
    })
})

describe("CopilotInsightPayloadSchema", () => {
    it("acepta un payload válido y aplica defaults", () => {
        const parsed = CopilotInsightPayloadSchema.parse({
            title: "Sin novedades",
            body: "Semana estable.",
            proposed_actions: [],
        })
        expect(parsed.proposed_actions).toEqual([])
        expect(parsed.metrics_snapshot).toEqual({})
    })

    it("acepta proposed_actions vacío", () => {
        const result = CopilotInsightPayloadSchema.safeParse({ ...validPayload, proposed_actions: [] })
        expect(result.success).toBe(true)
    })

    it("rechaza body de más de 4000 caracteres", () => {
        const result = CopilotInsightPayloadSchema.safeParse({
            ...validPayload,
            body: "x".repeat(4001),
        })
        expect(result.success).toBe(false)
    })

    it("rechaza más de 5 proposed_actions", () => {
        const result = CopilotInsightPayloadSchema.safeParse({
            ...validPayload,
            proposed_actions: Array(6).fill(validAction),
        })
        expect(result.success).toBe(false)
    })

    it("rechaza title vacío", () => {
        const result = CopilotInsightPayloadSchema.safeParse({ ...validPayload, title: "" })
        expect(result.success).toBe(false)
    })
})

describe("constantes de dominio", () => {
    it("statuses e idioma de autonomía coinciden con los CHECK de las migraciones", () => {
        expect(COPILOT_INSIGHT_STATUSES).toEqual(["proposed", "approved", "executed", "dismissed", "expired"])
        expect(COPILOT_AUTONOMY_LEVELS).toEqual(["level_1_propose", "level_2_act_with_whitelist", "level_3_full_autonomy"])
    })
})
