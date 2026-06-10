/**
 * Schema y opciones para editar la localización de un tenant
 * (moneda + idioma + país) desde UI.
 *
 * Client-safe: lo importan tanto los forms (dashboard/admin) como las
 * server actions que validan el input. Los valores permitidos deben
 * mantenerse en sync con los CHECK constraints de
 * `migrations/20260519_organizations_locale_currency.sql` y con los
 * type guards de `src/lib/i18n/tenant-locale.ts`.
 *
 * Fase 1 — single-locale-per-tenant: solo COP/es-CO/CO y USD/en-US/US.
 */

import { z } from "zod"

export const localeSettingsSchema = z.object({
  currency_code: z.enum(["COP", "USD"]),
  locale: z.enum(["es-CO", "en-US"]),
  country_code: z.enum(["CO", "US"]),
})

export type LocaleSettingsInput = z.infer<typeof localeSettingsSchema>

/** Opciones para los selects de UI (labels en español, idioma del dashboard). */
export const CURRENCY_OPTIONS: ReadonlyArray<{ value: LocaleSettingsInput["currency_code"]; label: string }> = [
  { value: "COP", label: "COP — Peso colombiano" },
  { value: "USD", label: "USD — Dólar estadounidense" },
]

export const LOCALE_OPTIONS: ReadonlyArray<{ value: LocaleSettingsInput["locale"]; label: string }> = [
  { value: "es-CO", label: "Español (Colombia)" },
  { value: "en-US", label: "English (United States)" },
]

export const COUNTRY_OPTIONS: ReadonlyArray<{ value: LocaleSettingsInput["country_code"]; label: string }> = [
  { value: "CO", label: "Colombia" },
  { value: "US", label: "Estados Unidos" },
]
