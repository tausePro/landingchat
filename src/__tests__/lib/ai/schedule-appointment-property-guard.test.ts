/**
 * Regresión del reporte de casainmobiliaria (2026-06-12): visitas llegaban
 * al calendario SIN propiedad ("Visita a propiedad" genérica) y el asesor
 * no sabía a dónde ir. El executor ahora rebota visitas sin property_code
 * en orgs con propiedades; el booking de servicios (Tantor) no se afecta.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

const mockCreateAppointment = vi.fn()
let propertyCount: number

vi.mock("@/lib/appointments/service", () => ({
    createManagedAppointment: (...args: unknown[]) => mockCreateAppointment(...args),
    getAppointmentAvailability: vi.fn(),
}))

vi.mock("@/lib/appointments/appointmentDateTime", async (importOriginal) => {
    return await importOriginal()
})

import { sharedToolHandlers } from "@/lib/ai/executors/shared"
import type { ToolContext, ToolSupabaseClient } from "@/lib/ai/executors/types"

function buildSupabase(): ToolSupabaseClient {
    return {
        from: (table: string) => {
            const chain: Record<string, unknown> = {}
            chain.select = vi.fn(() => chain)
            chain.eq = vi.fn(() => chain)
            chain.then = (resolve: (value: unknown) => void) =>
                resolve({ count: table === "properties" ? propertyCount : 0, data: [], error: null })
            return chain
        },
    } as unknown as ToolSupabaseClient
}

const context: ToolContext = { chatId: "chat-1", organizationId: "org-1" }
const scheduleAppointment = sharedToolHandlers.schedule_appointment

const BASE_INPUT = {
    title: "Visita a propiedad",
    proposed_date: "2026-06-15T10:00:00",
    customer_name: "Yeidy",
    customer_phone: "3102170677",
}

beforeEach(() => {
    vi.clearAllMocks()
    propertyCount = 12
    mockCreateAppointment.mockResolvedValue({
        success: true,
        appointment: { id: "a1", title: "Visita", proposed_date: "2026-06-15T10:00:00" },
        assignedAdvisor: null,
        calendarSynced: false,
    })
})

describe("scheduleAppointment — guard de propiedad en inmobiliarias", () => {
    it("visita SIN property_code en org con propiedades → rebotada con instrucción", async () => {
        const result = await scheduleAppointment(buildSupabase(), BASE_INPUT, context)

        expect(result.success).toBe(false)
        expect(result.error).toContain("código de la propiedad")
        expect(result.error).toContain("pregunta al cliente")
        expect(mockCreateAppointment).not.toHaveBeenCalled()
    })

    it("visita CON property_code → agenda normal", async () => {
        const result = await scheduleAppointment(
            buildSupabase(),
            { ...BASE_INPUT, property_code: "ARR-137", title: "Visita propiedad ARR-137" },
            context
        )

        expect(result.success).toBe(true)
        expect(mockCreateAppointment).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ propertyCode: "ARR-137" })
        )
    })

    it("org SIN propiedades (booking de servicios, ej. Tantor) → sin guard", async () => {
        propertyCount = 0

        const result = await scheduleAppointment(
            buildSupabase(),
            { ...BASE_INPUT, title: "Meet & Greet" },
            context
        )

        expect(result.success).toBe(true)
        expect(mockCreateAppointment).toHaveBeenCalled()
    })

    it("consultas/llamadas no requieren propiedad ni en inmobiliarias", async () => {
        const result = await scheduleAppointment(
            buildSupabase(),
            { ...BASE_INPUT, appointment_type: "consultation", title: "Consulta de arriendo" },
            context
        )

        expect(result.success).toBe(true)
    })
})
