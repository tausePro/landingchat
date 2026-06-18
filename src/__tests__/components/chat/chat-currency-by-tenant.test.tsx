import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { OrderConfirmationInline } from "@/components/chat/order-confirmation-inline"
import { TenantLocaleProvider } from "@/lib/i18n/use-tenant-strings"

/**
 * i18n chat: los componentes del chat formatean precios en la moneda del tenant
 * leyendo el TenantLocaleProvider (montado por la página del chat). Antes tenían
 * un formatPrice local hardcodeado en COP.
 */
const baseProps = {
    orderNumber: "ORD-1",
    orderId: "id-1",
    items: [{ name: "Producto", quantity: 1, price: 1000 }],
    subtotal: 1000,
    shippingCost: 0,
    total: 1000,
    customerName: "Felipe",
    storeSlug: "qp",
}

describe("Chat: moneda por tenant (OrderConfirmationInline)", () => {
    it("usa COP por defecto (provider es-CO/COP)", () => {
        const html = renderToStaticMarkup(
            <TenantLocaleProvider locale="es-CO" currencyCode="COP">
                <OrderConfirmationInline {...baseProps} />
            </TenantLocaleProvider>,
        )
        expect(html).toContain("1.000")
        expect(html).not.toContain("1,000.00")
    })

    it("usa USD cuando el provider es en-US/USD", () => {
        const html = renderToStaticMarkup(
            <TenantLocaleProvider locale="en-US" currencyCode="USD">
                <OrderConfirmationInline {...baseProps} />
            </TenantLocaleProvider>,
        )
        expect(html).toContain("1,000.00")
    })
})
