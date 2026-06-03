import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ChatPayBar } from "@/components/chat/chat-pay-bar"

/**
 * Rediseño conversacional — Barra de pago persistente del chat.
 * Contrato aditivo: oculta con carrito vacío, muestra total + CTA cuando hay
 * ítems, respeta copy por superficie y muestra el nudge de envío gratis.
 */
const baseProps = {
    total: 50000,
    formatPrice: (price: number) => `$${price.toLocaleString("es-CO")}`,
    primaryColor: "#0FBCC9",
    onPay: () => {},
    onViewCart: () => {},
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
        expect(html).toContain("productos")
    })

    it("usa singular y copy custom según la superficie", () => {
        const html = renderToStaticMarkup(
            <ChatPayBar itemCount={1} {...baseProps} ctaLabel="Generar link de pago" />,
        )
        expect(html).toContain("Generar link de pago")
        expect(html).toContain("producto")
        expect(html).not.toContain("Pagar ahora")
    })

    it("muestra el nudge de envío gratis cuando falta monto", () => {
        const html = renderToStaticMarkup(
            <ChatPayBar itemCount={1} {...baseProps} freeShippingRemaining={20000} />,
        )
        expect(html).toContain("envío gratis")
        expect(html).toContain("$20.000")
    })
})
