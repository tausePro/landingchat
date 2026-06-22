import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { AnnouncementBar } from "@/components/store/announcement-bar"

/**
 * Slide aditivo del AnnouncementBar (banner premium):
 * - Sin `messages` el bar conserva el comportamiento original (1 mensaje estático)
 *   → no rompe las plantillas que no son premium.
 * - Con `messages` el SSR renderiza el índice 0 (base); los extra rotan en cliente
 *   (no testeable en env "node": la rotación es useEffect/setInterval).
 */
describe("AnnouncementBar — slide aditivo", () => {
    it("sin messages ni shipping: muestra el mensaje base (comportamiento original)", () => {
        const html = renderToStaticMarkup(<AnnouncementBar primaryColor="#7c3aed" />)
        expect(html).toContain("Tu asistente de compras disponible siempre")
    })

    it("con envío gratis habilitado: muestra el mensaje de envío", () => {
        const html = renderToStaticMarkup(
            <AnnouncementBar primaryColor="#7c3aed" shippingConfig={{ free_shipping_enabled: true }} />,
        )
        expect(html).toContain("Envío gratis en todos los pedidos")
    })

    it("con messages: el SSR renderiza el primer mensaje (base); los extra rotan en cliente", () => {
        const html = renderToStaticMarkup(
            <AnnouncementBar primaryColor="#7c3aed" messages={["Asesoría por chat, siempre disponible"]} />,
        )
        expect(html).toContain("Tu asistente de compras disponible siempre")
    })

    it("aplica el color del tenant como fondo del bar", () => {
        const html = renderToStaticMarkup(<AnnouncementBar primaryColor="#123456" />)
        expect(html).toContain("#123456")
    })
})
