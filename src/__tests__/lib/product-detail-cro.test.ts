import { describe, expect, it } from "vitest"
import { hasPaidTrafficSignal, resolveProductDetailCROConfig } from "@/lib/storefront/product-detail-cro"

const product = {
    id: "product-1",
    slug: "ritual-renovacion-total-tez",
    categories: ["Cuidado facial"],
}

const baseSettings = {
    storefront: {
        productDetail: {
            croCampaigns: [
                {
                    id: "tez-mothers-day-2026",
                    enabled: true,
                    startsAt: "2026-05-01T00:00:00-05:00",
                    endsAt: "2026-05-11T23:59:59-05:00",
                    targets: {
                        productSlugs: ["ritual-renovacion-total-tez"],
                    },
                    urgencyBanner: {
                        enabled: true,
                        desktopText: "Pide antes del sábado 8 de mayo para garantizar entrega el Día de la Madre",
                        mobileText: "Pide antes del sáb 8 mayo → llega a mamá",
                        countdownEndsAt: "2026-05-08T23:59:59-05:00",
                    },
                    cta: {
                        primaryText: "Regalar esto a mamá",
                        secondaryText: "Chatear para regalar",
                    },
                    priceContext: {
                        enabled: true,
                        text: "Precio especial Día de la Madre",
                    },
                    inventory: {
                        enabled: true,
                        badge: "Entrega garantizada",
                        title: "Pide hoy y llega antes del Día de la Madre ✓",
                        description: "Garantía de entrega si pides antes del viernes.",
                    },
                    trust: {
                        enabled: true,
                        guaranteeText: "Garantía de satisfacción — Si no te gusta, lo cambiamos",
                        paymentMethodsText: "Contra-entrega · Nequi · PSE · Bancolombia · Tarjeta",
                    },
                    landingMode: {
                        enabled: true,
                        applyTo: "paid_traffic",
                        hideMenu: true,
                        hideSearch: true,
                        hideProfile: true,
                    },
                },
            ],
        },
    },
}

describe("product detail CRO config", () => {
    it("resuelve campaña activa para el producto objetivo", () => {
        const config = resolveProductDetailCROConfig({
            settings: baseSettings,
            product,
            now: new Date("2026-05-06T10:00:00-05:00"),
        })

        expect(config?.campaignId).toBe("tez-mothers-day-2026")
        expect(config?.urgencyBanner?.desktopText).toContain("sábado 8 de mayo")
        expect(config?.cta?.primaryText).toBe("Regalar esto a mamá")
        expect(config?.priceContext?.text).toBe("Precio especial Día de la Madre")
        expect(config?.trust?.paymentMethodsText).toContain("Nequi")
    })

    it("omite banner vencido sin desactivar el resto de la campaña", () => {
        const config = resolveProductDetailCROConfig({
            settings: baseSettings,
            product,
            now: new Date("2026-05-09T00:00:00-05:00"),
        })

        expect(config?.campaignId).toBe("tez-mothers-day-2026")
        expect(config?.urgencyBanner).toBeUndefined()
        expect(config?.cta?.primaryText).toBe("Regalar esto a mamá")
    })

    it("no activa campañas fuera de ventana", () => {
        const config = resolveProductDetailCROConfig({
            settings: baseSettings,
            product,
            now: new Date("2026-05-12T00:00:00-05:00"),
        })

        expect(config).toBeNull()
    })

    it("activa modo landing solo para tráfico pago cuando está configurado así", () => {
        const organicConfig = resolveProductDetailCROConfig({
            settings: baseSettings,
            product,
            searchParams: {},
            now: new Date("2026-05-06T10:00:00-05:00"),
        })
        const paidConfig = resolveProductDetailCROConfig({
            settings: baseSettings,
            product,
            searchParams: { utm_source: "facebook", utm_medium: "paid_social" },
            now: new Date("2026-05-06T10:00:00-05:00"),
        })

        expect(organicConfig?.landingMode).toBeUndefined()
        expect(paidConfig?.landingMode).toEqual({
            hideMenu: true,
            hideSearch: true,
            hideProfile: true,
            hideAnnouncementBar: false,
        })
    })

    it("usa modo landing default de PDP aunque no haya campaña activa", () => {
        const config = resolveProductDetailCROConfig({
            settings: {
                storefront: {
                    productDetail: {
                        defaultLandingMode: {
                            enabled: true,
                            applyTo: "paid_traffic",
                            hideMenu: true,
                            hideSearch: true,
                            hideProfile: true,
                            hideAnnouncementBar: true,
                        },
                    },
                },
            },
            product,
            searchParams: { fbclid: "meta-click-id" },
            now: new Date("2026-05-12T10:00:00-05:00"),
        })

        expect(config).toEqual({
            campaignId: "default-product-detail-landing-mode",
            landingMode: {
                hideMenu: true,
                hideSearch: true,
                hideProfile: true,
                hideAnnouncementBar: true,
            },
        })
    })

    it("detecta señales comunes de pauta", () => {
        expect(hasPaidTrafficSignal({ fbclid: "abc" })).toBe(true)
        expect(hasPaidTrafficSignal({ utm_source: "instagram", utm_medium: "cpc" })).toBe(true)
        expect(hasPaidTrafficSignal({ utm_source: "newsletter" })).toBe(false)
    })
})
