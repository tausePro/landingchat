/**
 * Tests focales de la funcion isAiPausedBySchedule.
 *
 * Contexto: bug v1.12.3- en el que la logica del backend hacia lo OPUESTO
 * a lo que la UI prometia al usuario en el editor de horarios del agente:
 *   - UI: "dias configurados = la IA esta PAUSADA (atiendes tu), el resto
 *     del tiempo la IA responde 24/7".
 *   - Backend (bug): "dias configurados = la IA SOLO responde ahi, el
 *     resto del tiempo silencio total".
 *
 * Incidente Casa Inmobiliaria 2026-05-14: agente con thu=null bloqueaba
 * toda respuesta IA los jueves, viernes, miercoles y domingos (los dias
 * "sin horario humano" en realidad deberian ser cuando la IA cubre 24/7).
 *
 * Estos tests fijan la semantica correcta:
 *   - dia null/undefined -> IA NO pausada (responde 24/7).
 *   - dia con horario, hora DENTRO del rango -> IA pausada.
 *   - dia con horario, hora FUERA del rango -> IA NO pausada.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { isAiPausedBySchedule } from "@/lib/messaging/unified"

// Schedule real de Casa Inmob, capturado de la BD el dia del incidente.
// Lunes y martes 18-22h, sabado 13-18h, demas dias null.
const CASA_INMOB_SCHEDULE = {
    mon: { from: "18:00", to: "22:00" },
    tue: { from: "18:00", to: "22:00" },
    wed: null,
    thu: null,
    fri: null,
    sat: { from: "13:00", to: "18:00" },
    sun: null,
}

const BOGOTA = "America/Bogota"

describe("isAiPausedBySchedule", () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    describe("dia inactivo (null) -> IA responde 24/7", () => {
        it("jueves 11:00 Bogota con thu=null -> IA NO pausada (responde)", () => {
            // 2026-05-14 11:00 Bogota = 16:00 UTC. getDay()==4 (jueves).
            vi.setSystemTime(new Date("2026-05-14T16:00:00Z"))

            expect(isAiPausedBySchedule(CASA_INMOB_SCHEDULE, BOGOTA)).toBe(false)
        })

        it("miercoles 03:00 Bogota con wed=null -> IA NO pausada", () => {
            // 2026-05-13 03:00 Bogota = 08:00 UTC
            vi.setSystemTime(new Date("2026-05-13T08:00:00Z"))

            expect(isAiPausedBySchedule(CASA_INMOB_SCHEDULE, BOGOTA)).toBe(false)
        })

        it("domingo 22:00 Bogota con sun=null -> IA NO pausada", () => {
            // 2026-05-17 22:00 Bogota = 03:00 UTC del 18 (lunes UTC pero domingo en Bogota)
            vi.setSystemTime(new Date("2026-05-18T03:00:00Z"))

            expect(isAiPausedBySchedule(CASA_INMOB_SCHEDULE, BOGOTA)).toBe(false)
        })

        it("schedule completamente vacio {} -> IA NO pausada cualquier dia", () => {
            vi.setSystemTime(new Date("2026-05-14T16:00:00Z"))

            expect(isAiPausedBySchedule({}, BOGOTA)).toBe(false)
        })
    })

    describe("dia activo -> IA pausada DENTRO del rango, responde FUERA", () => {
        it("lunes 19:00 Bogota con mon=18:00-22:00 -> IA pausada (dentro del rango humano)", () => {
            // 2026-05-11 19:00 Bogota = 00:00 UTC del 12 (martes UTC pero lunes Bogota)
            vi.setSystemTime(new Date("2026-05-12T00:00:00Z"))

            expect(isAiPausedBySchedule(CASA_INMOB_SCHEDULE, BOGOTA)).toBe(true)
        })

        it("lunes 17:00 Bogota con mon=18:00-22:00 -> IA NO pausada (antes del rango)", () => {
            // 2026-05-11 17:00 Bogota = 22:00 UTC del 11
            vi.setSystemTime(new Date("2026-05-11T22:00:00Z"))

            expect(isAiPausedBySchedule(CASA_INMOB_SCHEDULE, BOGOTA)).toBe(false)
        })

        it("lunes 23:00 Bogota con mon=18:00-22:00 -> IA NO pausada (despues del rango)", () => {
            // 2026-05-11 23:00 Bogota = 04:00 UTC del 12
            vi.setSystemTime(new Date("2026-05-12T04:00:00Z"))

            expect(isAiPausedBySchedule(CASA_INMOB_SCHEDULE, BOGOTA)).toBe(false)
        })

        it("sabado 14:30 Bogota con sat=13:00-18:00 -> IA pausada", () => {
            // 2026-05-16 14:30 Bogota = 19:30 UTC
            vi.setSystemTime(new Date("2026-05-16T19:30:00Z"))

            expect(isAiPausedBySchedule(CASA_INMOB_SCHEDULE, BOGOTA)).toBe(true)
        })
    })

    describe("bordes exactos del rango", () => {
        const SIMPLE_SCHEDULE = { mon: { from: "09:00", to: "17:00" } }

        it("hora exactamente igual a 'from' -> IA pausada (rango incluye inicio)", () => {
            // 2026-05-11 09:00 Bogota = 14:00 UTC
            vi.setSystemTime(new Date("2026-05-11T14:00:00Z"))

            expect(isAiPausedBySchedule(SIMPLE_SCHEDULE, BOGOTA)).toBe(true)
        })

        it("hora exactamente igual a 'to' -> IA NO pausada (rango excluye fin)", () => {
            // 2026-05-11 17:00 Bogota = 22:00 UTC
            vi.setSystemTime(new Date("2026-05-11T22:00:00Z"))

            expect(isAiPausedBySchedule(SIMPLE_SCHEDULE, BOGOTA)).toBe(false)
        })

        it("hora un minuto antes de 'to' -> IA pausada", () => {
            // 2026-05-11 16:59 Bogota = 21:59 UTC
            vi.setSystemTime(new Date("2026-05-11T21:59:00Z"))

            expect(isAiPausedBySchedule(SIMPLE_SCHEDULE, BOGOTA)).toBe(true)
        })
    })

    describe("zonas horarias multiples", () => {
        it("respeta la timezone del schedule (Mexico vs Bogota difieren 1h)", () => {
            const schedule = { mon: { from: "09:00", to: "10:00" } }

            // 2026-05-11 14:30 UTC = 09:30 Bogota (UTC-5) = 08:30 Mexico City (UTC-6)
            vi.setSystemTime(new Date("2026-05-11T14:30:00Z"))

            // En Bogota cae DENTRO del rango 09-10
            expect(isAiPausedBySchedule(schedule, BOGOTA)).toBe(true)
            // En Mexico es 08:30, FUERA del rango 09-10
            expect(isAiPausedBySchedule(schedule, "America/Mexico_City")).toBe(false)
        })
    })

    describe("fail-open ante errores", () => {
        it("timezone invalida -> IA NO pausada (fail-open)", () => {
            vi.setSystemTime(new Date("2026-05-14T16:00:00Z"))

            expect(isAiPausedBySchedule(CASA_INMOB_SCHEDULE, "Invalid/Timezone")).toBe(false)
        })

        // Nota: un schedule malformado donde daySchedule.from/to son undefined
        // se evalua como `currentTime >= undefined && currentTime < undefined`,
        // ambas comparaciones devuelven false (no es error). Documentado en JSDoc.
    })

    describe("regresion del incidente Casa Inmob 2026-05-14", () => {
        it("schedule completo con jueves null en horario laboral -> IA responde", () => {
            // Reproduce el caso exacto que motivo el fix.
            vi.setSystemTime(new Date("2026-05-14T16:33:00Z")) // 11:33 jueves Bogota

            expect(isAiPausedBySchedule(CASA_INMOB_SCHEDULE, BOGOTA)).toBe(false)
        })
    })
})
