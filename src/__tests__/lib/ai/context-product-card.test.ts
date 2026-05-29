import { describe, it, expect } from "vitest"
import { buildContextProductCardData, type ContextProductRow } from "@/lib/ai/contextProductCard"
import type { ProductVariantRow } from "@/types/product"

function makeVariant(overrides: Partial<ProductVariantRow> = {}): ProductVariantRow {
    return {
        id: "variant-1",
        product_id: "product-1",
        organization_id: "org-1",
        title: "Default",
        sku: null,
        position: 0,
        is_default: true,
        is_active: true,
        price: 35000,
        compare_at_price: null,
        stock_quantity: 10,
        image_url: null,
        option_values: [],
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        ...overrides,
    }
}

function makeProduct(overrides: Partial<ContextProductRow> = {}): ContextProductRow {
    return {
        id: "product-1",
        name: "Láminas de Jabón Portátiles",
        description: "Higiene instantánea",
        price: 40000,
        sale_price: null,
        image_url: "https://cdn/product.jpg",
        images: [],
        stock: 0,
        categories: ["Cuidado corporal"],
        ...overrides,
    }
}

describe("buildContextProductCardData — precio de la card de contexto", () => {
    it("usa el precio de la variante default, no el precio base del producto (bug $40.000 vs $35.000)", () => {
        // product.price = 40000 (base desactualizado), variante default = 35000
        const card = buildContextProductCardData(makeProduct(), [makeVariant()])

        expect(card.price).toBe(35000)
        expect(card.sale_price).toBeNull()
    })

    it("muestra descuento real: price = compare_at (tachado), sale_price = precio final", () => {
        const variant = makeVariant({ price: 35000, compare_at_price: 40000 })
        const card = buildContextProductCardData(makeProduct(), [variant])

        expect(card.price).toBe(40000)
        expect(card.sale_price).toBe(35000)
    })

    it("ignora compare_at_price si no es mayor que price (no inventa descuento)", () => {
        const variant = makeVariant({ price: 35000, compare_at_price: 35000 })
        const card = buildContextProductCardData(makeProduct(), [variant])

        expect(card.price).toBe(35000)
        expect(card.sale_price).toBeNull()
    })

    it("selecciona la variante is_default cuando hay varias", () => {
        const cheaper = makeVariant({ id: "v-cheap", is_default: false, price: 20000 })
        const defaultVariant = makeVariant({ id: "v-default", is_default: true, price: 35000 })
        const card = buildContextProductCardData(makeProduct(), [cheaper, defaultVariant])

        expect(card.price).toBe(35000)
    })

    it("agrega el stock de todas las variantes activas", () => {
        const v1 = makeVariant({ id: "v1", stock_quantity: 3 })
        const v2 = makeVariant({ id: "v2", is_default: false, stock_quantity: 7 })
        const card = buildContextProductCardData(makeProduct(), [v1, v2])

        expect(card.stock).toBe(10)
    })

    it("prioriza la imagen de la variante default sobre la del producto", () => {
        const variant = makeVariant({ image_url: "https://cdn/variant.jpg" })
        const card = buildContextProductCardData(makeProduct(), [variant])

        expect(card.image_url).toBe("https://cdn/variant.jpg")
    })

    describe("fallback sin variantes vendibles", () => {
        it("usa sale_price legacy del producto cuando es menor que price", () => {
            const product = makeProduct({ price: 40000, sale_price: 30000 })
            const card = buildContextProductCardData(product, [])

            expect(card.price).toBe(40000)
            expect(card.sale_price).toBe(30000)
        })

        it("usa price del producto cuando no hay sale_price ni variantes", () => {
            const product = makeProduct({ price: 40000, sale_price: null })
            const card = buildContextProductCardData(product, [])

            expect(card.price).toBe(40000)
            expect(card.sale_price).toBeNull()
        })

        it("toma el stock del producto base cuando no hay variantes", () => {
            const product = makeProduct({ stock: 5 })
            const card = buildContextProductCardData(product, [])

            expect(card.stock).toBe(5)
        })
    })

    it("preserva id, name, description y categories del producto", () => {
        const card = buildContextProductCardData(makeProduct(), [makeVariant()])

        expect(card.id).toBe("product-1")
        expect(card.name).toBe("Láminas de Jabón Portátiles")
        expect(card.description).toBe("Higiene instantánea")
        expect(card.categories).toEqual(["Cuidado corporal"])
    })
})
