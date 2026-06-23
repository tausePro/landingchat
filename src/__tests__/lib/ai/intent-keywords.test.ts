import { describe, it, expect } from "vitest"
import { extractIntentKeywords } from "@/lib/ai/executors/ecommerce"

describe("extractIntentKeywords", () => {
    it("extrae keywords de una frase NL (quita stopwords, cortas y acentos)", () => {
        expect(
            extractIntentKeywords("arena neutralizadora de olores para gato senior exigente"),
        ).toEqual(["arena", "neutralizadora", "olores", "gato", "senior", "exigente"])
    })

    it("quita verbos de intención y palabras de < 3 letras", () => {
        expect(extractIntentKeywords("quiero algo para mi piel sensible")).toEqual(["piel", "sensible"])
    })

    it("normaliza acentos (para que matcheen igual)", () => {
        expect(extractIntentKeywords("loción hidratante")).toEqual(["locion", "hidratante"])
    })

    it("intención vacía → sin keywords", () => {
        expect(extractIntentKeywords("")).toEqual([])
    })

    it("dedup + tope de 6 keywords", () => {
        const result = extractIntentKeywords("rojo rojo azul verde amarillo negro blanco gris")
        expect(result.length).toBeLessThanOrEqual(6)
        expect(new Set(result).size).toBe(result.length)
    })
})
