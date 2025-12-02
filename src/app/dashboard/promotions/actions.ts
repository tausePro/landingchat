"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export interface PromotionData {
    id: string
    organization_id: string
    name: string
    type: 'percentage' | 'fixed' | 'bogo'
    value: number
    applies_to: 'all' | 'category' | 'products'
    target_ids?: string[]
    min_purchase?: number
    new_customers_only?: boolean
    start_date?: string
    end_date?: string
    chat_message?: string
    is_active?: boolean
    created_at: string
}

export interface CreatePromotionData {
    name: string
    type: 'percentage' | 'fixed' | 'bogo'
    value: number
    applies_to: 'all' | 'category' | 'products'
    target_ids?: string[]
    min_purchase?: number
    new_customers_only?: boolean
    start_date?: string
    end_date?: string
    chat_message?: string
    is_active?: boolean
}

export async function getPromotions() {
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
        .from("promotions")
        .select("*")
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: false })

    if (error) {
        console.error("Error fetching promotions:", error)
        return []
    }

    return (data || []) as PromotionData[]
}

export async function createPromotion(promotionData: CreatePromotionData) {
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
        .from("promotions")
        .insert({
            organization_id: profile.organization_id,
            ...promotionData
        })
        .select()
        .single()

    if (error) {
        console.error("Error creating promotion:", error)
        throw new Error(`Failed to create promotion: ${error.message}`)
    }

    revalidatePath("/dashboard/promotions")
    return { success: true, promotion: data }
}

export async function updatePromotion(id: string, promotionData: Partial<CreatePromotionData>) {
    const supabase = await createClient()

    const { error } = await supabase
        .from("promotions")
        .update(promotionData)
        .eq("id", id)

    if (error) {
        console.error("Error updating promotion:", error)
        throw new Error(`Failed to update promotion: ${error.message}`)
    }

    revalidatePath("/dashboard/promotions")
    return { success: true }
}

export async function deletePromotion(id: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from("promotions")
        .delete()
        .eq("id", id)

    if (error) {
        console.error("Error deleting promotion:", error)
        throw new Error(`Failed to delete promotion: ${error.message}`)
    }

    revalidatePath("/dashboard/promotions")
    return { success: true }
}
