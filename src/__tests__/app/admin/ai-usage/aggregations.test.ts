import { describe, expect, it } from "vitest"
import {
    buildOverview,
    calculateCacheHitRate,
    percentile,
    type AiUsageEventRow,
} from "@/app/admin/ai-usage/lib/aggregations"

function makeRow(overrides: Partial<AiUsageEventRow> = {}): AiUsageEventRow {
    return {
        organization_id: "org-1",
        model: "claude-haiku-4-5-20251001",
        mode: "ecommerce",
        channel: "web",
        input_tokens: 1000,
        output_tokens: 200,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        cost_usd_cents: 1,
        latency_ms: 500,
        error_code: null,
        created_at: "2026-06-01T10:00:00Z",
        ...overrides,
    }
}

describe("percentile", () => {
    it("array vacío devuelve 0 sin lanzar", () => {
        expect(percentile([], 0.5)).toBe(0)
    })

    it("p=0 devuelve el mínimo", () => {
        expect(percentile([10, 30, 20], 0)).toBe(10)
    })

    it("p=1 devuelve el máximo", () => {
        expect(percentile([10, 30, 20], 1)).toBe(30)
    })

    it("p50 sobre 1..5 = 3 (mediana)", () => {
        expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3)
    })

    it("p95 sobre 1..100 ≈ 95.05 (interpolación lineal)", () => {
        const values = Array.from({ length: 100 }, (_, i) => i + 1)
        expect(percentile(values, 0.95)).toBeCloseTo(95.05, 2)
    })
})

describe("calculateCacheHitRate", () => {
    it("sin tokens devuelve 0 (no NaN)", () => {
        expect(calculateCacheHitRate(0, 0, 0)).toBe(0)
    })

    it("todo fresh input → 0% cache hit", () => {
        expect(calculateCacheHitRate(0, 0, 1000)).toBe(0)
    })

    it("todo cache_read → 100% cache hit", () => {
        expect(calculateCacheHitRate(1000, 0, 0)).toBe(1)
    })

    it("escenario realista: 800 read, 100 create, 100 fresh = 80% hit", () => {
        expect(calculateCacheHitRate(800, 100, 100)).toBeCloseTo(0.8, 2)
    })
})

describe("buildOverview — estado vacío", () => {
    it("rows vacías devuelve hero en ceros y arrays vacíos", () => {
        const overview = buildOverview([])
        expect(overview.hero.total_events).toBe(0)
        expect(overview.hero.total_cost_usd_cents).toBe(0)
        expect(overview.hero.cache_hit_rate).toBe(0)
        expect(overview.hero.error_rate).toBe(0)
        expect(overview.hero.distinct_organizations).toBe(0)
        expect(overview.by_model).toEqual([])
        expect(overview.by_channel).toEqual([])
        expect(overview.by_org_top).toEqual([])
        expect(overview.recent_errors).toEqual([])
    })
})

describe("buildOverview — agregaciones básicas", () => {
    const rows: AiUsageEventRow[] = [
        makeRow({ organization_id: "org-A", model: "claude-haiku-4-5-20251001", cost_usd_cents: 10, latency_ms: 200 }),
        makeRow({ organization_id: "org-A", model: "claude-haiku-4-5-20251001", cost_usd_cents: 15, latency_ms: 400 }),
        makeRow({ organization_id: "org-B", model: "claude-sonnet-4-5-20250929", cost_usd_cents: 100, latency_ms: 800 }),
        makeRow({ organization_id: "org-B", model: "claude-haiku-4-5-20251001", cost_usd_cents: 5, latency_ms: 300, channel: "whatsapp" }),
    ]

    it("totales del hero suman correctamente", () => {
        const o = buildOverview(rows)
        expect(o.hero.total_events).toBe(4)
        expect(o.hero.total_cost_usd_cents).toBe(130)
        expect(o.hero.distinct_organizations).toBe(2)
    })

    it("by_model ordena por costo descendente", () => {
        const o = buildOverview(rows)
        expect(o.by_model[0].model).toBe("claude-sonnet-4-5-20250929")
        expect(o.by_model[0].cost_usd_cents).toBe(100)
        expect(o.by_model[1].model).toBe("claude-haiku-4-5-20251001")
        expect(o.by_model[1].cost_usd_cents).toBe(30)
        expect(o.by_model[1].events).toBe(3)
    })

    it("by_model calcula p50 y p95 por modelo", () => {
        const o = buildOverview(rows)
        const haiku = o.by_model.find((m) => m.model === "claude-haiku-4-5-20251001")
        expect(haiku).toBeDefined()
        // latencies de haiku: [200, 400, 300] → ordenadas: [200, 300, 400]
        expect(haiku!.p50_latency_ms).toBe(300)
        // p95 sobre 3 puntos: rank = 0.95*2 = 1.9 → entre 300 y 400 → 390
        expect(haiku!.p95_latency_ms).toBe(390)
    })

    it("by_channel agrupa por canal y cuenta unknown cuando channel es null", () => {
        const rowsWithNullChannel = [
            ...rows,
            makeRow({ channel: null, cost_usd_cents: 20 }),
        ]
        const o = buildOverview(rowsWithNullChannel)
        const channels = o.by_channel.map((c) => c.channel)
        expect(channels).toContain("web")
        expect(channels).toContain("whatsapp")
        expect(channels).toContain("unknown")
    })

    it("by_org_top ordena por costo y limita a top 20", () => {
        // Generar 25 orgs con costos distintos
        const manyRows = Array.from({ length: 25 }, (_, i) =>
            makeRow({ organization_id: `org-${i}`, cost_usd_cents: (i + 1) * 10 })
        )
        const o = buildOverview(manyRows)
        expect(o.by_org_top.length).toBe(20)
        expect(o.by_org_top[0].organization_id).toBe("org-24") // costo más alto
        expect(o.by_org_top[0].cost_usd_cents).toBe(250)
    })

    it("recent_errors filtra solo eventos con error_code y ordena por created_at DESC", () => {
        const errRows = [
            makeRow({ error_code: null, created_at: "2026-06-01T10:00:00Z" }),
            makeRow({ error_code: "500", created_at: "2026-06-01T09:00:00Z" }),
            makeRow({ error_code: "429", created_at: "2026-06-01T11:00:00Z" }),
        ]
        const o = buildOverview(errRows)
        expect(o.recent_errors.length).toBe(2)
        expect(o.recent_errors[0].error_code).toBe("429")  // más reciente primero
        expect(o.recent_errors[1].error_code).toBe("500")
    })

    it("error_rate calcula proporción correcta", () => {
        const errRows = [
            makeRow({ error_code: null }),
            makeRow({ error_code: null }),
            makeRow({ error_code: "500" }),
            makeRow({ error_code: "429" }),
        ]
        const o = buildOverview(errRows)
        expect(o.hero.error_rate).toBe(0.5)
    })

    it("cache_hit_rate refleja el ratio agregado correctamente", () => {
        const cacheRows = [
            makeRow({ input_tokens: 100, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }),
            makeRow({ input_tokens: 100, cache_creation_input_tokens: 900, cache_read_input_tokens: 0 }),
            makeRow({ input_tokens: 100, cache_creation_input_tokens: 0, cache_read_input_tokens: 900 }),
        ]
        // input total: 300, create total: 900, read total: 900 → hit = 900/2100 ≈ 0.4286
        const o = buildOverview(cacheRows)
        expect(o.hero.cache_hit_rate).toBeCloseTo(900 / 2100, 4)
    })
})
