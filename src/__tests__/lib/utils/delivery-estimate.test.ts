/**
 * Tests de la promesa de entrega configurable (getDeliveryEstimate +
 * formatDeliveryEstimateEs). Fix "revisemos la casa": antes el chat inventaba
 * "N a N+2 días hábiles" con default forzado de 3, y no existía "hoy mismo".
 */

import { describe, it, expect } from "vitest"
import { getDeliveryEstimate, formatDeliveryEstimateEs } from "@/lib/utils/shipping"

describe("getDeliveryEstimate", () => {
    it("sin configuración → null (no se inventa promesa)", () => {
        expect(getDeliveryEstimate(null)).toBeNull()
        expect(getDeliveryEstimate(undefined)).toBeNull()
        expect(getDeliveryEstimate({ estimated_delivery_days: null })).toBeNull()
        expect(getDeliveryEstimate({})).toBeNull()
    })

    it("0 días → entrega hoy mismo", () => {
        expect(getDeliveryEstimate({ estimated_delivery_days: 0 })).toEqual({
            kind: "today", minDays: 0, maxDays: 0,
        })
    })

    it("min sin max → valor único", () => {
        expect(getDeliveryEstimate({ estimated_delivery_days: 3 })).toEqual({
            kind: "single", minDays: 3, maxDays: 3,
        })
    })

    it("min + max → rango", () => {
        expect(getDeliveryEstimate({ estimated_delivery_days: 2, estimated_delivery_days_max: 4 })).toEqual({
            kind: "range", minDays: 2, maxDays: 4,
        })
    })

    it("min 0 + max → rango desde hoy", () => {
        expect(getDeliveryEstimate({ estimated_delivery_days: 0, estimated_delivery_days_max: 2 })).toEqual({
            kind: "range", minDays: 0, maxDays: 2,
        })
    })

    it("max < min → se normaliza a min (sin rango invertido)", () => {
        expect(getDeliveryEstimate({ estimated_delivery_days: 5, estimated_delivery_days_max: 2 })).toEqual({
            kind: "single", minDays: 5, maxDays: 5,
        })
    })

    it("negativos → clamp a 0 (hoy mismo)", () => {
        expect(getDeliveryEstimate({ estimated_delivery_days: -1 })).toEqual({
            kind: "today", minDays: 0, maxDays: 0,
        })
    })
})

describe("formatDeliveryEstimateEs", () => {
    it("null → null (el caller decide el fallback)", () => {
        expect(formatDeliveryEstimateEs(null)).toBeNull()
    })

    it("hoy mismo / singular / plural / rangos", () => {
        expect(formatDeliveryEstimateEs(getDeliveryEstimate({ estimated_delivery_days: 0 }))).toBe("hoy mismo")
        expect(formatDeliveryEstimateEs(getDeliveryEstimate({ estimated_delivery_days: 1 }))).toBe("1 día hábil")
        expect(formatDeliveryEstimateEs(getDeliveryEstimate({ estimated_delivery_days: 3 }))).toBe("3 días hábiles")
        expect(formatDeliveryEstimateEs(getDeliveryEstimate({ estimated_delivery_days: 2, estimated_delivery_days_max: 4 }))).toBe("2 a 4 días hábiles")
        expect(formatDeliveryEstimateEs(getDeliveryEstimate({ estimated_delivery_days: 0, estimated_delivery_days_max: 2 }))).toBe("entre hoy y 2 días hábiles")
    })
})
