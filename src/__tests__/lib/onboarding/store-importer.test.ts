/**
 * Tests del motor de onboarding mágico (extracción de catálogo desde URL).
 * fetch y Claude mockeados. El motor NUNCA lanza.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockCreateMessage = vi.fn()
vi.mock("@/lib/ai/anthropic", () => ({
    createMessage: (...args: unknown[]) => mockCreateMessage(...args),
}))

import { extractStoreFromUrl, normalizePrice } from "@/lib/onboarding/store-importer"

function llmReply(payload: unknown) {
    return { content: [{ type: "text", text: JSON.stringify(payload) }], usage: { input_tokens: 100, output_tokens: 50 } }
}

function stubFetch(html: string, ok = true) {
    vi.stubGlobal("fetch", vi.fn(async () => ({
        ok,
        headers: { get: () => "text/html; charset=utf-8" },
        arrayBuffer: async () => new TextEncoder().encode(html).buffer,
    })))
}

beforeEach(() => {
    vi.clearAllMocks()
    mockCreateMessage.mockResolvedValue(llmReply({ brand_name: null, currency: null, primary_color: null, products: [] }))
})

afterEach(() => vi.unstubAllGlobals())

describe("normalizePrice (precios LATAM)", () => {
    it("number positivo se conserva, 0 y negativos → null", () => {
        expect(normalizePrice(30000)).toBe(30000)
        expect(normalizePrice(0)).toBeNull()
        expect(normalizePrice(-5)).toBeNull()
    })
    it("formato COP con punto de miles: $30.000 → 30000", () => {
        expect(normalizePrice("$30.000")).toBe(30000)
        expect(normalizePrice("30.000")).toBe(30000)
    })
    it("decimal con coma: 1.250,50 → 1250.5", () => {
        expect(normalizePrice("1.250,50")).toBe(1250.5)
    })
    it("formato USD con coma de miles: $1,250.50 → 1250.5", () => {
        expect(normalizePrice("$1,250.50")).toBe(1250.5)
    })
    it("vacío o basura → null", () => {
        expect(normalizePrice("")).toBeNull()
        expect(normalizePrice("agotado")).toBeNull()
        expect(normalizePrice(null)).toBeNull()
    })
})

describe("extractStoreFromUrl", () => {
    it("URL inválida → error sin tocar la red", async () => {
        const result = await extractStoreFromUrl("no-es-url")
        expect(result.ok).toBe(false)
    })

    it("extrae productos de JSON-LD (vía fiable) sin depender del LLM", async () => {
        const html = `<html><head>
            <script type="application/ld+json">${JSON.stringify({
                "@type": "Product", name: "Gorra Trucker", description: "Algodón",
                offers: { price: "30000", priceCurrency: "COP" }, image: "/img/gorra.jpg",
            })}</script></head><body></body></html>`
        stubFetch(html)

        const result = await extractStoreFromUrl("https://goldcaps.co")
        expect(result.ok).toBe(true)
        if (result.ok) {
            expect(result.data.products[0]).toMatchObject({ name: "Gorra Trucker", price: 30000 })
            expect(result.data.products[0].imageUrl).toBe("https://goldcaps.co/img/gorra.jpg")
        }
    })

    it("JSON-LD tiene prioridad; el LLM completa productos faltantes (merge + dedup)", async () => {
        const html = `<html><body><script type="application/ld+json">${JSON.stringify({
            "@type": "Product", name: "Gorra A", offers: { price: "20000" },
        })}</script></body></html>`
        stubFetch(html)
        mockCreateMessage.mockResolvedValue(llmReply({
            products: [
                { name: "Gorra A", price: 999 },          // dup → se ignora (gana JSON-LD)
                { name: "Gorra B", price: "$45.000" },    // nuevo → entra
            ],
        }))

        const result = await extractStoreFromUrl("https://goldcaps.co")
        expect(result.ok).toBe(true)
        if (result.ok) {
            const a = result.data.products.find((p) => p.name === "Gorra A")
            const b = result.data.products.find((p) => p.name === "Gorra B")
            expect(a?.price).toBe(20000)   // de JSON-LD, no el 999 del LLM
            expect(b?.price).toBe(45000)
        }
    })

    it("sitio sin productos → error claro", async () => {
        stubFetch("<html><body><h1>Blog</h1></body></html>")
        const result = await extractStoreFromUrl("https://ejemplo.com")
        expect(result.ok).toBe(false)
    })

    it("fetch caído → error, nunca lanza", async () => {
        stubFetch("", false)
        const result = await extractStoreFromUrl("https://caido.com")
        expect(result.ok).toBe(false)
    })

    it("LLM lanza excepción → cae a JSON-LD sin romper", async () => {
        const html = `<html><body><script type="application/ld+json">${JSON.stringify({
            "@type": "Product", name: "Solo JSON-LD", offers: { price: "10000" },
        })}</script></body></html>`
        stubFetch(html)
        mockCreateMessage.mockRejectedValue(new Error("anthropic down"))

        const result = await extractStoreFromUrl("https://x.com")
        expect(result.ok).toBe(true)
        if (result.ok) expect(result.data.products).toHaveLength(1)
    })
})
