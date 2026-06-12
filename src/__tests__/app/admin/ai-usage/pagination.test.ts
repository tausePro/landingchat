/**
 * Regresión del fix de paginación en Consumo IA (2026-06-11):
 * PostgREST capa toda respuesta en 1000 filas aunque pidas limit(50001) →
 * todas las ventanas (7/14/30/90 días) mostraban "los 1000 eventos más
 * recientes" y por eso el dashboard se veía idéntico en cada intervalo.
 * Verificado en prod: 7d=1024 eventos, 30d=1675, query devolvía 1000.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

const rangeCalls: Array<[number, number]> = []
let pages: Array<Array<Record<string, unknown>>>

function buildEvent(index: number): Record<string, unknown> {
    return {
        organization_id: `org-${index % 3}`,
        model: "claude-haiku-4-5-20251001",
        mode: "ecommerce",
        channel: "web",
        input_tokens: 100,
        output_tokens: 10,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        cost_usd_cents: 1,
        latency_ms: 500,
        error_code: null,
        created_at: new Date().toISOString(),
    }
}

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(async () => ({
        auth: { getUser: vi.fn(async () => ({ data: { user: { id: "admin-1" } } })) },
        from: (table: string) => {
            const chain: Record<string, unknown> = {}
            chain.select = vi.fn(() => chain)
            chain.eq = vi.fn(() => chain)
            chain.gte = vi.fn(() => chain)
            chain.order = vi.fn(() => chain)
            chain.in = vi.fn(() => chain)
            chain.single = vi.fn(async () => ({ data: { is_superadmin: true }, error: null }))
            chain.returns = vi.fn(() => chain)
            chain.range = vi.fn((from: number, to: number) => {
                rangeCalls.push([from, to])
                const page = pages.shift() ?? []
                return { returns: vi.fn(async () => ({ data: page, error: null })), then: (resolve: (value: unknown) => void) => resolve({ data: page, error: null }) }
            })
            chain.then = (resolve: (value: unknown) => void) =>
                resolve({ data: table === "organizations" ? [] : [], error: null })
            return chain
        },
    })),
    createServiceClient: vi.fn(),
}))

import { getAiUsageOverview } from "@/app/admin/ai-usage/actions"

beforeEach(() => {
    rangeCalls.length = 0
})

describe("getAiUsageOverview — paginación sobre el cap de PostgREST", () => {
    it("agrega TODAS las páginas (1000 + 675 = 1675 eventos, no 1000)", async () => {
        pages = [
            Array.from({ length: 1000 }, (_, index) => buildEvent(index)),
            Array.from({ length: 675 }, (_, index) => buildEvent(index)),
        ]

        const result = await getAiUsageOverview(30)

        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.hero.total_events).toBe(1675)
            expect(result.data.truncated).toBe(false)
        }
        expect(rangeCalls).toEqual([[0, 999], [1000, 1999]])
    })

    it("página parcial corta el loop (una sola request si hay <1000)", async () => {
        pages = [Array.from({ length: 42 }, (_, index) => buildEvent(index))]

        const result = await getAiUsageOverview(7)

        expect(result.success).toBe(true)
        if (result.success) expect(result.data.hero.total_events).toBe(42)
        expect(rangeCalls).toHaveLength(1)
    })
})
