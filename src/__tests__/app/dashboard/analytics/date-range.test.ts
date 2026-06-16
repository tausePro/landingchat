import { describe, expect, it } from "vitest"
import { resolveDateRange } from "@/app/dashboard/analytics/date-range"

const DAY = 86_400_000

describe("resolveDateRange", () => {
    it("default = 30 días cuando no hay params", () => {
        const r = resolveDateRange({})
        expect(r.rangeKey).toBe("30d")
        expect(r.days).toBe(30)
        expect(Math.round((r.endDate.getTime() - r.startDate.getTime()) / DAY)).toBe(30)
    })

    it("preset 7d con su label", () => {
        const r = resolveDateRange({ range: "7d" })
        expect(r.rangeKey).toBe("7d")
        expect(r.days).toBe(7)
        expect(r.label).toBe("últimos 7 días")
    })

    it("período anterior es la ventana inmediatamente previa de igual duración", () => {
        const r = resolveDateRange({ range: "30d" })
        expect(r.prevEndDate.getTime()).toBe(r.startDate.getTime())
        const windowMs = r.endDate.getTime() - r.startDate.getTime()
        expect(r.prevStartDate.getTime()).toBe(r.startDate.getTime() - windowMs)
    })

    it("rango personalizado válido (from/to)", () => {
        const r = resolveDateRange({ from: "2026-01-01", to: "2026-01-31" })
        expect(r.rangeKey).toBe("custom")
        expect(r.startDate.getFullYear()).toBe(2026)
        expect(r.startDate.getMonth()).toBe(0)
        expect(r.startDate.getDate()).toBe(1)
        // Enero (1→31) = 31 días de calendario inclusivos
        expect(r.days).toBe(31)
        // El período previo arranca exactamente donde empieza el actual
        expect(r.prevEndDate.getTime()).toBe(r.startDate.getTime())
    })

    it("rango inválido (from > to) cae al default 30d", () => {
        const r = resolveDateRange({ from: "2026-02-01", to: "2026-01-01" })
        expect(r.rangeKey).toBe("30d")
    })

    it("range desconocido cae al default 30d", () => {
        const r = resolveDateRange({ range: "999d" })
        expect(r.rangeKey).toBe("30d")
    })
})
