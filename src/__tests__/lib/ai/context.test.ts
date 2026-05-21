import { describe, expect, it } from "vitest"
import { buildSystemPromptOptimized } from "@/lib/ai/context"

// ============================================================================
// T1.7 — Locale-aware language instruction
// ============================================================================

describe("buildSystemPromptOptimized — locale awareness (T1.7)", () => {
    const baseAgent = {
        name: "Asesor",
        system_prompt: "Eres asesor de ventas de la tienda.",
    }

    it("default es-CO: NO inyecta bloque de instrucción de idioma", () => {
        const prompt = buildSystemPromptOptimized(baseAgent, "Tienda", 1)
        // Las instrucciones procedurales del prompt ya están en español, no hace
        // falta forzar el idioma al modelo.
        expect(prompt).not.toContain("RESPONSE LANGUAGE")
        expect(prompt).not.toContain("MUST respond ONLY in English")
    })

    it("es-CO explicito: NO inyecta bloque de instrucción de idioma", () => {
        const prompt = buildSystemPromptOptimized(
            baseAgent,
            "Tienda",
            1,
            undefined,
            undefined,
            "es-CO",
        )
        expect(prompt).not.toContain("RESPONSE LANGUAGE")
    })

    it("en-US: inyecta bloque crítico forzando inglés al inicio", () => {
        const prompt = buildSystemPromptOptimized(
            baseAgent,
            "Tantor's House",
            5,
            undefined,
            undefined,
            "en-US",
        )

        // El bloque debe estar al INICIO del prompt (no al final, donde el
        // modelo le da menos peso) y mencionar el formato USD.
        expect(prompt.startsWith("RESPONSE LANGUAGE (CRITICAL)")).toBe(true)
        expect(prompt).toContain("MUST respond ONLY in English (en-US)")
        expect(prompt).toContain("US currency formatting ($X.XX)")
    })

    it("en-US: el prompt original en español aún se incluye después del bloque inglés", () => {
        // Garantiza que las 280 LOC de instrucciones procedurales en español
        // NO se pierden — solo se prependa la instrucción de idioma. El
        // modelo entiende español y responde en inglés.
        const prompt = buildSystemPromptOptimized(
            baseAgent,
            "Tantor's House",
            1,
            undefined,
            undefined,
            "en-US",
        )
        expect(prompt).toContain("RESPONSE LANGUAGE (CRITICAL)")
        // El prompt base sigue ahí (no traducimos las instrucciones internas)
        expect(prompt).toMatch(/Eres asesor|REGLAS|HERRAMIENTAS|CATÁLOGO/)
    })

    it("locale desconocido (e.g. fr-FR): cae al comportamiento default es-CO", () => {
        const prompt = buildSystemPromptOptimized(
            baseAgent,
            "Tienda",
            1,
            undefined,
            undefined,
            "fr-FR",
        )
        // No reconocemos fr-FR, así que no inyectamos instrucción inglés.
        // El prompt sale en español por default — comportamiento conservador.
        expect(prompt).not.toContain("RESPONSE LANGUAGE")
    })
})

describe("AI context product variants", () => {
  it("incluye todas las opciones disponibles del producto actual", () => {
    const prompt = buildSystemPromptOptimized(
      {
        name: "Asesor",
        system_prompt: "Eres asesor de ventas de la tienda.",
      },
      "Tienda",
      1,
      undefined,
      {
        id: "product-1",
        name: "Arena ecológica para gato",
        price: 50000,
        stock: 6,
        variant_options: [
          { name: "Aroma", values: ["Carbón activado", "Lavanda"] },
        ],
        available_variants: [
          {
            title: "Carbón activado",
            price: 50000,
            compare_at_price: null,
            stock: 2,
            available: true,
          },
          {
            title: "Lavanda",
            price: 52000,
            compare_at_price: null,
            stock: 4,
            available: true,
          },
        ],
      },
    )

    expect(prompt).toContain("VARIANTES/OPCIONES DISPONIBLES")
    expect(prompt).toContain("- Aroma: Carbón activado, Lavanda")
    expect(prompt).toContain("- Carbón activado: $50,000, stock 2")
    expect(prompt).toContain("- Lavanda: $52,000, stock 4")
    expect(prompt).toContain("responde con TODAS las opciones disponibles")
  })
})
