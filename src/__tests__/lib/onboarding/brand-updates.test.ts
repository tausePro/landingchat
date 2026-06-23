import { describe, it, expect } from "vitest"
import { buildOnboardingOrgUpdates } from "@/lib/onboarding/brand-updates"

type Settings = {
    branding: { primaryColor?: string; logoUrl?: string }
    storefront: { template: string; typography: { fontFamily: string; textColor: string } }
    [key: string]: unknown
}

describe("buildOnboardingOrgUpdates", () => {
    it("genera color + template premium + typography desde la marca extraída", () => {
        const u = buildOnboardingOrgUpdates({ primaryColor: "#ff6b35" }, { settings: null, industry: null })
        expect(u.primary_color).toBe("#ff6b35")
        const s = u.settings as Settings
        expect(s.branding.primaryColor).toBe("#ff6b35")
        expect(s.storefront.template).toBe("premium")
        expect(s.storefront.typography.fontFamily).toBe("Inter")
    })

    it("color inválido → fallback, mantiene template premium", () => {
        const u = buildOnboardingOrgUpdates({ primaryColor: "rojo" }, {})
        expect(u.primary_color).toBe("#0F172A")
        expect((u.settings as Settings).storefront.template).toBe("premium")
    })

    it("moneda soportada se persiste; no soportada se ignora", () => {
        expect(buildOnboardingOrgUpdates({ currency: "COP" }, {}).currency_code).toBe("COP")
        expect(buildOnboardingOrgUpdates({ currency: "EUR" }, {}).currency_code).toBeUndefined()
    })

    it("real_estate fuerza su plantilla en vez de premium", () => {
        const u = buildOnboardingOrgUpdates({}, { industry: "real_estate" })
        expect((u.settings as Settings).storefront.template).toBe("real-estate")
    })

    it("merge: no pisa otras llaves de settings/branding", () => {
        const u = buildOnboardingOrgUpdates({ primaryColor: "#000000" }, { settings: { branding: { logoUrl: "x" }, foo: 1 } })
        const s = u.settings as Settings
        expect(s.foo).toBe(1)
        expect(s.branding.logoUrl).toBe("x")
        expect(s.branding.primaryColor).toBe("#000000")
    })
})
