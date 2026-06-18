import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { PriceTiersEditor } from "@/app/dashboard/products/components/price-tiers-editor"
import type { PriceTier } from "@/types/product"

/**
 * i18n ficha de productos: el editor debe formatear los precios en la moneda
 * del tenant (no COP hardcodeado). Tantor's House opera en USD/en-US; el resto
 * en COP/es-CO. Antes el preview siempre mostraba COP.
 */
const tiers: PriceTier[] = [
    { min_quantity: 1, max_quantity: undefined, unit_price: 1000, label: "" },
]

describe("PriceTiersEditor formatea precios por moneda del tenant", () => {
    it("usa COP por defecto (sin tenantLocale): separador de miles '.'", () => {
        const html = renderToStaticMarkup(
            <PriceTiersEditor tiers={tiers} onChange={() => {}} />,
        )
        expect(html).toContain("1.000")
        expect(html).not.toContain("1,000.00")
    })

    it("usa USD cuando el tenant es USD/en-US: 2 decimales '1,000.00'", () => {
        const html = renderToStaticMarkup(
            <PriceTiersEditor
                tiers={tiers}
                onChange={() => {}}
                tenantLocale={{ currency: "USD", locale: "en-US", country: "US" }}
            />,
        )
        expect(html).toContain("1,000.00")
    })
})
