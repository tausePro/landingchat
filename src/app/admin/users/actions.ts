"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export interface UserData {
    id: string
    full_name: string
    email: string
    role: 'admin' | 'member'
    is_superadmin: boolean
    created_at: string
    organization?: {
        id: string
        name: string
        slug: string
    }
}

export async function getUsers(page = 1, limit = 10, search = "") {
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
    const supabase = await createClient()

    // Security check: Ensure the current user is a superadmin before allowing this
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { data: currentUserProfile } = await supabase
        .from("profiles")
        .select("is_superadmin")
        .eq("id", user.id)
        .single()

    if (!currentUserProfile?.is_superadmin) {
        throw new Error("Unauthorized: Only superadmins can change superadmin status")
    }

    const { error } = await supabase
        .from("profiles")
        .update({ is_superadmin })
        .eq("id", id)

    if (error) {
        console.error("Error updating superadmin status:", error)
        throw new Error("Failed to update superadmin status")
    }

    revalidatePath("/admin/users")
    return { success: true }
}
