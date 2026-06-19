import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { TopProductsCard } from "@/app/dashboard/analytics/components/top-products-card"
import { TenantLocaleProvider } from "@/lib/i18n/use-tenant-strings"

/**
 * i18n analytics: las cards de ingresos formatean en la moneda del tenant
 * leyendo el TenantLocaleProvider que monta analytics/page (server). Antes
 * estaban hardcodeadas en COP.
 */
const topProducts = [
    { productId: "p1", productName: "Producto", totalRevenue: 1000, totalUnits: 5 },
]

describe("Analytics: TopProductsCard moneda por tenant", () => {
    it("usa COP por defecto (provider es-CO/COP)", () => {
        const html = renderToStaticMarkup(
            <TenantLocaleProvider locale="es-CO" currencyCode="COP">
                <TopProductsCard topProducts={topProducts} lowStockProducts={[]} />
            </TenantLocaleProvider>,
        )
        expect(html).toContain("1.000")
        expect(html).not.toContain("1,000.00")
    })

    it("usa USD cuando el provider es en-US/USD", () => {
        const html = renderToStaticMarkup(
            <TenantLocaleProvider locale="en-US" currencyCode="USD">
                <TopProductsCard topProducts={topProducts} lowStockProducts={[]} />
            </TenantLocaleProvider>,
        )
        expect(html).toContain("1,000.00")
    })
})
