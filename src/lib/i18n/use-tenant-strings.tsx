"use client"

/**
 * Provider + hook para consumir el diccionario i18n del storefront desde
 * Client Components. Para Server Components usá `t()` directo de
 * `storefront-strings.ts` con el `organization.locale`.
 *
 * Patrón de uso:
 *
 * ```tsx
 * // En el root del storefront (layout o page server component):
 * <TenantLocaleProvider locale={organization.locale ?? 'es-CO'}>
 *   <ClientComponent />
 * </TenantLocaleProvider>
 *
 * // En un Client Component descendiente:
 * 'use client'
 * import { useT } from "@/lib/i18n/use-tenant-strings"
 *
 * function MyButton() {
 *   const t = useT()
 *   return <button>{t("order.common.back_to_store")}</button>
 * }
 * ```
 *
 * Spec: .kiro/specs/i18n-fase-1/ (T1.3)
 */

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react"

import type { SupportedCurrency, SupportedLocale } from "@/types/organization"
import {
  t as translateRaw,
  type StorefrontStringKey,
  type StringParams,
} from "./storefront-strings"

// ============================================================================
// Context
// ============================================================================

interface TenantLocaleContextValue {
  locale: SupportedLocale
  currencyCode: SupportedCurrency
}

const DEFAULT_CONTEXT_VALUE: TenantLocaleContextValue = {
  locale: "es-CO",
  currencyCode: "COP",
}

const TenantLocaleContext = createContext<TenantLocaleContextValue>(DEFAULT_CONTEXT_VALUE)

// ============================================================================
// Provider
// ============================================================================

export interface TenantLocaleProviderProps {
  locale: SupportedLocale
  /**
   * ISO 4217 currency code del tenant. Default `'COP'` cuando no se provee.
   * Usado por `useTenantCurrency()` para parametrizar `formatCurrency()` en
   * Client Components descendientes.
   */
  currencyCode?: SupportedCurrency
  children: ReactNode
}

/**
 * Provider de locale + moneda para el árbol de Client Components del storefront.
 *
 * Debe montarse en el root del storefront (o en cada page que tenga acceso a
 * `organization.locale` y `organization.currency_code`) con los valores exactos
 * del tenant. Tenants sin configuración caen a `('es-CO', 'COP')` (defaults
 * seguros definidos en el schema).
 *
 * El value se memoiza para evitar re-renders innecesarios cuando el padre
 * re-renderiza pero los props no cambian.
 */
export function TenantLocaleProvider({
  locale,
  currencyCode = "COP",
  children,
}: TenantLocaleProviderProps) {
  const value = useMemo(
    () => ({ locale, currencyCode }),
    [locale, currencyCode],
  )
  return (
    <TenantLocaleContext.Provider value={value}>
      {children}
    </TenantLocaleContext.Provider>
  )
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook que retorna el locale activo del tenant en este árbol.
 * Útil cuando el componente necesita el locale para algo distinto de strings
 * (ej. pasarlo a `formatCurrency`, `Intl.DateTimeFormat`, etc.).
 */
export function useTenantLocale(): SupportedLocale {
  return useContext(TenantLocaleContext).locale
}

/**
 * Hook que retorna el currency code activo del tenant en este árbol.
 *
 * Útil para parametrizar `formatCurrency()` en componentes que ya están
 * dentro del provider (ej. carrito, resumen de orden, totalizadores).
 *
 * @example
 * ```tsx
 * 'use client'
 * import { formatCurrency } from "@/lib/utils"
 * import { useTenantCurrency, useTenantLocale } from "@/lib/i18n/use-tenant-strings"
 *
 * function CartTotal({ amount }: { amount: number }) {
 *   const locale = useTenantLocale()
 *   const currency = useTenantCurrency()
 *   return <span>{formatCurrency(amount, { locale, currency })}</span>
 * }
 * ```
 */
export function useTenantCurrency(): SupportedCurrency {
  return useContext(TenantLocaleContext).currencyCode
}

/**
 * Hook que retorna la función de traducción atada al locale del provider.
 *
 * La función es estable entre renders mientras el `locale` no cambie
 * (memoizada con `useCallback`), evitando re-renders innecesarios en
 * descendientes que reciben `t` como prop.
 *
 * Acepta un segundo argumento opcional `params` para interpolar placeholders
 * `{{key}}` en el string traducido.
 *
 * @example
 * ```tsx
 * 'use client'
 * function Button() {
 *   const t = useT()
 *   return <button>{t("order.common.view_order_details")}</button>
 * }
 *
 * // Con interpolación
 * function Toast({ couponCode }: { couponCode: string }) {
 *   const t = useT()
 *   return <span>{t("store.checkout.toast_coupon_applied", { code: couponCode })}</span>
 * }
 * ```
 */
export function useT(): (key: StorefrontStringKey, params?: StringParams) => string {
  const locale = useTenantLocale()
  return useCallback(
    (key: StorefrontStringKey, params?: StringParams) =>
      translateRaw(key, locale, params),
    [locale],
  )
}
