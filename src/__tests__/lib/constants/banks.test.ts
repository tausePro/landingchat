/**
 * Tests para `banks.ts` (T1.5 — Manual payment country-aware).
 */

import { describe, expect, it } from "vitest"

import {
  BANKS_BY_COUNTRY,
  COLOMBIA_BANKS,
  US_BANKS,
  getBanksForCountry,
} from "@/lib/constants/banks"
import type { SupportedCountry } from "@/types/organization"

describe("BANKS_BY_COUNTRY — registry", () => {
  it("tiene una entrada por SupportedCountry", () => {
    const expected: SupportedCountry[] = ["CO", "US"]
    expect(Object.keys(BANKS_BY_COUNTRY).sort()).toEqual(expected.sort())
  })

  it("CO incluye los bancos colombianos comunes", () => {
    expect(COLOMBIA_BANKS).toContain("Bancolombia")
    expect(COLOMBIA_BANKS).toContain("Davivienda")
    expect(COLOMBIA_BANKS).toContain("BBVA")
    expect(COLOMBIA_BANKS).toContain("Nequi")
    expect(COLOMBIA_BANKS).toContain("Daviplata")
  })

  it("US incluye los bancos estadounidenses principales", () => {
    expect(US_BANKS).toContain("Chase")
    expect(US_BANKS).toContain("Bank of America")
    expect(US_BANKS).toContain("Wells Fargo")
    expect(US_BANKS).toContain("Citibank")
    expect(US_BANKS).toContain("Capital One")
  })

  it("CO y US no comparten bancos (no overlap accidental)", () => {
    const intersection = COLOMBIA_BANKS.filter((b) =>
      (US_BANKS as readonly string[]).includes(b),
    )
    expect(intersection).toEqual([])
  })
})

describe("getBanksForCountry — defensivo", () => {
  it("retorna COLOMBIA_BANKS para 'CO'", () => {
    expect(getBanksForCountry("CO")).toBe(COLOMBIA_BANKS)
  })

  it("retorna US_BANKS para 'US'", () => {
    expect(getBanksForCountry("US")).toBe(US_BANKS)
  })

  it("cae a COLOMBIA_BANKS para undefined/null/inválido", () => {
    expect(getBanksForCountry(undefined)).toBe(COLOMBIA_BANKS)
    expect(getBanksForCountry(null)).toBe(COLOMBIA_BANKS)
    expect(getBanksForCountry("MX" as SupportedCountry)).toBe(COLOMBIA_BANKS)
  })
})
