"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export interface BadgeData {
    id: string
    organization_id: string
    name: string
    display_text: string
    background_color: string
    text_color: string
    icon?: string
    type: 'manual' | 'automatic'
    rules?: {
        discount_greater_than?: number
        category?: string
        stock_status?: 'low' | 'out'
    }
    created_at: string
}

export interface CreateBadgeData {
    name: string
    display_text: string
    background_color: string
    text_color: string
    icon?: string
    type: 'manual' | 'automatic'
    rules?: {
        discount_greater_than?: number
        category?: string
        stock_status?: 'low' | 'out'
    }
}

export async function getBadges() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return []

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) return []

    const { data, error } = await supabase
        .from("badges")
        .select("*")
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: false })

    if (error) {
        console.error("Error fetching badges:", error)
        return []
    }

    return (data || []) as BadgeData[]
}

export async function createBadge(badgeData: CreateBadgeData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error("Unauthorized")

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) throw new Error("No organization found")

    const { data, error } = await supabase
        .from("badges")
        .insert({
            organization_id: profile.organization_id,
            ...badgeData
        })
        .select()
        .single()

    if (error) {
        console.error("Error creating badge:", error)
        throw new Error(`Failed to create badge: ${error.message}`)
    }

    revalidatePath("/dashboard/badges")
    return { success: true, badge: data }
}

export async function updateBadge(id: string, badgeData: Partial<CreateBadgeData>) {
    const supabase = await createClient()

    const { error } = await supabase
        .from("badges")
        .update(badgeData)
        .eq("id", id)

    if (error) {
        console.error("Error updating badge:", error)
        throw new Error(`Failed to update badge: ${error.message}`)
    }

    revalidatePath("/dashboard/badges")
    return { success: true }
}

export async function deleteBadge(id: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from("badges")
        .delete()
        .eq("id", id)

    if (error) {
        console.error("Error deleting badge:", error)
        throw new Error(`Failed to delete badge: ${error.message}`)
    }

    revalidatePath("/dashboard/badges")
    return { success: true }
}
