/**
 * Tests del skill service_booking (booking de servicios en ecommerce).
 *
 * Caso real (Tantor's House, 2026-06-11): vende productos Y agenda estadías/
 * meet&greets, pero el skill de agendamiento era exclusivo de inmobiliaria —
 * el agente improvisaba citas de palabra sin agendar. El skill nuevo se
 * activa SOLO si la org tiene el módulo `appointments` (opt-in por tenant:
 * los ecommerce puros como Tez no ofrecen citas sin sentido).
 */

import { describe, expect, it } from "vitest"
import { getSkillsForMode, composeSkillsPrompt } from "@/lib/ai/skills"
import { getModePromptAddendum } from "@/lib/ai/agent-factory"

describe("getSkillsForMode — service_booking gated por módulo", () => {
    it("ecommerce CON módulo appointments → incluye service_booking", () => {
        const skills = getSkillsForMode("ecommerce", ["conversations", "products", "appointments"])
        expect(skills.map((skill) => skill.id)).toContain("service_booking")
    })

    it("ecommerce SIN módulo appointments → NO incluye service_booking (Tez intacto)", () => {
        const skills = getSkillsForMode("ecommerce", ["conversations", "products", "orders"])
        expect(skills.map((skill) => skill.id)).not.toContain("service_booking")
    })

    it("ecommerce con enabled_modules null → NO incluye service_booking", () => {
        const skills = getSkillsForMode("ecommerce", null)
        expect(skills.map((skill) => skill.id)).not.toContain("service_booking")
    })

    it("real_estate conserva su skill appointment_booking sin requerir módulo", () => {
        const skills = getSkillsForMode("real_estate", null)
        expect(skills.map((skill) => skill.id)).toContain("appointment_booking")
        expect(skills.map((skill) => skill.id)).not.toContain("service_booking")
    })
})

describe("composeSkillsPrompt — instrucciones del booking", () => {
    it("con módulo activo, el prompt instruye check_availability antes de agendar", () => {
        const prompt = composeSkillsPrompt("ecommerce", null, ["appointments"])
        expect(prompt).toContain("RESERVAS DE SERVICIOS")
        expect(prompt).toContain("check_availability")
        expect(prompt).toContain("schedule_appointment")
    })

    it("el agente puede deshabilitar el skill vía configuración", () => {
        const prompt = composeSkillsPrompt(
            "ecommerce",
            { service_booking: { enabled: false } },
            ["appointments"]
        )
        expect(prompt).not.toContain("RESERVAS DE SERVICIOS")
    })
})

describe("getModePromptAddendum — fecha actual para booking", () => {
    it("ecommerce con módulo appointments inyecta la fecha actual (resolver 'mañana')", () => {
        const addendum = getModePromptAddendum("ecommerce", 0, null, "es-CO", ["appointments"])
        expect(addendum).toContain("FECHA Y HORA ACTUAL")
        expect(addendum).not.toContain("MODO INMOBILIARIO")
    })

    it("ecommerce sin módulo NO inyecta fecha ni booking", () => {
        const addendum = getModePromptAddendum("ecommerce", 0, null, "es-CO", null)
        expect(addendum).not.toContain("FECHA Y HORA ACTUAL")
        expect(addendum).not.toContain("RESERVAS DE SERVICIOS")
    })

    it("tenant en-US recibe la fecha en inglés", () => {
        const addendum = getModePromptAddendum("ecommerce", 0, null, "en-US", ["appointments"])
        expect(addendum).toContain("CURRENT DATE AND TIME")
    })

    it("modo inmobiliario intacto (regresión)", () => {
        const addendum = getModePromptAddendum("real_estate", 12, null, "es-CO", null)
        expect(addendum).toContain("MODO INMOBILIARIO")
        expect(addendum).toContain("12 propiedades")
        expect(addendum).toContain("PARA AGENDAR CITAS")
    })
})
