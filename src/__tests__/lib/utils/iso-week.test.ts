/**
 * Tests de computeIsoWeek — clave de idempotencia del cron semanal.
 * Edge cases de borde de año según ISO 8601.
 */

import { describe, expect, it } from "vitest"
import { computeIsoWeek } from "@/lib/utils/iso-week"

describe("computeIsoWeek", () => {
    it("semana normal de mitad de año", () => {
        expect(computeIsoWeek(new Date("2026-06-10T12:00:00Z"))).toBe("2026-W24")
    })

    it("dos fechas de la misma semana ISO dan la misma clave (lunes vs domingo)", () => {
        expect(computeIsoWeek(new Date("2026-06-08T00:00:00Z")))
            .toBe(computeIsoWeek(new Date("2026-06-14T23:59:59Z")))
    })

    it("1 de enero que pertenece a la última semana del año anterior", () => {
        // 2027-01-01 es viernes → pertenece a la W53 de 2026 (ISO year 2026)
        expect(computeIsoWeek(new Date("2027-01-01T12:00:00Z"))).toBe("2026-W53")
    })

    it("fin de diciembre que pertenece a la W1 del año siguiente", () => {
        // 2024-12-30 es lunes → pertenece a la W1 de 2025
        expect(computeIsoWeek(new Date("2024-12-30T12:00:00Z"))).toBe("2025-W01")
    })

    it("padding de semanas de un dígito", () => {
        expect(computeIsoWeek(new Date("2026-01-07T12:00:00Z"))).toBe("2026-W02")
    })
})
