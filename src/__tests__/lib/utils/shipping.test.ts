import { describe, it, expect } from "vitest"
import { getShippingAvailability } from "@/lib/utils/shipping"

// Regresión del bug financiero: el envío gratis se aplicaba ignorando las zonas
// (zone-blind) en el flujo de creación de orden (create_payment_link) y en el
// resumen de checkout. Config real de qp: gratis SOLO en zonas Bogotá-área,
// $10.000 fuera, mínimo $15.000. Un pedido a Medellín >$15.000 quedaba en $0.
describe("getShippingAvailability (zone-aware)", () => {
    const qpConfig = {
        free_shipping_enabled: true,
        free_shipping_min_amount: 15000,
        free_shipping_zones: ["Bogota", "Soacha", "Chia", "Cajica", "Zipaquira", "Tocancipa"],
        default_shipping_rate: 10000,
    }

    it("cobra tarifa default a ciudad FUERA de zona aunque supere el mínimo (bug qp → Medellín)", () => {
        const r = getShippingAvailability(qpConfig, 38500, "Medellín")
        expect(r.available).toBe(true)
        expect(r.cost).toBe(10000)
    })

    it("aplica envío gratis a ciudad EN zona que supera el mínimo", () => {
        expect(getShippingAvailability(qpConfig, 38500, "Bogotá").cost).toBe(0)
    })

    it("cobra default a ciudad EN zona que NO alcanza el mínimo", () => {
        expect(getShippingAvailability(qpConfig, 10000, "Bogotá").cost).toBe(10000)
    })

    it("estimado PRE-ciudad (sin ciudad) con zonas definidas: cobra default, no asume gratis", () => {
        expect(getShippingAvailability(qpConfig, 38500, undefined).cost).toBe(10000)
    })

    it("sin zonas configuradas: gratis por monto en cualquier ciudad", () => {
        const noZones = {
            free_shipping_enabled: true,
            free_shipping_min_amount: 15000,
            free_shipping_zones: null,
            default_shipping_rate: 8000,
        }
        expect(getShippingAvailability(noZones, 20000, "Medellín").cost).toBe(0)
        expect(getShippingAvailability(noZones, 10000, "Medellín").cost).toBe(8000)
    })

    it("org que solo envía a zonas (default 0): ciudad fuera de zona = no disponible", () => {
        const onlyZones = {
            free_shipping_enabled: true,
            free_shipping_min_amount: 0,
            free_shipping_zones: ["Bogota"],
            default_shipping_rate: 0,
        }
        const r = getShippingAvailability(onlyZones, 50000, "Medellín")
        expect(r.available).toBe(false)
        expect(r.cost).toBe(0)
    })
})
