/**
 * Tests para `country-profiles.ts` (T1.4 — Forms country-aware).
 *
 * Cubren:
 * - Cada `SupportedCountry` tiene un profile completo (sin campos NULL).
 * - Los valores específicos de CO/US son los esperados (phone prefix, flag,
 *   defaults, etc.).
 * - `getCountryProfile()` es defensivo: retorna CO para inputs inválidos.
 * - Las keys i18n referenciadas en cada profile existen en el diccionario.
 */

import { describe, expect, it } from "vitest"

import {
  COUNTRY_PROFILES,
  getCountryProfile,
} from "@/lib/i18n/country-profiles"
import { COLOMBIA_DEPARTMENTS } from "@/lib/constants/colombia-departments"
import { US_STATES } from "@/lib/constants/us-states"
import { storefrontStrings } from "@/lib/i18n/storefront-strings"
import type { SupportedCountry } from "@/types/organization"

describe("COUNTRY_PROFILES — registry completo", () => {
  it("tiene exactamente un profile por SupportedCountry", () => {
    const expectedCountries: SupportedCountry[] = ["CO", "US"]
    const profileCountries = Object.keys(COUNTRY_PROFILES) as SupportedCountry[]
    expect(profileCountries.sort()).toEqual(expectedCountries.sort())
  })

  it("cada profile tiene todos los campos requeridos", () => {
    for (const profile of Object.values(COUNTRY_PROFILES)) {
      expect(profile.phonePrefix).toBeTruthy()
      expect(profile.phoneFlag).toBeTruthy()
      expect(profile.phonePlaceholderKey).toBeTruthy()
      expect(profile.documentTypes.length).toBeGreaterThan(0)
      expect(profile.defaultDocumentType).toBeTruthy()
      expect(profile.documentNumberPlaceholderKey).toBeTruthy()
      expect(profile.personTypeOptions.length).toBe(2)
      expect(profile.defaultPersonType).toBeTruthy()
      expect(profile.states.length).toBeGreaterThan(0)
      expect(profile.stateLabelKey).toBeTruthy()
      expect(profile.statePlaceholderKey).toBeTruthy()
      expect(profile.cityPlaceholderKey).toBeTruthy()
      expect(profile.addressPlaceholderKey).toBeTruthy()
      expect(profile.metaPixelCountry).toMatch(/^[a-z]{2}$/)
    }
  })
})

describe("COUNTRY_PROFILES.CO — Colombia", () => {
  const co = COUNTRY_PROFILES.CO

  it("phone es +57 con flag de Colombia", () => {
    expect(co.phonePrefix).toBe("+57")
    expect(co.phoneFlag).toBe("🇨🇴")
  })

  it("documento default es CC e incluye CC, NIT, CE, Passport, TI", () => {
    expect(co.defaultDocumentType).toBe("CC")
    const values = co.documentTypes.map((d) => d.value)
    expect(values).toContain("CC")
    expect(values).toContain("NIT")
    expect(values).toContain("CE")
    expect(values).toContain("Passport")
    expect(values).toContain("TI")
  })

  it("person type default es Natural con opciones Natural/Jurídica", () => {
    expect(co.defaultPersonType).toBe("Natural")
    const values = co.personTypeOptions.map((p) => p.value)
    expect(values).toEqual(["Natural", "Jurídica"])
  })

  it("states son los 32 departamentos de COLOMBIA_DEPARTMENTS", () => {
    expect(co.states).toBe(COLOMBIA_DEPARTMENTS)
    expect(co.states.length).toBe(33)
  })

  it("metaPixelCountry es 'co' (lowercase ISO)", () => {
    expect(co.metaPixelCountry).toBe("co")
  })
})

