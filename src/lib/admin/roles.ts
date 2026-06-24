/**
 * Roles del equipo de plataforma (Admin S1).
 *
 * - superadmin: todo (incluida la asignación de roles)
 * - finance:    números — consumo IA, costos, suscripciones, pagos, planes
 * - tech:       operación — notificaciones, Evolution, Meta, instancias,
 *               webhooks, organizaciones (sin finanzas)
 *
 * El gate REAL vive en los server actions vía `requireAdminRole`; el
 * sidebar/layout solo filtra la navegación visible.
 */

import { createClient } from "@/lib/supabase/server"

export type AdminRole = "superadmin" | "finance" | "tech"

const VALID_ROLES: ReadonlySet<string> = new Set(["superadmin", "finance", "tech"])

/**
 * Rol del usuario autenticado. `is_superadmin=true` manda (compat con el
 * modelo anterior); si no, se usa `admin_role`. NULL = sin acceso.
 */
export async function getCurrentAdminRole(): Promise<AdminRole | null> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile } = await supabase
        .from("profiles")
        .select("is_superadmin, admin_role")
        .eq("id", user.id)
        .single()

    if (profile?.is_superadmin === true) return "superadmin"
    if (profile?.admin_role && VALID_ROLES.has(profile.admin_role)) {
        return profile.admin_role as AdminRole
    }
    return null
}

/**
 * Gate para server actions. superadmin SIEMPRE pasa.
 *
 * @example if (!(await requireAdminRole(["finance"]))) return failure("No autorizado")
 */
export async function requireAdminRole(roles: AdminRole[]): Promise<boolean> {
    const role = await getCurrentAdminRole()
    if (!role) return false
    if (role === "superadmin") return true
    return roles.includes(role)
}

/** Secciones del panel por rol (para filtrar el sidebar). */
export const ADMIN_SECTION_ACCESS: Record<string, AdminRole[]> = {
    "/admin": ["superadmin", "finance", "tech"],
    "/admin/organizations": ["superadmin", "tech"],
    "/admin/users": ["superadmin"],
    "/admin/ai-usage": ["superadmin", "finance"],
    "/admin/operating-costs": ["superadmin", "finance"],
    "/admin/marketplace": ["superadmin", "finance"],
    "/admin/pricing": ["superadmin", "finance"],
    "/admin/plans": ["superadmin", "finance"],
    "/admin/subscriptions": ["superadmin", "finance"],
    "/admin/founding": ["superadmin", "finance"],
    "/admin/platform-payments": ["superadmin", "finance"],
    "/admin/afiliados": ["superadmin", "finance"],
    "/admin/webhook-logs": ["superadmin", "tech"],
    "/admin/whatsapp": ["superadmin", "tech"],
    "/admin/settings/landing": ["superadmin"],
    "/admin/settings/wompi": ["superadmin", "tech"],
    "/admin/settings/platform-notifications": ["superadmin", "tech"],
    "/admin/settings/evolution": ["superadmin", "tech"],
    "/admin/settings/meta-whatsapp": ["superadmin", "tech"],
}

export function canAccessSection(role: AdminRole, path: string): boolean {
    if (role === "superadmin") return true
    const allowed = ADMIN_SECTION_ACCESS[path]
    return allowed ? allowed.includes(role) : false
}
