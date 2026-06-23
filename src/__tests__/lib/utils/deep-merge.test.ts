import { describe, it, expect } from "vitest"
import { deepMerge } from "@/lib/utils/deep-merge"

describe("deepMerge", () => {
    it("fusiona objetos anidados y preserva llaves ausentes en el override", () => {
        const base: Record<string, unknown> = { a: 1, nested: { x: 1, y: 2 } }
        const override: Record<string, unknown> = { nested: { y: 3 } }
        expect(deepMerge(base, override)).toEqual({ a: 1, nested: { x: 1, y: 3 } })
    })

    it("evita el clobbering: preserva videoSection cuando el snapshot del cliente no lo trae", () => {
        const dbSettings: Record<string, unknown> = {
            storefront: { template: "complete", videoSection: { enabled: true, videoUrl: "https://x" } },
        }
        const staleClient: Record<string, unknown> = {
            storefront: { template: "complete" },
        }
        const result = deepMerge(dbSettings, staleClient) as {
            storefront: { videoSection: unknown; template: string }
        }
        expect(result.storefront.videoSection).toEqual({ enabled: true, videoUrl: "https://x" })
        expect(result.storefront.template).toBe("complete")
    })

    it("reemplaza arrays en vez de fusionarlos", () => {
        const base: Record<string, unknown> = { items: [1, 2, 3] }
        const override: Record<string, unknown> = { items: [9] }
        expect(deepMerge(base, override)).toEqual({ items: [9] })
    })

    it("un primitivo/null en el override reemplaza al objeto base", () => {
        expect(deepMerge<Record<string, unknown>>({ a: { x: 1 } }, { a: 5 })).toEqual({ a: 5 })
        expect(deepMerge<Record<string, unknown>>({ a: 1 }, { a: null })).toEqual({ a: null })
    })

    it("agrega llaves nuevas presentes solo en el override", () => {
        expect(deepMerge<Record<string, unknown>>({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 })
    })
})
