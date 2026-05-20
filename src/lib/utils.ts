import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

import type { SupportedCurrency, SupportedLocale } from "@/types/organization"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Retorna 'white' o 'black' según el contraste necesario para el color de fondo dado.
 * Usa la fórmula de luminancia relativa WCAG.
 */
export function getContrastTextColor(hexColor: string): string {
  const hex = hexColor.replace('#', '')
  if (hex.length < 6) return 'white'
  const r = parseInt(hex.substring(0, 2), 16) / 255
  const g = parseInt(hex.substring(2, 4), 16) / 255
  const b = parseInt(hex.substring(4, 6), 16) / 255

  const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)

  return luminance > 0.4 ? 'black' : 'white'
}

/**
 * Opciones para parametrizar `formatCurrency()` por contexto del tenant.
 * Sin opciones → comportamiento legacy (COP / es-CO / 0 decimales).
 *
 * Spec: .kiro/specs/i18n-fase-1/ (T1.2)
 */
export interface FormatCurrencyOptions {
  /** ISO 4217 currency code. Default `'COP'`. */
  currency?: SupportedCurrency
  /** BCP 47 locale para formato. Default `'es-CO'`. */
  locale?: SupportedLocale
  /**
   * Número de decimales (min y max). Si no se pasa, se infiere del currency:
   * - `COP` → 0 decimales (convención colombiana de redondeo).
   * - `USD` → 2 decimales (estándar dólar).
   *
   * Si se pasa explícitamente, se usa ese valor para min y max.
   */
  fractionDigits?: number
}

/**
 * Formatea un monto numérico como string de moneda usando `Intl.NumberFormat`.
 *
 * **Backward compatible:** sin opciones, retorna idéntico al comportamiento
 * legacy (COP / es-CO / 0 decimales). Llamadas existentes a `formatCurrency(x)`
 * siguen funcionando sin cambios.
 *
 * **Con contexto del tenant:** pasar `getTenantLocale(organization)` (o un
 * subset `{ currency, locale }`) para formatear en la moneda y locale del
 * tenant.
 *
 * @example
 * ```ts
 * // Legacy (COP, sin decimales):
 * formatCurrency(1234567)
 * // → "$ 1.234.567"
 *
 * // Con contexto del tenant (USD, en-US):
 * formatCurrency(1234.56, { currency: "USD", locale: "en-US" })
 * // → "$1,234.56"
 *
 * // Override explícito de decimales:
 * formatCurrency(100, { currency: "COP", fractionDigits: 2 })
 * // → "$ 100,00"
 * ```
 */
export function formatCurrency(
  amount: number,
  options?: FormatCurrencyOptions
): string {
  const currency: SupportedCurrency = options?.currency ?? "COP"
  const locale: SupportedLocale = options?.locale ?? "es-CO"
  const fractionDigits =
    options?.fractionDigits ?? (currency === "USD" ? 2 : 0)

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount)
}
