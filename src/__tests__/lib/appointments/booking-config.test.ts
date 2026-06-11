/**
 * Tests de resolveBookingHours (Fase 2 booking): horario de atención
 * configurable por tenant con default seguro 9-18 / domingos cerrados.
 */

import { describe, expect, it } from "vitest"
import { resolveBookingHours, DEFAULT_BOOKING_HOURS } from "@/lib/appointments/booking-config"

describe("resolveBookingHours", () => {
    it("sin settings → default histórico (9-18, domingos cerrados)", () => {
        expect(resolveBookingHours(null)).toEqual(DEFAULT_BOOKING_HOURS)
        expect(resolveBookingHours({})).toEqual(DEFAULT_BOOKING_HOURS)
        expect(resolveBookingHours({ booking: {} })).toEqual(DEFAULT_BOOKING_HOURS)
    })

    it("lee la config del tenant", () => {
        expect(resolveBookingHours({ booking: { day_start_hour: 7, day_end_hour: 20, skip_sundays: false } }))
            .toEqual({ dayStartHour: 7, dayEndHour: 20, skipSundays: false })
    })

    it("clampa valores fuera de rango al default", () => {
        expect(resolveBookingHours({ booking: { day_start_hour: -3, day_end_hour: 30 } }))
            .toEqual(DEFAULT_BOOKING_HOURS)
        expect(resolveBookingHours({ booking: { day_start_hour: "nueve" } }).dayStartHour).toBe(9)
    })

    it("cierre antes de apertura → default completo (config incoherente)", () => {
        expect(resolveBookingHours({ booking: { day_start_hour: 18, day_end_hour: 9 } }))
            .toEqual(DEFAULT_BOOKING_HOURS)
    })

    it("skip_sundays solo se apaga con false literal", () => {
        expect(resolveBookingHours({ booking: { skip_sundays: "no" } }).skipSundays).toBe(true)
        expect(resolveBookingHours({ booking: { skip_sundays: false } }).skipSundays).toBe(false)
    })
})
