/**
 * Tests para `src/lib/i18n/tenant-locale.ts` — helpers de localización tenant.
 *
 * Spec: .kiro/specs/i18n-fase-1/ (T1.1)
 */

import { describe, expect, it } from "vitest"

import {
  DEFAULT_TENANT_LOCALE,
  getTenantLocale,
  isSupportedCountry,
  isSupportedCurrency,
  isSupportedLocale,
} from "@/lib/i18n/tenant-locale"

describe("DEFAULT_TENANT_LOCALE", () => {
  it("coincide con los DEFAULT del schema (COP / es-CO / CO)", () => {
    expect(DEFAULT_TENANT_LOCALE).toEqual({
      currency: "COP",
      locale: "es-CO",
      country: "CO",
    })
  })

  it("es inmutable (Object.freeze) para evitar mutaciones accidentales", () => {
    expect(Object.isFrozen(DEFAULT_TENANT_LOCALE)).toBe(true)
  })
})

describe("getTenantLocale", () => {
  it("retorna defaults seguros cuando la organización es null", () => {
    expect(getTenantLocale(null)).toEqual(DEFAULT_TENANT_LOCALE)
  })

  it("retorna defaults seguros cuando la organización es undefined", () => {
    expect(getTenantLocale(undefined)).toEqual(DEFAULT_TENANT_LOCALE)
  })

  it("retorna defaults cuando los campos i18n están ausentes", () => {
    expect(getTenantLocale({})).toEqual(DEFAULT_TENANT_LOCALE)
  })

  it("respeta currency_code='USD' cuando está presente", () => {
    expect(
      getTenantLocale({ currency_code: "USD", locale: "en-US", country_code: "US" })
    ).toEqual({
      currency: "USD",
      locale: "en-US",
      country: "US",
    })
  })

  it("usa default cuando solo viene currency_code", () => {
    expect(getTenantLocale({ currency_code: "USD" })).toEqual({
      currency: "USD",
      locale: "es-CO",
      country: "CO",
    })
  })

  it("respeta valores parciales y completa el resto con defaults", () => {
    expect(
      getTenantLocale({
        currency_code: "COP",
        country_code: "US",
      })
    ).toEqual({
      currency: "COP",
      locale: "es-CO",
      country: "US",
    })
  })

  it("ignora campos no relacionados al locale del subset", () => {
    // El helper solo lee los 3 campos relevantes; otros campos del Organization
    // no deberían afectar el resultado.
    const result = getTenantLocale({
      currency_code: "USD",
      locale: "en-US",
      country_code: "US",
    } as Parameters<typeof getTenantLocale>[0])
    expect(result).toEqual({
      currency: "USD",
      locale: "en-US",
      country: "US",
    })
  })
})

describe("isSupportedCurrency", () => {
  it("acepta valores válidos", () => {
    expect(isSupportedCurrency("COP")).toBe(true)
    expect(isSupportedCurrency("USD")).toBe(true)
  })

  it("rechaza valores fuera del set Fase 1", () => {
    expect(isSupportedCurrency("EUR")).toBe(false)
    expect(isSupportedCurrency("MXN")).toBe(false)
    expect(isSupportedCurrency("cop")).toBe(false) // case sensitive
    expect(isSupportedCurrency("")).toBe(false)
    expect(isSupportedCurrency(null)).toBe(false)
    expect(isSupportedCurrency(undefined)).toBe(false)
    expect(isSupportedCurrency(0)).toBe(false)
  })
})

describe("isSupportedLocale", () => {
  it("acepta valores válidos", () => {
    expect(isSupportedLocale("es-CO")).toBe(true)
    expect(isSupportedLocale("en-US")).toBe(true)
  })

  it("rechaza valores fuera del set Fase 1", () => {
    expect(isSupportedLocale("es-MX")).toBe(false)
    expect(isSupportedLocale("pt-BR")).toBe(false)
    expect(isSupportedLocale("es")).toBe(false) // sin región
    expect(isSupportedLocale("EN-us")).toBe(false) // case sensitive
    expect(isSupportedLocale(null)).toBe(false)
  })
})

describe("isSupportedCountry", () => {
  it("acepta valores válidos", () => {
    expect(isSupportedCountry("CO")).toBe(true)
    expect(isSupportedCountry("US")).toBe(true)
  })

  it("rechaza valores fuera del set Fase 1", () => {
    expect(isSupportedCountry("MX")).toBe(false)
    expect(isSupportedCountry("ES")).toBe(false)
    expect(isSupportedCountry("co")).toBe(false) // case sensitive
    expect(isSupportedCountry("USA")).toBe(false) // alpha-3 no permitido
    expect(isSupportedCountry(null)).toBe(false)
  })
})
