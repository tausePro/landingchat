"use server"

import { createClient, createServiceClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { randomBytes } from "crypto"
import { z } from "zod"
import { requireAdminRole, type AdminRole } from "@/lib/admin/roles"

export interface UserData {
    id: string
    full_name: string
    email: string
    role: 'admin' | 'member'
    is_superadmin: boolean
    admin_role: AdminRole | null
    created_at: string
    organization?: {
        id: string
        name: string
        slug: string
    }
}

export async function getUsers(page = 1, limit = 10, search = "") {
    // Admin S1: la gestión de usuarios es exclusiva del superadmin
    if (!(await requireAdminRole([]))) {
        return { users: [], total: 0, totalPages: 0 }
    }
    // Service client tras el gate: con el cliente RLS el superadmin solo veía
    // los perfiles de SU org (la lista mostraba 1 de 15 usuarios reales)
    const supabase = await createServiceClient()

    // Calculate offset
    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabase
        .from("profiles")
        .select(`
            *,
            organization:organizations(id, name, slug)
        `, { count: 'exact' })
        .order("created_at", { ascending: false })
        .range(from, to)

    if (search) {
        query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
    }

    const { data, error, count } = await query

    if (error) {
        console.error("Error fetching users:", error)
        throw new Error("Failed to fetch users")
    }

    return {
        users: data as UserData[],
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
    }
}

export async function updateUserRole(id: string, role: 'admin' | 'member') {
    if (!(await requireAdminRole([]))) throw new Error("Unauthorized")
    const supabase = await createClient()

    const { error } = await supabase
        .from("profiles")
        .update({ role })
        .eq("id", id)

    if (error) {
        console.error("Error updating user role:", error)
        throw new Error("Failed to update user role")
    }

    revalidatePath("/admin/users")
    return { success: true }
}

export async function toggleSuperadmin(id: string, is_superadmin: boolean) {
    if (!(await requireAdminRole([]))) {
        throw new Error("Unauthorized: Only superadmins can change superadmin status")
    }
    const supabase = await createClient()

    const { error } = await supabase
        .from("profiles")
        .update({
            is_superadmin,
            // Mantener admin_role coherente con el flag legacy
            admin_role: is_superadmin ? "superadmin" : null,
        })
        .eq("id", id)

    if (error) {
        console.error("Error updating superadmin status:", error)
        throw new Error("Failed to update superadmin status")
    }

    revalidatePath("/admin/users")
    return { success: true }
}

/**
 * Asigna el rol de plataforma (finance | tech | null) a un usuario (Admin S1).
 * superadmin se gestiona con toggleSuperadmin; aquí solo roles de equipo.
 */
export async function updateAdminRole(id: string, adminRole: "finance" | "tech" | null) {
    if (!(await requireAdminRole([]))) {
        throw new Error("Unauthorized: Only superadmins can assign admin roles")
    }
    if (adminRole !== null && !["finance", "tech"].includes(adminRole)) {
        throw new Error("Rol inválido")
    }

    const supabase = await createClient()
    const { error } = await supabase
        .from("profiles")
        .update({ admin_role: adminRole })
        .eq("id", id)

    if (error) {
        console.error("Error updating admin role:", error)
        throw new Error("Failed to update admin role")
    }

    revalidatePath("/admin/users")
    return { success: true }
}

// ─── Creación de usuarios de plataforma (Admin) ────────────────────

const createUserSchema = z.object({
    email: z.string().trim().email("Email inválido"),
    fullName: z.string().trim().min(2, "Nombre muy corto").max(80),
    adminRole: z.enum(["finance", "tech", "superadmin"]).nullable(),
})

export type CreatePlatformUserInput = z.infer<typeof createUserSchema>

/** Password temporal legible (el superadmin la comparte por canal seguro). */
function generateTempPassword(): string {
    const raw = randomBytes(12).toString("base64url")
    return `Lc-${raw.slice(0, 12)}`
}

/**
 * Crea un usuario desde el super admin (compañeros de equipo o cuentas de
 * merchants). El trigger `handle_new_user` crea su profile + org automática;
 * aquí asignamos el rol de plataforma y saltamos el onboarding de la org
 * dummy. La password temporal se retorna UNA vez — no se persiste en claro.
 */
export async function createPlatformUser(
    input: CreatePlatformUserInput
): Promise<{ success: true; tempPassword: string } | { success: false; error: string }> {
    if (!(await requireAdminRole([]))) {
        return { success: false, error: "Solo superadmin puede crear usuarios" }
    }

    const validation = createUserSchema.safeParse(input)
    if (!validation.success) {
        return { success: false, error: validation.error.issues[0]?.message || "Datos inválidos" }
    }
    const { email, fullName, adminRole } = validation.data

    try {
        const supabase = await createServiceClient()
        const tempPassword = generateTempPassword()

        const { data: created, error: createError } = await supabase.auth.admin.createUser({
            email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { full_name: fullName },
        })

        if (createError || !created.user) {
            return { success: false, error: createError?.message || "No se pudo crear el usuario" }
        }

        // El trigger handle_new_user ya creó profile + org dummy. Asignar rol
        // de plataforma y email; saltar el onboarding de la org automática.
        const { error: profileError } = await supabase
            .from("profiles")
            .update({
                email,
                full_name: fullName,
                admin_role: adminRole,
                is_superadmin: adminRole === "superadmin",
            })
            .eq("id", created.user.id)

        if (profileError) {
            console.error("[admin/users] Profile update after create failed:", profileError)
        }

        const { data: profile } = await supabase
            .from("profiles")
            .select("organization_id")
            .eq("id", created.user.id)
            .single()

        if (profile?.organization_id) {
            await supabase
                .from("organizations")
                .update({ onboarding_completed: true })
                .eq("id", profile.organization_id)
        }

        revalidatePath("/admin/users")
        return { success: true, tempPassword }
    } catch (error) {
        console.error("[admin/users] Create user error:", error)
        return { success: false, error: "Error inesperado al crear el usuario" }
    }
}
