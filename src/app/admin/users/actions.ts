"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
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
    const supabase = await createClient()

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
