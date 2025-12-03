"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export interface ShippingSettings {
    id: string
    organization_id: string
    free_shipping_enabled: boolean
    free_shipping_min_amount: number | null
    free_shipping_zones: string[] | null
    default_shipping_rate: number
    express_shipping_rate: number | null
    estimated_delivery_days: number
    express_delivery_days: number
    created_at: string
    updated_at: string
}

export async function getShippingSettings() {
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
        .from("shipping_settings")
        .select("*")
        .eq("organization_id", profile.organization_id)
        .single()

    if (error && error.code !== "PGRST116") {
        console.error("Error fetching shipping settings:", error)
        throw new Error(`Failed to fetch shipping settings: ${error.message}`)
    }

    return data
}

export async function updateShippingSettings(settings: Partial<ShippingSettings>) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) throw new Error("No organization found")

    // Check if settings exist
    const existing = await getShippingSettings()

    if (existing) {
        // Update existing
        const { error } = await supabase
            .from("shipping_settings")
            .update({
                ...settings,
                updated_at: new Date().toISOString()
            })
            .eq("organization_id", profile.organization_id)

        if (error) {
            console.error("Error updating shipping settings:", error)
            throw new Error(`Failed to update shipping settings: ${error.message}`)
        }
    } else {
        // Create new
        const { error } = await supabase
            .from("shipping_settings")
            .insert({
                organization_id: profile.organization_id,
                ...settings
            })

        if (error) {
            console.error("Error creating shipping settings:", error)
            throw new Error(`Failed to create shipping settings: ${error.message}`)
        }
    }

    revalidatePath("/dashboard/marketing/shipping")
    return { success: true }
}
