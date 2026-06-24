import { describe, it, expect } from "vitest"
import { computeCommissionAmount } from "@/lib/affiliates/commissions"

describe("computeCommissionAmount", () => {
    it("calcula el % del monto base", () => {
        expect(computeCommissionAmount(100000, 20)).toBe(20000)
        expect(computeCommissionAmount(50000, 15)).toBe(7500)
        expect(computeCommissionAmount(120000, 25)).toBe(30000)
    })

    it("redondea a centavos", () => {
        // 29.99 * 20% = 5.998 → 6.00
        expect(computeCommissionAmount(29.99, 20)).toBe(6)
        // 33.33 * 10% = 3.333 → 3.33
        expect(computeCommissionAmount(33.33, 10)).toBe(3.33)
    })

    it("devuelve 0 ante valores inválidos", () => {
        expect(computeCommissionAmount(0, 20)).toBe(0)
        expect(computeCommissionAmount(100, 0)).toBe(0)
        expect(computeCommissionAmount(-100, 20)).toBe(0)
        expect(computeCommissionAmount(100, -5)).toBe(0)
        expect(computeCommissionAmount(Number.NaN, 20)).toBe(0)
        expect(computeCommissionAmount(100, Number.NaN)).toBe(0)
    })
})
