/**
 * Tests de decideCopilotInsight (T4.6.b): aprobar/rechazar bajo RLS,
 * ejecución parcial por índices, idempotencia de decisiones.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthGetUser = vi.fn()
const mockInsightMaybeSingle = vi.fn()
const mockInsightUpdateEq = vi.fn()
const mockExecute = vi.fn()
const mockEmit = vi.fn()

const updateCalls: Array<Record<string, unknown>> = []

function insightsChain() {
    const chain: Record<string, unknown> = {}
    chain.select = vi.fn(() => chain)
    chain.eq = vi.fn(() => chain)
    chain.maybeSingle = mockInsightMaybeSingle
    chain.update = vi.fn((payload: Record<string, unknown>) => {
        updateCalls.push(payload)
        return { eq: mockInsightUpdateEq }
    })
    return chain
}

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(async () => ({
        auth: { getUser: mockAuthGetUser },
        from: (table: string) => {
            if (table === "copilot_insights") return insightsChain()
            throw new Error(`Tabla inesperada: ${table}`)
        },
    })),
    createServiceClient: vi.fn(),
}))

vi.mock("@/lib/copilot/actionExecutor", () => ({
    executeProposedAction: (...args: unknown[]) => mockExecute(...args),
}))

vi.mock("@/lib/events/emit", () => ({
    emitPlatformEvent: (...args: unknown[]) => mockEmit(...args),
}))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

import { decideCopilotInsight } from "@/app/dashboard/copilot/actions"

const INSIGHT_ID = "3f2c9a10-0000-4000-8000-0000000000aa"

const PROPOSED_INSIGHT = {
    id: INSIGHT_ID,
    organization_id: "org-1",
    status: "proposed",
    proposed_actions: [
        { kind: "notify_owner", human_label: "Acción 0", requires_approval: true, params: {} },
        { kind: "pause_product", human_label: "Acción 1", requires_approval: true, params: { product_id: "p1" } },
        { kind: "enable_product", human_label: "Acción 2", requires_approval: true, params: { product_id: "p2" } },
    ],
}

beforeEach(() => {
    vi.clearAllMocks()
    updateCalls.length = 0
    mockAuthGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    mockInsightMaybeSingle.mockResolvedValue({ data: PROPOSED_INSIGHT })
    mockInsightUpdateEq.mockResolvedValue({ error: null })
    mockExecute.mockResolvedValue({ ok: true })
    mockEmit.mockResolvedValue({ ok: true })
})

describe("decideCopilotInsight", () => {
    it("approve sin índices ejecuta todas las acciones → executed = total", async () => {
        const result = await decideCopilotInsight({ insightId: INSIGHT_ID, decision: "approve" })

        expect(result.success).toBe(true)
        if (result.success) expect(result.data).toEqual({ executed: 3, failed: 0 })
        expect(mockExecute).toHaveBeenCalledTimes(3)
        expect(updateCalls[0]).toMatchObject({ status: "executed", decided_by: "user-1" })
        expect(updateCalls[0].executed_at).toBeTruthy()
    })

    it("approve con índices parciales ejecuta solo esos", async () => {
        const result = await decideCopilotInsight({
            insightId: INSIGHT_ID,
            decision: "approve",
            actionIndices: [0, 2],
        })

        expect(result.success).toBe(true)
        if (result.success) expect(result.data.executed).toBe(2)
        const kinds = mockExecute.mock.calls.map((call) => call[0].action.kind)
        expect(kinds).toEqual(["notify_owner", "enable_product"])
        // organization_id viene del row leído bajo RLS
        expect(mockExecute.mock.calls[0][0].organizationId).toBe("org-1")
    })

    it("dismiss persiste status + nota y no ejecuta nada", async () => {
        const result = await decideCopilotInsight({
            insightId: INSIGHT_ID,
            decision: "dismiss",
            note: "No aplica esta semana",
        })

        expect(result.success).toBe(true)
        expect(mockExecute).not.toHaveBeenCalled()
        expect(updateCalls[0]).toMatchObject({
            status: "dismissed",
            decision_note: "No aplica esta semana",
            decided_by: "user-1",
        })
        expect(mockEmit).toHaveBeenCalledWith(expect.objectContaining({ eventType: "copilot.insight_dismissed" }))
    })

    it("insight de otro org (RLS devuelve vacío) → not_found", async () => {
        mockInsightMaybeSingle.mockResolvedValue({ data: null })

        const result = await decideCopilotInsight({ insightId: INSIGHT_ID, decision: "approve" })

        expect(result.success).toBe(false)
        if (!result.success) expect(result.error).toBe("not_found")
        expect(mockExecute).not.toHaveBeenCalled()
    })

    it("insight ya ejecutado → idempotente, no re-ejecuta", async () => {
        mockInsightMaybeSingle.mockResolvedValue({ data: { ...PROPOSED_INSIGHT, status: "executed" } })

        const result = await decideCopilotInsight({ insightId: INSIGHT_ID, decision: "approve" })

        expect(result.success).toBe(false)
        if (!result.success) expect(result.error).toContain("insight_already_executed")
        expect(mockExecute).not.toHaveBeenCalled()
    })

    it("todas las acciones fallan → status dismissed con execution_failed", async () => {
        mockExecute.mockResolvedValue({ ok: false, error: "boom" })

        const result = await decideCopilotInsight({ insightId: INSIGHT_ID, decision: "approve" })

        expect(result.success).toBe(true)
        if (result.success) expect(result.data).toEqual({ executed: 0, failed: 3 })
        expect(updateCalls[0]).toMatchObject({ status: "dismissed" })
        expect(String(updateCalls[0].decision_note)).toContain("execution_failed")
    })
})
