"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export interface OrganizationData {
    id: string
    name: string
    slug: string
    contact_email?: string
    status: 'active' | 'suspended' | 'archived'
    onboarding_completed: boolean
    created_at: string
    // Metrics (joined)
    users_count?: number
    chats_count?: number
}

export async function getOrganizations(page = 1, limit = 10, search = "") {
    const supabase = await createClient()

    // Calculate offset
    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabase
        .from("organizations")
        .select(`
            *,
            profiles:profiles(count),
            chats:chats(count)
        `, { count: 'exact' })
        .order("created_at", { ascending: false })
        .range(from, to)

    if (search) {
        query = query.ilike('name', `%${search}%`)
    }

    const { data, error, count } = await query

    if (error) {
        console.error("Error fetching organizations:", error)
        throw new Error("Failed to fetch organizations")
    }

    // Transform data to include counts properly
    const organizations = data.map((org: any) => ({
        ...org,
        users_count: org.profiles?.[0]?.count || 0,
        chats_count: org.chats?.[0]?.count || 0
    }))

    return {
        organizations,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
    }
}

export async function updateOrganizationStatus(id: string, status: 'active' | 'suspended' | 'archived') {
    const supabase = await createClient()

    const { error } = await supabase
        .from("organizations")
        .update({ status })
        .eq("id", id)

    if (error) {
        console.error("Error updating organization status:", error)
        throw new Error("Failed to update organization status")
    }

    revalidatePath("/admin/organizations")
    return { success: true }
}
