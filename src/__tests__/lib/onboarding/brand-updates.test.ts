import { describe, it, expect } from "vitest"
import { buildBrandUpdates } from "@/lib/onboarding/brand-updates"

describe("buildBrandUpdates", () => {
    it("aplica color hex válido y lo mergea en settings.branding sin pisar otras llaves", () => {
        expect(buildBrandUpdates({ primaryColor: "#ff6b35" }, { settings: { branding: { logoUrl: "x" } } }))
            .toEqual({ primary_color: "#ff6b35", settings: { branding: { logoUrl: "x", primaryColor: "#ff6b35" } } })
    })

    it("ignora color inválido (no hex)", () => {
        expect(buildBrandUpdates({ primaryColor: "rojo" }, {})).toBeNull()
        expect(buildBrandUpdates({ primaryColor: "#fff" }, {})).toBeNull()
    })

    it("aplica moneda soportada, ignora no soportada", () => {
        expect(buildBrandUpdates({ currency: "COP" }, {})).toEqual({ currency_code: "COP" })
        expect(buildBrandUpdates({ currency: "EUR" }, {})).toBeNull()
    })

    it("color + moneda juntos", () => {
        expect(buildBrandUpdates({ primaryColor: "#000000", currency: "USD" }, {}))
            .toEqual({ primary_color: "#000000", settings: { branding: { primaryColor: "#000000" } }, currency_code: "USD" })
    })

    it("sin datos válidos → null (no escribe nada)", () => {
        expect(buildBrandUpdates({}, {})).toBeNull()
        expect(buildBrandUpdates({ primaryColor: null, currency: null }, {})).toBeNull()
    })
})
