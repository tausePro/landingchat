import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ChatPayBar } from "@/components/chat/chat-pay-bar"

/**
 * Rediseño conversacional — Barra de pago persistente del chat (mockup Alejandra/Tez).
 * Contrato aditivo: oculta con carrito vacío, muestra total + CTA cuando hay
 * ítems, respeta copy por superficie y singular/plural.
 */
const baseProps = {
    total: 50000,
    items: [{ id: "p1", name: "Toalla Facial Tez", unit_price: 25000, quantity: 2 }],
    formatPrice: (price: number) => `$${price.toLocaleString("es-CO")}`,
    primaryColor: "#0FBCC9",
    onPay: () => {},
}

describe("ChatPayBar", () => {
    it("no renderiza nada cuando el carrito está vacío", () => {
        const html = renderToStaticMarkup(<ChatPayBar itemCount={0} {...baseProps} />)
        expect(html).toBe("")
    })

    it("muestra el total formateado y el CTA por defecto cuando hay ítems", () => {
        const html = renderToStaticMarkup(<ChatPayBar itemCount={2} {...baseProps} />)
        expect(html).toContain("$50.000")
        expect(html).toContain("Pagar ahora")
        expect(html).toContain("ítems")
    })

    it("usa singular y copy custom según la superficie", () => {
        const html = renderToStaticMarkup(
            <ChatPayBar itemCount={1} {...baseProps} ctaLabel="Generar link de pago" />,
        )
        expect(html).toContain("Generar link de pago")
        expect(html).toContain("ítem")
        expect(html).not.toContain("Pagar ahora")
    })

    it("renderiza la barra con el badge de cantidad de ítems", () => {
        const html = renderToStaticMarkup(<ChatPayBar itemCount={3} {...baseProps} />)
        expect(html).toContain("shopping_bag")
        expect(html).toContain(">3<")
    })
})
