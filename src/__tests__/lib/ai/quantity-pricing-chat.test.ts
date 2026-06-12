/**
 * Regresión del reporte Goldcaps (2026-06-12): el agente cotizaba 20
 * unidades al precio detal ($12.000/u) ignorando los precios por cantidad
 * (12-350 → $6.000/u). El carrito del chat ahora es tier-aware en
 * add_to_cart y update_cart_quantity, y show_product expone los tiers.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock(import("@/lib/commerce/getProductWithVariants"), async (importOriginal) => {
    const actual = await importOriginal()
    return {
        ...actual,
        getSellableVariants: vi.fn(async () => []),
        getSellableVariantsForProducts: vi.fn(async () => new Map()),
    }
})

import { ecommerceToolHandlers } from "@/lib/ai/executors/ecommerce"
import type { ToolContext, ToolSupabaseClient } from "@/lib/ai/executors/types"

const GOLDCAPS_GORRA = {
    id: "prod-gorra",
    name: "Gorra Acrílica 6 paneles",
    description: "Gorra",
    price: 12000,
    sale_price: null,
    image_url: null,
    images: [],
    stock: 300,
    categories: [],
    variants: [],
    has_quantity_pricing: true,
    minimum_quantity: 1,
    price_tiers: [
        { min_quantity: 1, max_quantity: 11, unit_price: 12000, label: "Detal" },
        { min_quantity: 12, max_quantity: 350, unit_price: 6000, label: "Por Mayor" },
    ],
}

let cartItems: Array<Record<string, unknown>>
let savedItems: Array<Record<string, unknown>> | null

function buildSupabase(): ToolSupabaseClient {
    return {
        from: (table: string) => {
            const chain: Record<string, unknown> = {}
            for (const method of ["select", "eq", "in", "order", "limit", "contains"]) {
                chain[method] = vi.fn(() => chain)
            }
            chain.single = vi.fn(async () => {
                if (table === "products") return { data: GOLDCAPS_GORRA, error: null }
                if (table === "carts") return { data: { id: "cart-1", items: cartItems }, error: null }
                return { data: null, error: null }
            })
            chain.update = vi.fn((payload: Record<string, unknown>) => {
                if (table === "carts") savedItems = payload.items as Array<Record<string, unknown>>
                return chain
            })
            chain.then = (resolve: (value: unknown) => void) => resolve({ data: [], error: null })
            return chain
        },
        rpc: vi.fn(async () => ({ data: [], error: null })),
    } as unknown as ToolSupabaseClient
}

const context: ToolContext = { chatId: "chat-1", organizationId: "org-goldcaps" }

beforeEach(() => {
    vi.clearAllMocks()
    cartItems = []
    savedItems = null
})

describe("add_to_cart tier-aware", () => {
    it("20 unidades → precio por mayor ($6.000/u), no detal", async () => {
        const result = await ecommerceToolHandlers.add_to_cart(
            buildSupabase(),
            { product_id: "prod-gorra", quantity: 20 },
            context
        )

        expect(result.success).toBe(true)
        expect(result.data?.added?.price).toBe(6000)
        expect(savedItems?.[0]).toMatchObject({ quantity: 20, unit_price: 6000 })
    })

    it("5 unidades → precio detal ($12.000/u)", async () => {
        const result = await ecommerceToolHandlers.add_to_cart(
            buildSupabase(),
            { product_id: "prod-gorra", quantity: 5 },
            context
        )

        expect(result.success).toBe(true)
        expect(result.data?.added?.price).toBe(12000)
    })

    it("merge que cruza el umbral: 8 en carrito + 12 nuevas → 20 a $6.000/u", async () => {
        cartItems = [{
            id: "prod-gorra", product_id: "prod-gorra", product_name: "Gorra",
            name: "Gorra", price: 12000, unit_price: 12000, quantity: 8,
            variant_id: null, variant_title: null, compare_at_price: null, image_url: null,
        }]

        const result = await ecommerceToolHandlers.add_to_cart(
            buildSupabase(),
            { product_id: "prod-gorra", quantity: 12 },
            context
        )

        expect(result.success).toBe(true)
        expect(savedItems?.[0]).toMatchObject({ quantity: 20, unit_price: 6000, price: 6000 })
    })
})

describe("update_cart_quantity tier-aware", () => {
    beforeEach(() => {
        cartItems = [{
            id: "prod-gorra", product_id: "prod-gorra", product_name: "Gorra",
            name: "Gorra", price: 12000, unit_price: 12000, quantity: 8,
            variant_id: null, variant_title: null, compare_at_price: null, image_url: null,
        }]
    })

    it("subir 8 → 20 recalcula al precio por mayor", async () => {
        const result = await ecommerceToolHandlers.update_cart_quantity(
            buildSupabase(),
            { product_id: "prod-gorra", quantity: 20 },
            context
        )

        expect(result.success).toBe(true)
        expect(savedItems?.[0]).toMatchObject({ quantity: 20, unit_price: 6000 })
    })

    it("bajar 20 → 5 regresa al precio detal", async () => {
        cartItems[0] = { ...cartItems[0], quantity: 20, price: 6000, unit_price: 6000 }

        const result = await ecommerceToolHandlers.update_cart_quantity(
            buildSupabase(),
            { product_id: "prod-gorra", quantity: 5 },
            context
        )

        expect(result.success).toBe(true)
        expect(savedItems?.[0]).toMatchObject({ quantity: 5, unit_price: 12000 })
    })
})

describe("show_product expone los tiers al agente", () => {
    it("incluye quantity_pricing con nota instructiva", async () => {
        const result = await ecommerceToolHandlers.show_product(
            buildSupabase(),
            { product_id: "prod-gorra" },
            context
        )

        expect(result.success).toBe(true)
        const pricing = result.data?.product?.quantity_pricing
        expect(pricing?.tiers).toHaveLength(2)
        expect(pricing?.note).toContain("12-350 unidades: $6.000/u")
        expect(pricing?.note).toContain("pregunta la cantidad")
    })
})
