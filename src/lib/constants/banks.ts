/**
 * Lista de bancos por país para el form de configuración de pago manual
 * en el dashboard.
 *
 * El value se persiste en `manual_payment_methods.bank_name`. Los nombres son
 * estables (no se traducen porque son nombres propios). Si el merchant tiene
 * un banco que no está en la lista, puede usar la opción genérica "Other"
 * y luego especificar en `instructions`.
 *
 * T1.5 — Manual payment country-aware. Spec: .kiro/specs/i18n-fase-1/.
 */

import type { SupportedCountry } from "@/types/organization"

/**
 * Bancos colombianos más comunes para tenants `country='CO'`.
 * Incluye tanto bancos tradicionales como wallets (Nequi, Daviplata).
 *
 * Si el merchant tiene otro banco, usar "Other" y especificar en instructions.
 */
export const COLOMBIA_BANKS = [
  "Bancolombia",
  "Davivienda",
  "BBVA",
  "Banco de Bogotá",
  "Banco de Occidente",
  "Banco Popular",
  "Scotiabank Colpatria",
  "Banco AV Villas",
  "Banco Caja Social",
  "Itaú",
  "Nequi",
  "Daviplata",
] as const

/**
 * Bancos US más comunes para tenants `country='US'`.
 * Incluye los 5 bigs + algunos regionales populares.
 *
 * Si el merchant tiene otro banco (regional, online, credit union), usar
 * "Other" y especificar en instructions.
 */
export const US_BANKS = [
  "Chase",
  "Bank of America",
  "Wells Fargo",
  "Citibank",
  "Capital One",
  "US Bank",
  "PNC Bank",
  "TD Bank",
  "Truist",
  "American Express Bank",
  "Goldman Sachs (Marcus)",
  "Discover Bank",
  "Ally Bank",
  "Charles Schwab Bank",
] as const

/**
 * Registry: lookup de bancos por country.
 *
 * Para agregar un país nuevo (e.g. MX en Fase 2):
 * 1. Definir nueva constante (e.g. `MEXICO_BANKS`).
 * 2. Agregar entry al registry.
 * 3. Tests.
 */
export const BANKS_BY_COUNTRY: Readonly<Record<SupportedCountry, readonly string[]>> = Object.freeze({
  CO: COLOMBIA_BANKS,
  US: US_BANKS,
})

/**
 * Resuelve la lista de bancos para un país. Defensivo: cae a CO si el input
 * es inválido.
 */
export function getBanksForCountry(
  country: SupportedCountry | undefined | null,
): readonly string[] {
  if (country && country in BANKS_BY_COUNTRY) {
    return BANKS_BY_COUNTRY[country]
  }
  return BANKS_BY_COUNTRY.CO
}
