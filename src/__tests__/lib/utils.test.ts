/**
 * Tests para `src/lib/utils.ts:formatCurrency()`.
 *
 * Cubre:
 * - Backward compat: sin opciones → idéntico al legacy (COP/es-CO/0 decimales).
 * - Contexto del tenant: COP+es-CO, USD+en-US.
 * - Override explícito de fractionDigits.
 * - Casos borde (0, negativos, decimales con COP).
 *
 * Estrategia de assertions:
 * Usamos comparaciones semánticas (símbolo de moneda + dígitos + separadores)
 * en vez de byte-perfect, porque `Intl.NumberFormat` puede emitir NBSP
 * (U+00A0) en algunos locales y eso es frágil cross-environment.
 * Para los casos donde queremos exactitud, comparamos contra el output del
 * propio `Intl.NumberFormat` invocado con los mismos parámetros (fuente de
 * verdad).
 *
 * Spec: .kiro/specs/i18n-fase-1/ (T1.2)
 */

import { describe, expect, it } from "vitest"

import { formatCurrency } from "@/lib/utils"
import { getTenantLocale } from "@/lib/i18n/tenant-locale"

/**
 * Helper para comparar contra el output canónico de Intl.NumberFormat.
 * Si `formatCurrency` llama internamente a Intl con los mismos parámetros,
 * el output debe coincidir exactamente.
 */
function intlFormat(
  amount: number,
  locale: string,
  currency: string,
  digits: number
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount)
}

describe("formatCurrency() — backward compatibility", () => {
  it("sin opciones, retorna formato legacy COP/es-CO/0 decimales", () => {
    const result = formatCurrency(1234567)
    expect(result).toBe(intlFormat(1234567, "es-CO", "COP", 0))
  })

  it("sin opciones, redondea decimales a 0", () => {
    const result = formatCurrency(99.99)
    expect(result).toBe(intlFormat(99.99, "es-CO", "COP", 0))
  })

  it("sin opciones, maneja amount = 0", () => {
    const result = formatCurrency(0)
    expect(result).toBe(intlFormat(0, "es-CO", "COP", 0))
    expect(result).toMatch(/\$\s?0$/)
  })

  it("sin opciones, maneja amounts negativos", () => {
    const result = formatCurrency(-1000)
    expect(result).toBe(intlFormat(-1000, "es-CO", "COP", 0))
    expect(result).toContain("-")
  })

  it("sin opciones, contiene el símbolo '$' y los dígitos del monto", () => {
    const result = formatCurrency(1234567)
    expect(result).toContain("$")
    // Separador puede ser '.' o ',' según locale; verificamos los dígitos.
    expect(result.replace(/\D/g, "")).toBe("1234567")
  })
})

describe("formatCurrency() — contexto del tenant (USD/en-US)", () => {
  it("USD/en-US retorna formato con 2 decimales y separador de miles ','", () => {
    const result = formatCurrency(1234.56, { currency: "USD", locale: "en-US" })
    expect(result).toBe(intlFormat(1234.56, "en-US", "USD", 2))
    expect(result).toBe("$1,234.56")
  })

  it("USD/en-US redondea correctamente a 2 decimales", () => {
    const result = formatCurrency(99.999, { currency: "USD", locale: "en-US" })
    expect(result).toBe("$100.00")
  })

  it("USD/en-US con amount entero muestra los .00", () => {
    const result = formatCurrency(100, { currency: "USD", locale: "en-US" })
    expect(result).toBe("$100.00")
  })

  it("USD/en-US con 0 muestra $0.00", () => {
    const result = formatCurrency(0, { currency: "USD", locale: "en-US" })
    expect(result).toBe("$0.00")
  })

  it("USD/en-US con negativo formatea correctamente", () => {
    const result = formatCurrency(-50, { currency: "USD", locale: "en-US" })
    expect(result).toBe("-$50.00")
  })
})

describe("formatCurrency() — contexto explícito COP/es-CO", () => {
  it("pasar COP/es-CO explícito coincide con default", () => {
    const withOpts = formatCurrency(1234567, { currency: "COP", locale: "es-CO" })
    const withoutOpts = formatCurrency(1234567)
    expect(withOpts).toBe(withoutOpts)
  })
})

describe("formatCurrency() — override de fractionDigits", () => {
  it("COP con fractionDigits=2 muestra 2 decimales", () => {
    const result = formatCurrency(100, {
      currency: "COP",
      locale: "es-CO",
      fractionDigits: 2,
    })
    expect(result).toBe(intlFormat(100, "es-CO", "COP", 2))
    // Debe terminar con ,00 (separador decimal es-CO)
    expect(result).toMatch(/,00$/)
  })

  it("USD con fractionDigits=0 muestra sin decimales", () => {
    const result = formatCurrency(100, {
      currency: "USD",
      locale: "en-US",
      fractionDigits: 0,
    })
    expect(result).toBe(intlFormat(100, "en-US", "USD", 0))
    expect(result).toBe("$100")
  })

  it("USD con fractionDigits=4 muestra 4 decimales", () => {
    const result = formatCurrency(1.12345, {
      currency: "USD",
      locale: "en-US",
      fractionDigits: 4,
    })
    expect(result).toBe("$1.1235") // redondeo
  })
})

describe("formatCurrency() — integración con getTenantLocale()", () => {
  it("default tenant context (org vacía) formatea como COP/es-CO", () => {
    const locale = getTenantLocale({})
    const result = formatCurrency(1000, locale)
    expect(result).toBe(formatCurrency(1000))
  })

  it("tenant USD/en-US/US formatea con 2 decimales y separador inglés", () => {
    const locale = getTenantLocale({
      currency_code: "USD",
      locale: "en-US",
      country_code: "US",
    })
    const result = formatCurrency(2500.5, locale)
    expect(result).toBe("$2,500.50")
  })

  it("tenant null/undefined cae al default seguro", () => {
    const locale = getTenantLocale(null)
    const result = formatCurrency(1000, locale)
    expect(result).toBe(formatCurrency(1000))
  })
})