describe("COUNTRY_PROFILES.US — Estados Unidos", () => {
  const us = COUNTRY_PROFILES.US

  it("phone es +1 con flag de US", () => {
    expect(us.phonePrefix).toBe("+1")
    expect(us.phoneFlag).toBe("🇺🇸")
  })

  it("documento default es SSN e incluye SSN, EIN, Passport", () => {
    expect(us.defaultDocumentType).toBe("SSN")
    const values = us.documentTypes.map((d) => d.value)
    expect(values).toContain("SSN")
    expect(values).toContain("EIN")
    expect(values).toContain("Passport")
  })

  it("person type default es Natural (compat DB) con opciones Natural/Jurídica", () => {
    // Mantenemos los mismos `value` ('Natural'/'Jurídica') para compat con la
    // DB existente, pero los `labelKey` apuntan a 'Individual'/'Business'.
    expect(us.defaultPersonType).toBe("Natural")
    const values = us.personTypeOptions.map((p) => p.value)
    expect(values).toEqual(["Natural", "Jurídica"])
  })

  it("person type labels usan keys US-specific (Individual/Business)", () => {
    const labelKeys = us.personTypeOptions.map((p) => p.labelKey)
    expect(labelKeys).toEqual([
      "store.checkout.billing_person_individual",
      "store.checkout.billing_person_business",
    ])
  })

  it("states son los US_STATES (50 + DC + Puerto Rico)", () => {
    expect(us.states).toBe(US_STATES)
    expect(us.states.length).toBe(52)
    expect(us.states).toContain("California")
    expect(us.states).toContain("New York")
    expect(us.states).toContain("Puerto Rico")
  })

  it("metaPixelCountry es 'us' (lowercase ISO)", () => {
    expect(us.metaPixelCountry).toBe("us")
  })
})

describe("getCountryProfile — defensivo contra inputs inválidos", () => {
  it("retorna profile CO para 'CO'", () => {
    expect(getCountryProfile("CO")).toBe(COUNTRY_PROFILES.CO)
  })

  it("retorna profile US para 'US'", () => {
    expect(getCountryProfile("US")).toBe(COUNTRY_PROFILES.US)
  })

  it("retorna profile CO para undefined", () => {
    expect(getCountryProfile(undefined)).toBe(COUNTRY_PROFILES.CO)
  })

  it("retorna profile CO para null", () => {
    expect(getCountryProfile(null)).toBe(COUNTRY_PROFILES.CO)
  })

  it("retorna profile CO para countries no soportados (cast unsafe)", () => {
    expect(getCountryProfile("MX" as SupportedCountry)).toBe(
      COUNTRY_PROFILES.CO,
    )
    expect(getCountryProfile("" as SupportedCountry)).toBe(COUNTRY_PROFILES.CO)
  })
})

describe("country-profiles — keys i18n existen en el diccionario", () => {
  it("todas las keys referenciadas en CO existen en es-CO y en-US", () => {
    const co = COUNTRY_PROFILES.CO
    const keys = [
      co.phonePlaceholderKey,
      co.documentNumberPlaceholderKey,
      co.stateLabelKey,
      co.statePlaceholderKey,
      co.cityPlaceholderKey,
      co.addressPlaceholderKey,
      ...co.personTypeOptions.map((p) => p.labelKey),
    ]
    for (const key of keys) {
      expect(storefrontStrings["es-CO"][key], `falta es-CO: ${key}`).toBeTruthy()
      expect(storefrontStrings["en-US"][key], `falta en-US: ${key}`).toBeTruthy()
    }
  })

  it("todas las keys referenciadas en US existen en es-CO y en-US", () => {
    const us = COUNTRY_PROFILES.US
    const keys = [
      us.phonePlaceholderKey,
      us.documentNumberPlaceholderKey,
      us.stateLabelKey,
      us.statePlaceholderKey,
      us.cityPlaceholderKey,
      us.addressPlaceholderKey,
      ...us.personTypeOptions.map((p) => p.labelKey),
    ]
    for (const key of keys) {
      expect(storefrontStrings["es-CO"][key], `falta es-CO: ${key}`).toBeTruthy()
      expect(storefrontStrings["en-US"][key], `falta en-US: ${key}`).toBeTruthy()
    }
  })
})
