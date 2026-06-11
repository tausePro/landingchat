/**
 * Tests del fallback de meta description del storefront (caso Goldcaps):
 * data-driven con categorías reales, sin inventar claims.
 */

import { describe, expect, it } from "vitest"
import { buildStoreFallbackDescription, deriveTopCategories } from "@/lib/seo/store-description"

const PRODUCTS = [
    { categories: ["Gorras", "Hombre"] },
    { categories: ["Gorras"] },
    { categories: ["Gorras", "Sombreros"] },
    { categories: ["Sombreros"] },
    { categories: [] },
    { categories: null },
]

describe("deriveTopCategories", () => {
    it("ordena por frecuencia real y limita", () => {
        expect(deriveTopCategories(PRODUCTS, 2)).toEqual(["Gorras", "Sombreros"])
    })

    it("catálogo sin categorías → vacío", () => {
        expect(deriveTopCategories([{ categories: [] }, { categories: null }])).toEqual([])
    })
})

describe("buildStoreFallbackDescription", () => {
    it("incluye las categorías reales del catálogo (es-CO)", () => {
        const description = buildStoreFallbackDescription("Gold Caps Colombia", PRODUCTS, "es-CO")
        expect(description).toBe(
            "Tienda en línea de Gold Caps Colombia: Gorras, Sombreros, Hombre y más. Compra con atención por chat y pago seguro."
        )
    })

    it("locale en-US produce la versión en inglés", () => {
        const description = buildStoreFallbackDescription("Tantors House", PRODUCTS, "en-US")
        expect(description).toContain("Tantors House online store: Gorras")
        expect(description).toContain("chat support")
    })

    it("sin categorías cae a la versión corta sin inventar claims", () => {
        const description = buildStoreFallbackDescription("Nueva Tienda", [], "es-CO")
        expect(description).toBe("Tienda en línea de Nueva Tienda. Compra con atención por chat y pago seguro.")
        expect(description).not.toContain("envío")
        expect(description).not.toContain("descuento")
    })
})
