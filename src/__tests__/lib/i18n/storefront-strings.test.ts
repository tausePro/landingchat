/**
 * Tests para `src/lib/i18n/storefront-strings.ts`.
 *
 * Cubre:
 * - Lookup directo en es-CO y en-US.
 * - Fallback a es-CO cuando el locale no es soportado.
 * - Fallback a es-CO cuando la key existe en es-CO pero no en otro locale.
 * - Last-resort fallback (devolver la key) cuando ni es-CO la tiene.
 * - Consistencia del set de keys entre locales (en-US no debe tener keys
 *   que no existan en es-CO).
 *
 * Spec: .kiro/specs/i18n-fase-1/ (T1.3)
 */

import { describe, expect, it } from "vitest"

import {
  storefrontStrings,
  t,
  type StorefrontStringKey,
} from "@/lib/i18n/storefront-strings"

describe("storefrontStrings — estructura", () => {
  it("contiene los locales es-CO y en-US", () => {
    expect(storefrontStrings).toHaveProperty("es-CO")
    expect(storefrontStrings).toHaveProperty("en-US")
  })

  it("en-US tiene exactamente las mismas keys que es-CO (paridad)", () => {
    const esKeys = Object.keys(storefrontStrings["es-CO"]).sort()
    const enKeys = Object.keys(storefrontStrings["en-US"]).sort()
    expect(enKeys).toEqual(esKeys)
  })

  it("toda key tiene un valor string no vacío en es-CO", () => {
    for (const [key, value] of Object.entries(storefrontStrings["es-CO"])) {
      expect(typeof value).toBe("string")
      expect(value.length).toBeGreaterThan(0)
      // No debe ser igual a la key (síntoma de placeholder olvidado).
      expect(value).not.toBe(key)
    }
  })

  it("toda key tiene un valor string no vacío en en-US", () => {
    for (const [key, value] of Object.entries(storefrontStrings["en-US"])) {
      expect(typeof value).toBe("string")
      expect(value.length).toBeGreaterThan(0)
      expect(value).not.toBe(key)
    }
  })
})

describe("t() — lookups directos", () => {
  it("retorna string en es-CO sin locale explícito (default)", () => {
    expect(t("order.success.title")).toBe("¡Pago Exitoso!")
  })

  it("retorna string en es-CO con locale explícito", () => {
    expect(t("order.success.title", "es-CO")).toBe("¡Pago Exitoso!")
  })

  it("retorna string en en-US", () => {
    expect(t("order.success.title", "en-US")).toBe("Payment Successful!")
  })

  it("strings de áreas distintas se resuelven correctamente", () => {
    expect(t("order.pending.title", "en-US")).toBe("Payment Pending")
    expect(t("order.error.title", "en-US")).toBe("Payment Not Completed")
    expect(t("order.common.back_to_store", "en-US")).toBe("Back to Store")
    expect(t("order.status.confirmed", "en-US")).toBe("Confirmed")
  })
})

describe("t() — fallbacks", () => {
  it("locale no soportado → cae a es-CO", () => {
    // Cast deliberado para simular un locale fuera del set.
    const result = t("order.success.title", "fr-FR" as never)
    expect(result).toBe("¡Pago Exitoso!")
  })

  it("key inexistente devuelve la key como last resort", () => {
    const fakeKey = "order.no.such.key" as StorefrontStringKey
    expect(t(fakeKey)).toBe("order.no.such.key")
    expect(t(fakeKey, "en-US")).toBe("order.no.such.key")
  })
})

describe("t() — integridad del set", () => {
  it("todas las keys producen strings en ambos locales", () => {
    const keys = Object.keys(storefrontStrings["es-CO"]) as StorefrontStringKey[]
    for (const key of keys) {
      expect(typeof t(key, "es-CO")).toBe("string")
      expect(typeof t(key, "en-US")).toBe("string")
    }
  })

  it("strings es-CO y en-US son distintos para keys que tienen traducción real", () => {
    // No comparamos todas las keys (algunas podrían coincidir, ej. "Error"),
    // pero verificamos un sample de strings notoriamente distintos.
    const samples: StorefrontStringKey[] = [
      "order.success.title",
      "order.success.message",
      "order.common.back_to_store",
      "order.error.help_verify_card",
    ]
    for (const key of samples) {
      expect(t(key, "es-CO")).not.toBe(t(key, "en-US"))
    }
  })
})
