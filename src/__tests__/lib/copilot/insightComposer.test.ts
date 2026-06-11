/**
 * Tests del composer (T4.3). LLM siempre mockeado — el composer debe ser
 * determinístico y NUNCA romper al caller.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

const mockCreateMessage = vi.fn()

vi.mock("@/lib/ai/anthropic", () => ({
    createMessage: (...args: unknown[]) => mockCreateMessage(...args),
}))

import { composeWeeklyInsight } from "@/lib/copilot/insightComposer"
import type { WeeklyMetrics } from "@/lib/copilot/weeklyMetrics"

function buildMetrics(overrides: Partial<WeeklyMetrics> = {}): WeeklyMetrics {
    return {
        weekStart: new Date("2026-06-03T00:00:00Z"),
        weekEnd: new Date("2026-06-10T00:00:00Z"),
        previousWeekStart: new Date("2026-05-27T00:00:00Z"),
        orders: { count: 18, revenue: 2400000, ticketAvg: 133000 },
        ordersPrev: { count: 12, revenue: 1500000 },
        conversations: { count: 40, whatsappPct: 60 },
        conversationsPrev: { count: 35 },
        cartsAbandoned: [{ id: "s1", customerName: null, total: 90000, createdAt: "2026-06-09T10:00:00Z" }],
        inactiveCustomers: [{ id: "c1", name: "Laura", lastOrderAt: "2026-05-01T00:00:00Z" }],
        topProductsViewed: [{ productId: "p1", name: "Serum", views: 120, conversions: 8 }],
        topProductsConverted: [{ productId: "p1", name: "Serum", orders: 8, revenue: 800000 }],
        ...overrides,
    }
}

function llmResponse(payload: unknown) {
    return {
        content: [{ type: "text", text: JSON.stringify(payload) }],
        usage: { input_tokens: 900, output_tokens: 400 },
    }
}

const validLlmPayload = {
    title: "Semana fuerte en serums",
    body: "- Ventas subieron 60% vs semana anterior\n- El Serum lidera conversiones",
    proposed_actions: [
        { kind: "send_coupon_to_customers", human_label: "Cupón 10% a 1 cliente inactivo", requires_approval: true, params: { customer_ids: ["c1"], discount_percent: 10 } },
        { kind: "notify_owner", human_label: "Avisarte si el Serum baja de 5 unidades", requires_approval: true, params: {} },
        { kind: "enable_product", human_label: "Reactivar producto pausado", requires_approval: true, params: { product_id: "p9" } },
    ],
    metrics_snapshot: { orders_count: 18 },
}

beforeEach(() => {
    vi.clearAllMocks()
    mockCreateMessage.mockResolvedValue(llmResponse(validLlmPayload))
})

describe("composeWeeklyInsight", () => {
    it("métricas ricas + LLM válido → insight con 3 acciones", async () => {
        const result = await composeWeeklyInsight({
            organizationId: "org-1",
            locale: "es-CO",
            metrics: buildMetrics(),
        })

        expect(result.title).toBe("Semana fuerte en serums")
        expect(result.proposed_actions).toHaveLength(3)
        expect(mockCreateMessage).toHaveBeenCalledWith(
            expect.objectContaining({ model: "claude-haiku-4-5-20251001", max_tokens: 1500, temperature: 0.4 })
        )
    })

    it("0 actividad total → insight pidiendo contexto SIN llamar al LLM", async () => {
        const result = await composeWeeklyInsight({
            organizationId: "org-1",
            locale: "es-CO",
            metrics: buildMetrics({
                orders: { count: 0, revenue: 0, ticketAvg: 0 },
                ordersPrev: { count: 0, revenue: 0 },
                conversations: { count: 0, whatsappPct: 0 },
            }),
        })

        expect(mockCreateMessage).not.toHaveBeenCalled()
        expect(result.proposed_actions).toEqual([])
        expect(result.title).toContain("pocos datos")
    })

    it("LLM responde JSON inválido → fallback seguro sin acciones", async () => {
        mockCreateMessage.mockResolvedValue({
            content: [{ type: "text", text: "esto no es JSON {" }],
            usage: { input_tokens: 900, output_tokens: 50 },
        })

        const result = await composeWeeklyInsight({ organizationId: "org-1", locale: "es-CO", metrics: buildMetrics() })

        expect(result.proposed_actions).toEqual([])
        expect(result.title.length).toBeGreaterThan(0)
    })

    it("acción fuera de whitelist → se descarta y se conservan las válidas", async () => {
        mockCreateMessage.mockResolvedValue(llmResponse({
            ...validLlmPayload,
            proposed_actions: [
                { kind: "ban_user", human_label: "Banear cliente", requires_approval: true, params: {} },
                ...validLlmPayload.proposed_actions,
            ],
        }))

        const result = await composeWeeklyInsight({ organizationId: "org-1", locale: "es-CO", metrics: buildMetrics() })

        expect(result.proposed_actions).toHaveLength(3)
        expect(result.proposed_actions.map((action) => action.kind)).not.toContain("ban_user")
    })

    it("LLM lanza excepción → fallback sin romper al caller", async () => {
        mockCreateMessage.mockRejectedValue(new Error("anthropic down"))

        const result = await composeWeeklyInsight({ organizationId: "org-1", locale: "es-CO", metrics: buildMetrics() })

        expect(result.proposed_actions).toEqual([])
        expect(result.body.length).toBeGreaterThan(0)
    })

    it("locale en-US produce prompt en inglés y fences de markdown se toleran", async () => {
        mockCreateMessage.mockResolvedValue({
            content: [{ type: "text", text: "```json\n" + JSON.stringify(validLlmPayload) + "\n```" }],
            usage: { input_tokens: 900, output_tokens: 400 },
        })

        const result = await composeWeeklyInsight({ organizationId: "org-1", locale: "en-US", metrics: buildMetrics() })

        const promptSent = mockCreateMessage.mock.calls[0][0].messages[0].content as string
        expect(promptSent).toContain("Respond ONLY in English")
        expect(result.title).toBe("Semana fuerte en serums")
    })
})
