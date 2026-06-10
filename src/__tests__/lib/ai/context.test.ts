import { describe, expect, it } from "vitest"
import { buildCustomerContext, buildSystemPromptOptimized } from "@/lib/ai/context"

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

// ============================================================================
// Personalización por historial — buildCustomerContext
// ============================================================================

describe("buildCustomerContext — personalización por historial", () => {
  const customer = {
    id: "cust-1",
    full_name: "Ana Gómez",
    email: "ana@example.com",
    phone: "+57 300 000 0000",
  }

  it("cliente no identificado: pide identify_customer", () => {
    const ctx = buildCustomerContext(undefined, undefined)
    expect(ctx).toContain("Cliente no identificado")
    expect(ctx).toContain("identify_customer")
  })

  it("cliente sin órdenes: lo marca como nuevo y NO inyecta historial de productos", () => {
    const ctx = buildCustomerContext(customer, [])
    expect(ctx).toContain("Es un cliente nuevo o sin compras previas")
    expect(ctx).not.toContain("PRODUCTOS QUE YA HA COMPRADO")
  })

  it("con órdenes: lista productos comprados + directiva de personalización", () => {
    const ctx = buildCustomerContext(customer, [
      {
        id: "o2",
        created_at: "2026-05-01T10:00:00Z",
        total: 80000,
        status: "paid",
        items: [{ name: "Snack para perro", quantity: 2 }],
      },
      {
        id: "o1",
        created_at: "2026-03-01T10:00:00Z",
        total: 50000,
        status: "paid",
        items: [
          { name: "Snack para perro", quantity: 1 },
          { name: "Collar antipulgas", quantity: 1 },
        ],
      },
    ])

    expect(ctx).toContain("PRODUCTOS QUE YA HA COMPRADO")
    // Agrega cantidades por nombre a través de órdenes (2 + 1 = 3)
    expect(ctx).toContain("- Snack para perro (x3 en total)")
    expect(ctx).toContain("- Collar antipulgas")
    expect(ctx).toContain("USA ESTE HISTORIAL PARA PERSONALIZAR")
    expect(ctx).toContain("search_products")
  })

  it("preserva el orden más reciente primero (la orden más nueva manda)", () => {
    const ctx = buildCustomerContext(customer, [
      {
        id: "o2",
        created_at: "2026-05-01T10:00:00Z",
        total: 30000,
        status: "paid",
        items: [{ name: "Producto Reciente", quantity: 1 }],
      },
      {
        id: "o1",
        created_at: "2026-01-01T10:00:00Z",
        total: 30000,
        status: "paid",
        items: [{ name: "Producto Viejo", quantity: 1 }],
      },
    ])

    const idxReciente = ctx.indexOf("Producto Reciente")
    const idxViejo = ctx.indexOf("Producto Viejo")
    expect(idxReciente).toBeGreaterThan(-1)
    expect(idxViejo).toBeGreaterThan(-1)
    expect(idxReciente).toBeLessThan(idxViejo)
  })

  it("ignora items sin nombre y limita a 8 productos", () => {
    const items = Array.from({ length: 12 }, (_, i) => ({ name: `Prod ${i}`, quantity: 1 }))
    items.push({ name: "", quantity: 3 } as { name: string; quantity: number })
    const ctx = buildCustomerContext(customer, [
      { id: "o1", created_at: "2026-05-01T10:00:00Z", total: 100000, status: "paid", items },
    ])

    // Solo 8 líneas de producto (cap), sin la entrada vacía
    const productLines = ctx.split("\n").filter(l => /^- Prod \d/.test(l))
    expect(productLines.length).toBe(8)
  })
})
