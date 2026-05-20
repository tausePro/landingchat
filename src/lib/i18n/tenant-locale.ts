/**
 * Helpers para resolver el contexto de localización (idioma + moneda + país)
 * de una organización (tenant).
 *
 * Fase 1 — single-locale-per-tenant: cada tenant tiene un idioma + moneda
 * fijos definidos por el dueño / superadmin. No hay selector de moneda por
 * cliente final (eso es Fase 2: presentment currency).
 *
 * Spec: .kiro/specs/i18n-fase-1/
 */

import type {
  Organization,
  SupportedCountry,
  SupportedCurrency,
  SupportedLocale,
} from "@/types/organization"

/**
 * Contexto de localización de un tenant. Lo usan helpers como `formatCurrency`,
 * el diccionario i18n del storefront, los formularios country-aware, los
 * templates de email y el system prompt del agente AI.
 */
export interface TenantLocaleContext {
  currency: SupportedCurrency
  locale: SupportedLocale
  country: SupportedCountry
}

/**
 * Default seguro para tenants sin override explícito.
 *
 * Coincide con los `DEFAULT` del schema (`migrations/20260519_organizations_locale_currency.sql`).
 * Al introducir esta capa todas las organizaciones existentes quedan en este
 * default sin tocar UI ni datos.
 */
export const DEFAULT_TENANT_LOCALE: TenantLocaleContext = Object.freeze({
  currency: "COP",
  locale: "es-CO",
  country: "CO",
})

/**
 * Subset mínimo de campos necesarios para derivar el `TenantLocaleContext`.
 * Útil para llamadores que solo tienen un proyectado parcial de `Organization`.
 */
export type TenantLocaleSource = Pick<
  Organization,
  "currency_code" | "locale" | "country_code"
>

/**
 * Resuelve el contexto de localización de un tenant a partir de una
 * organización (full o parcial). Cualquier campo ausente cae al default
 * seguro (`COP / es-CO / CO`).
 *
 * Ejemplos:
 * ```ts
 * getTenantLocale({ currency_code: "USD", locale: "en-US", country_code: "US" })
 * // → { currency: "USD", locale: "en-US", country: "US" }
 *
 * getTenantLocale({})
 * // → { currency: "COP", locale: "es-CO", country: "CO" }
 *
 * getTenantLocale(null)
 * // → { currency: "COP", locale: "es-CO", country: "CO" }
 * ```
 */
export function getTenantLocale(
  organization: TenantLocaleSource | null | undefined
): TenantLocaleContext {
  if (!organization) {
    return DEFAULT_TENANT_LOCALE
  }

  return {
    currency: organization.currency_code ?? DEFAULT_TENANT_LOCALE.currency,
    locale: organization.locale ?? DEFAULT_TENANT_LOCALE.locale,
    country: organization.country_code ?? DEFAULT_TENANT_LOCALE.country,
  }
}

/**
 * Type guard runtime para validar que un string es un `SupportedCurrency`.
 * Útil al leer valores de fuentes externas (URL params, cookies, etc.).
 */
export function isSupportedCurrency(value: unknown): value is SupportedCurrency {
  return value === "COP" || value === "USD"
}

/**
 * Type guard runtime para validar que un string es un `SupportedLocale`.
 */
export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return value === "es-CO" || value === "en-US"
}

/**
 * Type guard runtime para validar que un string es un `SupportedCountry`.
 */
export function isSupportedCountry(value: unknown): value is SupportedCountry {
  return value === "CO" || value === "US"
}
