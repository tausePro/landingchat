/**
 * Tests de fetchAllPages — el antídoto del cap silencioso de 1000 filas
 * de PostgREST (auditoría 2026-06-12).
 */

import { describe, expect, it, vi } from "vitest"
import { fetchAllPages } from "@/lib/supabase/fetch-all"

function pagedSource(total: number) {
    return vi.fn(async (from: number, to: number) => ({
        data: Array.from(
            { length: Math.max(0, Math.min(total - 1, to) - from + 1) },
            (_, index) => ({ n: from + index })
        ),
        error: null,
    }))
}

describe("fetchAllPages", () => {
    it("agrega múltiples páginas completas (2500 filas = 3 requests)", async () => {
        const source = pagedSource(2500)
        const result = await fetchAllPages(source)

        expect(result.rows).toHaveLength(2500)
        expect(result.truncated).toBe(false)
        expect(source).toHaveBeenCalledTimes(3)
        expect(source).toHaveBeenNthCalledWith(1, 0, 999)
        expect(source).toHaveBeenNthCalledWith(3, 2000, 2999)
    })

    it("página única parcial → 1 solo request", async () => {
        const source = pagedSource(42)
        const result = await fetchAllPages(source)

        expect(result.rows).toHaveLength(42)
        expect(source).toHaveBeenCalledTimes(1)
    })

    it("exactamente 1000 filas → segunda página vacía cierra el loop", async () => {
        const source = pagedSource(1000)
        const result = await fetchAllPages(source)

        expect(result.rows).toHaveLength(1000)
        expect(result.truncated).toBe(false)
        expect(source).toHaveBeenCalledTimes(2)
    })

    it("respeta maxRows y marca truncated", async () => {
        const source = pagedSource(50_000)
        const result = await fetchAllPages(source, { maxRows: 3000 })

        expect(result.rows).toHaveLength(3000)
        expect(result.truncated).toBe(true)
        expect(source).toHaveBeenCalledTimes(3)
    })

    it("error de PostgREST → retorna lo acumulado sin lanzar", async () => {
        let call = 0
        const source = vi.fn(async (from: number, to: number) => {
            call++
            if (call === 2) return { data: null, error: { message: "boom" } }
            return { data: Array.from({ length: to - from + 1 }, (_, index) => ({ n: index })), error: null }
        })

        const result = await fetchAllPages(source)

        expect(result.error).toBe("boom")
        expect(result.rows).toHaveLength(1000)
    })

    it("excepción del builder → capturada, nunca lanza", async () => {
        const result = await fetchAllPages(async () => {
            throw new Error("red caída")
        })

        expect(result.error).toBe("red caída")
        expect(result.rows).toEqual([])
    })
})
