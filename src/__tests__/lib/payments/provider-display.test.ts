/**
 * Contrato de presentación de pasarelas en el checkout del cliente.
 *
 * Fija la regresión del bug donde el PaymentStep usaba un ternario binario
 * (wompi ? "Wompi" : "ePayco") y etiquetaba a Bold —y a cualquier pasarela
 * nueva— como "ePayco".
 */
import { describe, it, expect } from "vitest"
import { getProviderDisplay } from "@/lib/payments/provider-display"

describe("getProviderDisplay", () => {
    it("Bold se muestra como 'Bold', NUNCA como 'ePayco'", () => {
        const display = getProviderDisplay("bold")
        expect(display.label).toBe("Bold")
        expect(display.label).not.toBe("ePayco")
    })

    it("mapea los providers conocidos a su nombre real", () => {
        expect(getProviderDisplay("wompi").label).toBe("Wompi")
        expect(getProviderDisplay("epayco").label).toBe("ePayco")
        expect(getProviderDisplay("addi").label).toBe("Addi")
    })

    it("provider desconocido cae a un fallback con su propio id (no a ePayco)", () => {
        const display = getProviderDisplay("mercadopago")
        expect(display.label).toBe("mercadopago")
        expect(display.description).toBe("")
    })
})
