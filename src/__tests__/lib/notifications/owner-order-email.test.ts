/**
 * Tests del email de nueva venta al MERCHANT (generateOwnerNotificationHTML).
 * Fix "revisemos la casa": antes no incluía foto del producto ni datos del
 * comprador (teléfono/dirección), ni método de pago, ni link al pedido.
 */

import { describe, it, expect } from "vitest"
import { generateOwnerNotificationHTML } from "@/lib/notifications/email"

const baseData = {
    orderNumber: "ORD-123",
    customerName: "Laura Pérez",
    customerEmail: "laura@example.com",
    customerPhone: "573001112233",
    customerAddress: "Carrera 29 E 4 Sur 94, Medellín, Antioquia",
    paymentMethod: "contraentrega",
    orderUrl: "https://landingchat.co/dashboard/orders/abc-123",
    total: 150000,
    items: [
        { name: "Camiseta", quantity: 2, price: 50000, variant_title: "Talla M", image: "https://cdn.example.com/camiseta.jpg" },
        { name: "Gorra", quantity: 1, price: 50000, variant_title: null, image: null },
    ],
    organizationName: "Quality Pets",
}

describe("generateOwnerNotificationHTML", () => {
    it("incluye datos del comprador: teléfono (link tel:) y dirección de envío", () => {
        const html = generateOwnerNotificationHTML(baseData, "es-CO", "COP")
        expect(html).toContain("Datos del comprador")
        expect(html).toContain('href="tel:573001112233"')
        expect(html).toContain("Carrera 29 E 4 Sur 94, Medellín, Antioquia")
    })

    it("incluye la foto del producto y omite <img> cuando el item no tiene imagen", () => {
        const html = generateOwnerNotificationHTML(baseData, "es-CO", "COP")
        expect(html).toContain('src="https://cdn.example.com/camiseta.jpg"')
        expect(html).toContain("Camiseta")
        expect(html).toContain("Talla M")
        expect(html.match(/<img /g)?.length).toBe(1)
    })

    it("incluye método de pago y CTA al pedido en el dashboard", () => {
        const html = generateOwnerNotificationHTML(baseData, "es-CO", "COP")
        expect(html).toContain("contraentrega")
        expect(html).toContain("https://landingchat.co/dashboard/orders/abc-123")
        expect(html).toContain("Ver pedido en el dashboard")
    })

    it("escapa HTML en datos provistos por el cliente (anti-inyección)", () => {
        const html = generateOwnerNotificationHTML(
            { ...baseData, customerName: '<script>alert("x")</script>' },
            "es-CO",
            "COP"
        )
        expect(html).not.toContain("<script>")
        expect(html).toContain("&lt;script&gt;")
    })

    it("campos opcionales ausentes → sin teléfono/dirección/CTA y sin romper", () => {
        const html = generateOwnerNotificationHTML(
            { ...baseData, customerPhone: null, customerAddress: null, paymentMethod: null, orderUrl: null },
            "es-CO",
            "COP"
        )
        expect(html).not.toContain("tel:")
        expect(html).not.toContain("Ver pedido en el dashboard")
        expect(html).toContain("Laura Pérez")
    })

    it("en-US: labels en inglés", () => {
        const html = generateOwnerNotificationHTML(baseData, "en-US", "USD")
        expect(html).toContain("Buyer details")
        expect(html).toContain("View order in dashboard")
    })
})
