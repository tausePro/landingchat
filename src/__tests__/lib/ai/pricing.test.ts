import { describe, expect, it } from "vitest"
import { calculateCostCents, getSupportedModels } from "@/lib/ai/pricing"

// ============================================================================
// Pricing helper — verifica el calculador de costo por turno.
// Lo que probamos:
//  - Modelos soportados están listados.
//  - Costo se redondea hacia arriba (Math.ceil) para no subfacturar.
//  - Cache hits cuestan ~10x menos que input fresh.
//  - Modelo desconocido devuelve 0 sin lanzar (defensive default).
// ============================================================================

describe("calculateCostCents", () => {
    it("lista al menos Haiku 4.5 y Sonnet 4.5 como modelos soportados", () => {
        const models = getSupportedModels()
        expect(models).toContain("claude-haiku-4-5-20251001")
        expect(models).toContain("claude-sonnet-4-5-20250929")
    })

    it("modelo desconocido devuelve 0 (defensive, no rompe el insert)", () => {
        const cost = calculateCostCents("claude-future-model-xyz", {
            input_tokens: 10_000,
            output_tokens: 1_000,
        })
        expect(cost).toBe(0)
    })

    it("Haiku 4.5: 1M input + 1M output = $1 + $5 = $6 = 600 cents", () => {
        const cost = calculateCostCents("claude-haiku-4-5-20251001", {
            input_tokens: 1_000_000,
            output_tokens: 1_000_000,
        })
        expect(cost).toBe(600)
    })

    it("Sonnet 4.5: 1M input + 1M output = $3 + $15 = $18 = 1800 cents", () => {
        const cost = calculateCostCents("claude-sonnet-4-5-20250929", {
            input_tokens: 1_000_000,
            output_tokens: 1_000_000,
        })
        expect(cost).toBe(1800)
    })

    it("cache_read es ~10x más barato que input fresh (Haiku)", () => {
        const fresh = calculateCostCents("claude-haiku-4-5-20251001", {
            input_tokens: 1_000_000,
            output_tokens: 0,
        })
        const cached = calculateCostCents("claude-haiku-4-5-20251001", {
            input_tokens: 0,
            output_tokens: 0,
            cache_read_input_tokens: 1_000_000,
        })
        // input: 100 cents, cache_read: 10 cents (ratio 10:1)
        expect(fresh).toBe(100)
        expect(cached).toBe(10)
    })

    it("redondea hacia arriba (no subfactura)", () => {
        // 1 input token Haiku = $0.000001 = 0.0001 cents → ceil → 1 cent
        const cost = calculateCostCents("claude-haiku-4-5-20251001", {
            input_tokens: 1,
            output_tokens: 0,
        })
        expect(cost).toBe(1)
    })

    it("acepta cache_creation_input_tokens y cache_read_input_tokens null o undefined", () => {
        const a = calculateCostCents("claude-haiku-4-5-20251001", {
            input_tokens: 100_000,
            output_tokens: 0,
            cache_creation_input_tokens: null,
            cache_read_input_tokens: null,
        })
        const b = calculateCostCents("claude-haiku-4-5-20251001", {
            input_tokens: 100_000,
            output_tokens: 0,
        })
        expect(a).toBe(b)
    })
})
