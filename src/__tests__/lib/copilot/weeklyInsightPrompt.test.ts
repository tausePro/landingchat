/**
 * Tests del prompt semanal — piloto del skill "Crecimiento" (Growth Operator).
 * Verifica que la rama commerce inyecta el LENS sin cambiar el contrato de salida,
 * y que la rama appointment-first (real_estate/services) conserva su propio framing.
 */

import { describe, it, expect } from "vitest"
import { buildWeeklyInsightPrompt } from "@/lib/copilot/prompts/weeklyInsightPrompt"
import type { WeeklyMetrics } from "@/lib/copilot/weeklyMetrics"

function buildMetrics(overrides: Partial<WeeklyMetrics> = {}): WeeklyMetrics {
    return {
        weekStart: new Date("2026-06-03T00:00:00Z"),
        weekEnd: new Date("2026-06-10T00:00:00Z"),
        previousWeekStart: new Date("2026-05-27T00:00:00Z"),
        vertical: "commerce",
        orders: { count: 18, revenue: 2400000, ticketAvg: 133000 },
        ordersPrev: { count: 12, revenue: 1500000 },
        conversations: { count: 40, whatsappPct: 60 },
        conversationsPrev: { count: 35 },
        appointments: { count: 0, completed: 0 },
        appointmentsPrev: { count: 0 },
        cartsAbandoned: [{ id: "s1", customerName: null, total: 90000, createdAt: "2026-06-09T10:00:00Z" }],
        inactiveCustomers: [{ id: "c1", name: "Laura", lastOrderAt: "2026-05-01T00:00:00Z" }],
        topProductsViewed: [{ productId: "p1", name: "Serum", views: 120, conversions: 8 }],
        topProductsConverted: [{ productId: "p1", name: "Serum", orders: 8, revenue: 800000 }],
        ...overrides,
    }
}

describe("buildWeeklyInsightPrompt — skill Crecimiento (Growth Operator)", () => {
    it("commerce: inyecta el LENS de Growth Operator (North Star + funnel + hipótesis)", () => {
        const prompt = buildWeeklyInsightPrompt(buildMetrics(), "es-CO")
        expect(prompt).toContain("GROWTH OPERATOR")
        expect(prompt).toContain("North Star")
        expect(prompt).toContain("testable hypothesis")
    })

    it("commerce: NO cambia el contrato de salida (mismo schema + acciones)", () => {
        const prompt = buildWeeklyInsightPrompt(buildMetrics(), "es-CO")
        expect(prompt).toContain("Return JSON only")
        expect(prompt).toContain("proposed_actions")
        expect(prompt).toContain("send_coupon_to_customers|pause_product|enable_product|notify_owner")
    })

    it("commerce: respeta la regla de oro (no inventar CAC/LTV, no en el contexto)", () => {
        const prompt = buildWeeklyInsightPrompt(buildMetrics(), "es-CO")
        expect(prompt).toContain("CAC/LTV")
        // Órdenes/ingresos SÍ están en el contexto (es su North Star)
        expect(prompt).toContain("Orders:")
        expect(prompt).toContain("Revenue:")
    })

    it("appointment-first (real_estate): NO usa el LENS de commerce; conserva su framing de atención+citas", () => {
        const prompt = buildWeeklyInsightPrompt(buildMetrics({
            vertical: "real_estate",
            orders: { count: 0, revenue: 0, ticketAvg: 0 },
            ordersPrev: { count: 0, revenue: 0 },
            conversations: { count: 126, whatsappPct: 98 },
            appointments: { count: 6, completed: 1 },
            appointmentsPrev: { count: 5 },
        }), "es-CO")
        expect(prompt).not.toContain("GROWTH OPERATOR")
        expect(prompt).toContain("CRITICAL FRAMING")
        expect(prompt).toContain("property visits")
        expect(prompt).not.toContain("Revenue:")
    })

    it("en-US: el LENS sale y el idioma es inglés", () => {
        const prompt = buildWeeklyInsightPrompt(buildMetrics(), "en-US")
        expect(prompt).toContain("Respond ONLY in English")
        expect(prompt).toContain("GROWTH OPERATOR")
    })
})
