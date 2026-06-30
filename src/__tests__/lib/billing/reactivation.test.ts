/**
 * Monto de reactivación: meses que debe = meses calendario impagos contando el
 * mes en curso, EN zona Colombia (no UTC). current_period_end ≈ inicio del primer
 * mes que se debe (pago + 1 mes). Sube +1 al cruzar cada borde de mes colombiano.
 */

import { describe, it, expect } from "vitest"
import { computeMonthsOwed } from "@/lib/billing/reactivation"

// "Pagado en mayo" → periodo termina ~1 junio (00:00 Colombia = 05:00 UTC).
const PERIOD_END = "2026-06-01T05:00:00Z"

describe("computeMonthsOwed", () => {
    it("en junio (mes del periodo) debe 1", () => {
        expect(computeMonthsOwed(PERIOD_END, new Date("2026-06-15T17:00:00Z"))).toBe(1)
    })

    it("al cerrar junio (1 julio 00:30 Colombia) debe 2", () => {
        expect(computeMonthsOwed(PERIOD_END, new Date("2026-07-01T05:30:00Z"))).toBe(2)
    })

    it("BORDE TZ: 30 junio 23:00 Colombia (= 1 julio 04:00 UTC) sigue siendo junio → 1", () => {
        // En UTC esto es julio; en Colombia aún es 30 de junio. Debe dar 1, no 2.
        expect(computeMonthsOwed(PERIOD_END, new Date("2026-07-01T04:00:00Z"))).toBe(1)
    })

    it("dos meses después (agosto) debe 3", () => {
        expect(computeMonthsOwed(PERIOD_END, new Date("2026-08-10T17:00:00Z"))).toBe(3)
    })

    it("sin periodo → 1", () => {
        expect(computeMonthsOwed(null, new Date("2026-07-01T05:00:00Z"))).toBe(1)
    })

    it("periodo en el futuro (pagado adelantado) → mínimo 1", () => {
        expect(computeMonthsOwed("2026-09-01T05:00:00Z", new Date("2026-07-01T05:00:00Z"))).toBe(1)
    })
})
