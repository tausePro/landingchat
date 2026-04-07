import { describe, expect, it } from "vitest"
import {
    addDaysToAppointmentDateKey,
    createAppointmentDate,
    formatAppointmentDateTime,
    getAppointmentDateKey,
    getAppointmentMinutesOfDay,
    getAppointmentWeekday,
} from "@/lib/appointments/appointmentDateTime"

describe("appointmentDateTime", () => {
    it("convierte una hora local de Bogota a la fecha UTC correcta", () => {
        const date = createAppointmentDate("2026-04-06", 8, 0)

        expect(date.toISOString()).toBe("2026-04-06T13:00:00.000Z")
    })

    it("formatea horas en la timezone de appointments", () => {
        expect(
            formatAppointmentDateTime("2026-04-06T13:00:00.000Z", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
            }),
        ).toBe("08:00")
    })

    it("obtiene el date key local correcto al cruzar medianoche UTC", () => {
        expect(getAppointmentDateKey("2026-04-06T04:30:00.000Z")).toBe("2026-04-05")
    })

    it("suma días sobre el calendario local de appointments", () => {
        expect(addDaysToAppointmentDateKey("2026-04-06", 7)).toBe("2026-04-13")
    })

    it("calcula minutos del día en horario local de appointments", () => {
        expect(getAppointmentMinutesOfDay("2026-04-06T13:45:00.000Z")).toBe(8 * 60 + 45)
    })

    it("calcula el weekday correcto para el calendario local", () => {
        expect(getAppointmentWeekday("2026-04-06")).toBe(1)
    })
})
