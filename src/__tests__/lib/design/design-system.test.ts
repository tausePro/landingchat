import { describe, it, expect } from "vitest"
import {
    buildDesignSystem,
    designSystemToOrgSettings,
    designSystemSchema,
} from "@/lib/design/design-system"

describe("buildDesignSystem", () => {
    it("usa el color extraído + defaults (vibe minimal, template premium)", () => {
        const ds = buildDesignSystem({ primaryColor: "#ff6b35" })
        expect(ds.palette.primary).toBe("#ff6b35")
        expect(ds.vibe).toBe("minimal")
        expect(ds.typography).toEqual({ fontFamily: "Inter", textColor: "modern" })
        expect(ds.template).toBe("premium")
        expect(designSystemSchema.safeParse(ds).success).toBe(true)
    })

    it("cae a fallback de color si el extraído es inválido o falta", () => {
        expect(buildDesignSystem({ primaryColor: "rojo" }).palette.primary).toBe("#0F172A")
        expect(buildDesignSystem({}).palette.primary).toBe("#0F172A")
    })

    it("aplica tipografía según vibe", () => {
        expect(buildDesignSystem({ vibe: "editorial" }).typography).toEqual({ fontFamily: "Playfair Display", textColor: "elegant" })
        expect(buildDesignSystem({ vibe: "tech" }).typography).toEqual({ fontFamily: "Roboto", textColor: "cool" })
    })

    it("real_estate fuerza su plantilla; template no permitido cae a premium", () => {
        expect(buildDesignSystem({ industry: "real_estate" }).template).toBe("real-estate")
        expect(buildDesignSystem({ template: "complete" }).template).toBe("complete")
        expect(buildDesignSystem({ template: "real-estate", industry: "ecommerce" }).template).toBe("premium")
    })

    it("incluye secondary solo si es hex válido", () => {
        expect(buildDesignSystem({ primaryColor: "#000000", secondaryColor: "#ffffff" }).palette.secondary).toBe("#ffffff")
        expect(buildDesignSystem({ primaryColor: "#000000", secondaryColor: "x" }).palette.secondary).toBeUndefined()
    })
})

describe("designSystemToOrgSettings", () => {
    it("mapea a la config concreta + merge sin pisar otras llaves", () => {
        const ds = buildDesignSystem({ primaryColor: "#ff6b35", vibe: "editorial" })
        const out = designSystemToOrgSettings(ds, {
            branding: { logoUrl: "x" },
            storefront: { hero: { title: "Hi" } },
            other: 1,
        })
        expect(out.primary_color).toBe("#ff6b35")
        expect(out.settings).toMatchObject({
            other: 1,
            branding: { logoUrl: "x", primaryColor: "#ff6b35" },
            storefront: {
                hero: { title: "Hi" },
                template: "premium",
                typography: { fontFamily: "Playfair Display", textColor: "elegant" },
            },
        })
    })

    it("sin settings previos arma la estructura desde cero", () => {
        const ds = buildDesignSystem({ primaryColor: "#123456" })
        const out = designSystemToOrgSettings(ds)
        expect(out.primary_color).toBe("#123456")
        expect((out.settings.branding as Record<string, unknown>).primaryColor).toBe("#123456")
        expect((out.settings.storefront as Record<string, unknown>).template).toBe("premium")
    })
})
