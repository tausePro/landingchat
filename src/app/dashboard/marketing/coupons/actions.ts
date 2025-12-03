"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export interface Coupon {
    id: string
    organization_id: string
    code: string
    description: string | null
    type: 'percentage' | 'fixed' | 'free_shipping'
    value: number
    min_purchase_amount: number | null
    max_discount_amount: number | null
    applies_to: 'all' | 'products' | 'categories'
    target_ids: string[] | null
    max_uses: number | null
    max_uses_per_customer: number
    current_uses: number
    valid_from: string
    valid_until: string | null
    is_active: boolean
    created_at: string
    updated_at: string
}

export interface CreateCouponData {
    code: string
    description?: string
    type: 'percentage' | 'fixed' | 'free_shipping'
    value: number
    min_purchase_amount?: number
    max_discount_amount?: number
    applies_to?: 'all' | 'products' | 'categories'
    target_ids?: string[]
    max_uses?: number
    max_uses_per_customer?: number
    valid_from?: string
    valid_until?: string
    is_active?: boolean
}

export async function getCoupons() {
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
        .from("coupons")
        .select("*")
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: false })

    if (error) {
        console.error("Error fetching coupons:", error)
        throw new Error(`Failed to fetch coupons: ${error.message}`)
    }

    return data || []
}

export async function getCouponById(id: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("id", id)
        .single()

    if (error) {
        console.error("Error fetching coupon:", error)
        return null
    }

    return data
}

export async function createCoupon(couponData: CreateCouponData) {
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
        .from("coupons")
        .insert({
            organization_id: profile.organization_id,
            code: couponData.code.toUpperCase(),
            description: couponData.description,
            type: couponData.type,
            value: couponData.value,
            min_purchase_amount: couponData.min_purchase_amount ?? null,
            max_discount_amount: couponData.max_discount_amount ?? null,
            applies_to: couponData.applies_to ?? 'all',
            target_ids: couponData.target_ids ?? null,
            max_uses: couponData.max_uses ?? null,
            max_uses_per_customer: couponData.max_uses_per_customer ?? 1,
            current_uses: 0,
            valid_from: couponData.valid_from ?? new Date().toISOString(),
            valid_until: couponData.valid_until ?? null,
            is_active: couponData.is_active ?? true
        })
        .select()
        .single()

    if (error) {
        console.error("Error creating coupon:", error)
        throw new Error(`Failed to create coupon: ${error.message}`)
    }

    revalidatePath("/dashboard/marketing/coupons")
    return { success: true, coupon: data }
}

export async function updateCoupon(id: string, couponData: Partial<CreateCouponData>) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const updateData: any = {
        ...couponData,
        updated_at: new Date().toISOString()
    }

    if (couponData.code) {
        updateData.code = couponData.code.toUpperCase()
    }

    const { error } = await supabase
        .from("coupons")
        .update(updateData)
        .eq("id", id)

    if (error) {
        console.error("Error updating coupon:", error)
        throw new Error(`Failed to update coupon: ${error.message}`)
    }

    revalidatePath("/dashboard/marketing/coupons")
    return { success: true }
}

export async function deleteCoupon(id: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { error } = await supabase
        .from("coupons")
        .delete()
        .eq("id", id)

    if (error) {
        console.error("Error deleting coupon:", error)
        throw new Error(`Failed to delete coupon: ${error.message}`)
    }

    revalidatePath("/dashboard/marketing/coupons")
    return { success: true }
}

export async function toggleCouponStatus(id: string, isActive: boolean) {
    const supabase = await createClient()

    const { error } = await supabase
        .from("coupons")
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq("id", id)

    if (error) {
        console.error("Error toggling coupon status:", error)
        throw new Error(`Failed to toggle coupon status: ${error.message}`)
    }

    revalidatePath("/dashboard/marketing/coupons")
    return { success: true }
}
