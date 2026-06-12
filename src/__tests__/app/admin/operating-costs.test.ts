/**
 * Tests de la vista de Costos Operativos (super admin): MRR real desde
 * subscriptions (solo active con price > 0), costo AI del mes medido
 * (paginado por el cap de PostgREST), config manual con default seguro.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

let settingsValue: unknown
let subsRows: Array<Record<string, unknown>>
let aiPages: Array<Array<{ cost_usd_cents: number }>>

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(async () => ({
        auth: { getUser: vi.fn(async () => ({ data: { user: { id: "admin" } } })) },
        from: () => {
            const chain: Record<string, unknown> = {}
            chain.select = vi.fn(() => chain)
            chain.eq = vi.fn(() => chain)
            chain.single = vi.fn(async () => ({ data: { is_superadmin: true } }))
            return chain
        },
    })),
    createServiceClient: vi.fn(async () => ({
        from: (table: string) => {
            const chain: Record<string, unknown> = {}
            chain.select = vi.fn(() => chain)
            chain.eq = vi.fn(() => chain)
            chain.gte = vi.fn(() => chain)
            chain.in = vi.fn(() => chain)
            chain.maybeSingle = vi.fn(async () => ({ data: settingsValue ? { value: settingsValue } : null }))
            chain.range = vi.fn(async () => ({ data: aiPages.shift() ?? [], error: null }))
            chain.then = (resolve: (value: unknown) => void) =>
                resolve({ data: table === "subscriptions" ? subsRows : [], error: null })
            return chain
        },
    })),
}))

import { getOperatingCostsOverview } from "@/app/admin/operating-costs/actions"

beforeEach(() => {
    settingsValue = {
        items: [{ id: "vercel", name: "Vercel Pro", monthly_usd: 20 }],
        usd_to_cop_rate: 4200,
    }
    subsRows = [
        { status: "active", price: 599000, currency: "COP" },
        { status: "active", price: 299000, currency: "COP" },
        { status: "active", price: 0, currency: "COP" },
        { status: "trialing", price: 299000, currency: "COP" },
    ]
    aiPages = [[{ cost_usd_cents: 100 }, { cost_usd_cents: 250 }]]
})

describe("getOperatingCostsOverview", () => {
    it("MRR solo cuenta activas con price > 0; trialing aparte", async () => {
        const result = await getOperatingCostsOverview()

        expect(result.success).toBe(true)
        if (!result.success) return
        expect(result.data.mrr).toEqual([{ currency: "COP", amount: 898000, subscriptions: 2 }])
        expect(result.data.trialingCount).toBe(1)
    })

    it("suma el costo AI del mes desde la telemetría", async () => {
        const result = await getOperatingCostsOverview()

        if (!result.success) throw new Error("falló")
        expect(result.data.aiCostMonthUsdCents).toBe(350)
        expect(result.data.aiEventsMonth).toBe(2)
    })

    it("config corrupta o ausente → default seguro (sin items, TRM 4100)", async () => {
        settingsValue = { items: "no-es-array" }

        const result = await getOperatingCostsOverview()

        if (!result.success) throw new Error("falló")
        expect(result.data.config).toEqual({ items: [], usd_to_cop_rate: 4100 })
    })
})
