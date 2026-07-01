import { describe, it, expect } from "vitest"
import { ATLAS_SKILLS, isAtlasSkillEnabled } from "@/lib/copilot/atlas-skills"

describe("ATLAS_SKILLS", () => {
    it("solo 'growth' está activa hoy; el resto es coming_soon", () => {
        const active = ATLAS_SKILLS.filter((s) => s.status === "active").map((s) => s.id)
        expect(active).toEqual(["growth"])
        const soon = ATLAS_SKILLS.filter((s) => s.status === "coming_soon").map((s) => s.id).sort()
        expect(soon).toEqual(["aeo", "creative", "paid_social"])
    })
})

describe("isAtlasSkillEnabled", () => {
    it("growth: ON por defecto (config vacía o nula)", () => {
        expect(isAtlasSkillEnabled("growth", {})).toBe(true)
        expect(isAtlasSkillEnabled("growth", null)).toBe(true)
        expect(isAtlasSkillEnabled("growth", undefined)).toBe(true)
    })

    it("growth: OFF solo si enabled === false explícito", () => {
        expect(isAtlasSkillEnabled("growth", { growth: { enabled: false } })).toBe(false)
        expect(isAtlasSkillEnabled("growth", { growth: { enabled: true } })).toBe(true)
    })

    it("coming_soon: NUNCA activo, aunque la config diga enabled:true", () => {
        expect(isAtlasSkillEnabled("paid_social", { paid_social: { enabled: true } })).toBe(false)
        expect(isAtlasSkillEnabled("creative", { creative: { enabled: true } })).toBe(false)
        expect(isAtlasSkillEnabled("aeo", {})).toBe(false)
    })
})
