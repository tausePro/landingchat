import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ChatPayBar } from "@/components/chat/chat-pay-bar"

/**
 * Slice 1 — Barra de pago persistente del chat.
 * Garantiza el contrato aditivo: oculta con carrito vacío, muestra total +
 * CTA cuando hay ítems, y respeta el copy por superficie (web vs WhatsApp).
 */
const baseProps = {
    total: 50000,
    formatPrice: (price: number) => `$${price.toLocaleString("es-CO")}`,
    primaryColor: "#7c3aed",
    onCheckout: () => {},
    onExpand: () => {},
}

describe("ChatPayBar", () => {
    it("no renderiza nada cuando el carrito está vacío", () => {
        const html = renderToStaticMarkup(<ChatPayBar itemCount={0} {...baseProps} />)
        expect(html).toBe("")
    })

    it("muestra el total formateado y el CTA por defecto cuando hay ítems", () => {
        const html = renderToStaticMarkup(<ChatPayBar itemCount={2} {...baseProps} />)
        expect(html).toContain("$50.000")
        expect(html).toContain("Ir a pagar")
        expect(html).toContain("ítems")
    })

    it("usa singular y copy custom según la superficie", () => {
        const html = renderToStaticMarkup(
            <ChatPayBar itemCount={1} {...baseProps} checkoutLabel="Pagar ahora" />,
        )
        expect(html).toContain("Pagar ahora")
        expect(html).toContain("ítem")
        expect(html).not.toContain("Ir a pagar")
    })
})
