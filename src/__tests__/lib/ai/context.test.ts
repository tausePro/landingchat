import { describe, expect, it } from "vitest"
import { buildSystemPromptOptimized } from "@/lib/ai/context"

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
