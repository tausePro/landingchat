/**
 * Helper SERVER-ONLY para resolver el contexto de localización (idioma + moneda)
 * del tenant del usuario autenticado, desde Server Components / Server Actions.
 *
 * Para Client Components usá `useTenantCurrency()` / `useTenantLocale()` del
 * `TenantLocaleProvider`. Para objetos org ya cargados usá `getTenantLocale(org)`.
 *
 * Spec: .kiro/specs/i18n-fase-1/
 */

import { createClient } from "@/lib/supabase/server"
import { getTenantLocale, type TenantLocaleContext } from "./tenant-locale"

/**
 * Resuelve el `TenantLocaleContext` del org del usuario autenticado.
 * Cae al default seguro (COP / es-CO / CO) si no hay sesión u org.
 */
export async function getCurrentTenantLocale(): Promise<TenantLocaleContext> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return getTenantLocale(null)

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single()
  if (!profile?.organization_id) return getTenantLocale(null)

  const { data: org } = await supabase
    .from("organizations")
    .select("currency_code, locale")
    .eq("id", profile.organization_id)
    .single()

  return getTenantLocale(org)
}
