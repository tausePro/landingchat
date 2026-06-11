/**
 * Regresión del rename de categorías (caso Tantor, 2026-06-11):
 * renombrar "Hospedajes" → "Accommodations" en el dashboard no se propagaba
 * a products.categories (el storefront seguía mostrando el nombre viejo).
 *
 * Bugs cubiertos:
 * 1. El nombre anterior se leía DESPUÉS del UPDATE (comparaba contra el nuevo).
 * 2. El sync solo recorría product_categories — los productos con el string
 *    puesto directo desde el editor quedaban huérfanos.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

const state = {
    categoryName: "Hospedajes",
    products: [
        { id: "p1", categories: ["services", "Hospedajes"] },
        { id: "p2", categories: ["Hospedajes"] },
        { id: "p3", categories: ["snacks"] },
    ],
}

const productUpdates: Array<{ id: string; categories: string[] }> = []

function categoriesChain() {
    const chain: Record<string, unknown> = {}
    chain.select = vi.fn(() => chain)
    chain.eq = vi.fn(() => chain)
    chain.single = vi.fn(async () => ({ data: { name: state.categoryName } }))
    chain.update = vi.fn((payload: { name?: string }) => {
        // Simula el UPDATE real: el nombre en DB cambia ANTES del sync
        if (payload.name) state.categoryName = payload.name
        return { eq: vi.fn(async () => ({ error: null })) }
    })
    return chain
}

function productsChain() {
    const chain: Record<string, unknown> = {}
    let containsArg: string[] = []
    chain.select = vi.fn(() => chain)
    chain.contains = vi.fn((_col: string, value: string[]) => {
        containsArg = value
        return Promise.resolve({
            data: state.products.filter((product) => product.categories.includes(containsArg[0])),
        })
    })
    chain.update = vi.fn((payload: { categories: string[] }) => ({
        eq: vi.fn(async (_col: string, id: string) => {
            productUpdates.push({ id, categories: payload.categories })
            return { error: null }
        }),
    }))
    return chain
}

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(async () => ({
        auth: { getUser: vi.fn(async () => ({ data: { user: { id: "u1" } } })) },
        from: (table: string) => {
            if (table === "categories") return categoriesChain()
            if (table === "products") return productsChain()
            if (table === "profiles") {
                const chain: Record<string, unknown> = {}
                chain.select = vi.fn(() => chain)
                chain.eq = vi.fn(() => chain)
                chain.single = vi.fn(async () => ({ data: { organization_id: "org-1" } }))
                return chain
            }
            throw new Error(`Tabla inesperada: ${table}`)
        },
    })),
    createServiceClient: vi.fn(),
}))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

import { updateCategory } from "@/app/dashboard/categories/actions"

beforeEach(() => {
    state.categoryName = "Hospedajes"
    state.products = [
        { id: "p1", categories: ["services", "Hospedajes"] },
        { id: "p2", categories: ["Hospedajes"] },
        { id: "p3", categories: ["snacks"] },
    ]
    productUpdates.length = 0
})

describe("updateCategory — propagación del rename a products", () => {
    it("renombra el string en TODOS los productos que lo contienen (con o sin link)", async () => {
        const result = await updateCategory("cat-1", { name: "Accommodations" })

        expect(result.success).toBe(true)
        expect(productUpdates).toHaveLength(2)
        expect(productUpdates.find((update) => update.id === "p1")?.categories)
            .toEqual(["services", "Accommodations"])
        expect(productUpdates.find((update) => update.id === "p2")?.categories)
            .toEqual(["Accommodations"])
        // p3 (snacks) no se toca
        expect(productUpdates.find((update) => update.id === "p3")).toBeUndefined()
    })

    it("sin cambio de nombre no toca productos", async () => {
        const result = await updateCategory("cat-1", { description: "solo descripción" })

        expect(result.success).toBe(true)
        expect(productUpdates).toHaveLength(0)
    })
})
