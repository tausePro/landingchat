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

import { createContext, useCallback, useContext, type ReactNode } from "react"

import type { SupportedLocale } from "@/types/organization"
import {
  t as translateRaw,
  type StorefrontStringKey,
  type StringParams,
} from "./storefront-strings"

// ============================================================================
// Context
// ============================================================================

const TenantLocaleContext = createContext<SupportedLocale>("es-CO")

// ============================================================================
// Provider
// ============================================================================

export interface TenantLocaleProviderProps {
  locale: SupportedLocale
  children: ReactNode
}

/**
 * Provider de locale para el árbol de Client Components del storefront.
 *
 * Debe montarse en el root del storefront (o en cada page que tenga acceso
 * a `organization.locale`) con el valor exacto del tenant. Tenants sin locale
 * configurado caen a `'es-CO'` (default seguro definido en el schema).
 */
export function TenantLocaleProvider({
  locale,
  children,
}: TenantLocaleProviderProps) {
  return (
    <TenantLocaleContext.Provider value={locale}>
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
  return useContext(TenantLocaleContext)
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
