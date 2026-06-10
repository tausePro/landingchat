/**
 * Tests del slice AEO/GEO hardening:
 * - Product JSON-LD con moneda del tenant (antes COP hardcodeado → datos
 *   incorrectos para tenants USD como Tantor's House)
 * - OfferShippingDetails con datos reales de shipping_settings
 * - ItemList JSON-LD del catálogo con URLs canónicas
 */

import { describe, expect, it } from "vitest"
import { buildProductJsonLdData } from "@/components/seo/product-json-ld"
import { buildCatalogItemListJsonLd } from "@/lib/seo/catalog-json-ld"

const baseProduct = {
    id: "prod-1",
    name: "Serum Facial",
    description: "Serum hidratante",
    price: 25,
    stock: 10,
}

const usOrganization = { name: "Tantors House", slug: "tantors", custom_domain: null }

describe("buildProductJsonLdData — moneda del tenant", () => {
    it("usa la moneda del tenant en la oferta (USD)", () => {
        const { productSchema } = buildProductJsonLdData({
            product: baseProduct,
            organization: usOrganization,
            url: "https://tantors.landingchat.co/producto/serum-facial",
            currency: "USD",
            countryCode: "US",
        })

        const offers = productSchema.offers as { priceCurrency: string; price: number }
        expect(offers.priceCurrency).toBe("USD")
        expect(offers.price).toBe(25)
    })

    it("mantiene COP como default para callers existentes", () => {
        const { productSchema } = buildProductJsonLdData({
            product: baseProduct,
            organization: { name: "Tez", slug: "tez", custom_domain: "tez.com.co" },
            url: "https://tez.com.co/producto/serum-facial",
        })

        const offers = productSchema.offers as { priceCurrency: string }
        expect(offers.priceCurrency).toBe("COP")
    })
})

describe("buildProductJsonLdData — OfferShippingDetails", () => {
    it("emite shippingDetails con tarifa, destino y días de entrega reales", () => {
        const { productSchema } = buildProductJsonLdData({
            product: baseProduct,
            organization: usOrganization,
            url: "https://tantors.landingchat.co/producto/serum-facial",
            currency: "USD",
            countryCode: "US",
            shipping: {
                free_shipping_enabled: false,
                free_shipping_min_amount: null,
                default_shipping_rate: 5,
                estimated_delivery_days: 4,
            },
        })

        const offers = productSchema.offers as {
            shippingDetails: {
                "@type": string
                shippingRate: { value: number; currency: string }
                shippingDestination: { addressCountry: string }
                deliveryTime: { transitTime: { value: number; unitCode: string } }
            }
        }
        expect(offers.shippingDetails["@type"]).toBe("OfferShippingDetails")
        expect(offers.shippingDetails.shippingRate).toMatchObject({ value: 5, currency: "USD" })
        expect(offers.shippingDetails.shippingDestination.addressCountry).toBe("US")
        expect(offers.shippingDetails.deliveryTime.transitTime).toMatchObject({ value: 4, unitCode: "DAY" })
    })

    it("envío gratis incondicional → tarifa 0", () => {
        const { productSchema } = buildProductJsonLdData({
            product: baseProduct,
            organization: usOrganization,
            url: "https://tantors.landingchat.co/producto/serum-facial",
            shipping: {
                free_shipping_enabled: true,
                free_shipping_min_amount: null,
                default_shipping_rate: 12000,
                estimated_delivery_days: null,
            },
        })

        const offers = productSchema.offers as { shippingDetails: { shippingRate: { value: number } } }
        expect(offers.shippingDetails.shippingRate.value).toBe(0)
    })

    it("envío gratis condicional (mínimo de compra) → declara la tarifa base", () => {
        const { productSchema } = buildProductJsonLdData({
            product: baseProduct,
            organization: usOrganization,
            url: "https://tantors.landingchat.co/producto/serum-facial",
            shipping: {
                free_shipping_enabled: true,
                free_shipping_min_amount: 100000,
                default_shipping_rate: 12000,
                estimated_delivery_days: null,
            },
        })

        const offers = productSchema.offers as { shippingDetails: { shippingRate: { value: number } } }
        expect(offers.shippingDetails.shippingRate.value).toBe(12000)
    })

    it("sin config de envío no emite shippingDetails (no inventa datos)", () => {
        const { productSchema } = buildProductJsonLdData({
            product: baseProduct,
            organization: usOrganization,
            url: "https://tantors.landingchat.co/producto/serum-facial",
            shipping: null,
        })

        const offers = productSchema.offers as Record<string, unknown>
        expect(offers.shippingDetails).toBeUndefined()
    })
})

describe("buildProductJsonLdData — hasMerchantReturnPolicy", () => {
    const baseShipping = {
        free_shipping_enabled: false,
        free_shipping_min_amount: null,
        default_shipping_rate: 5,
        estimated_delivery_days: null,
    }

    function getOffers(shipping: Record<string, unknown>) {
        const { productSchema } = buildProductJsonLdData({
            product: baseProduct,
            organization: usOrganization,
            url: "https://tantors.landingchat.co/producto/serum-facial",
            countryCode: "US",
            shipping: { ...baseShipping, ...shipping },
        })
        return productSchema.offers as Record<string, unknown>
    }

    it("sin configurar (NULL) no emite política — no se inventan datos", () => {
        expect(getOffers({ returns_accepted: null }).hasMerchantReturnPolicy).toBeUndefined()
    })

    it("no acepta devoluciones → MerchantReturnNotPermitted", () => {
        expect(getOffers({ returns_accepted: false }).hasMerchantReturnPolicy).toMatchObject({
            "@type": "MerchantReturnPolicy",
            applicableCountry: "US",
            returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted",
        })
    })

    it("acepta con ventana y envío gratis → FiniteReturnWindow + FreeReturn", () => {
        expect(
            getOffers({ returns_accepted: true, return_window_days: 5, return_fees: "free" }).hasMerchantReturnPolicy
        ).toMatchObject({
            returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
            merchantReturnDays: 5,
            returnFees: "https://schema.org/FreeReturn",
        })
    })

    it("acepta con envío a cargo del cliente → ReturnFeesCustomerResponsibility", () => {
        expect(
            getOffers({ returns_accepted: true, return_window_days: 30, return_fees: "customer" }).hasMerchantReturnPolicy
        ).toMatchObject({
            merchantReturnDays: 30,
            returnFees: "https://schema.org/ReturnFeesCustomerResponsibility",
        })
    })

    it("acepta pero sin ventana de días → config incompleta, no emite", () => {
        expect(
            getOffers({ returns_accepted: true, return_window_days: null }).hasMerchantReturnPolicy
        ).toBeUndefined()
    })
})

describe("buildCatalogItemListJsonLd", () => {
    it("construye ItemList con URLs canónicas (dominio custom preferido)", () => {
        const jsonLd = buildCatalogItemListJsonLd(
            { slug: "tez", custom_domain: "tez.com.co" },
            [
                { id: "p1", slug: "serum-facial", name: "Serum Facial" },
                { id: "p2", slug: null, name: "Toalla Facial" },
            ]
        )

        expect(jsonLd["@type"]).toBe("ItemList")
        expect(jsonLd.numberOfItems).toBe(2)
        expect(jsonLd.itemListElement[0]).toMatchObject({
            position: 1,
            name: "Serum Facial",
            url: "https://tez.com.co/producto/serum-facial",
        })
        // Sin slug cae al id — nunca URLs rotas
        expect(jsonLd.itemListElement[1].url).toBe("https://tez.com.co/producto/p2")
    })
})
