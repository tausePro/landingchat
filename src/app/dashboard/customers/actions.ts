"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export interface Customer {
    id: string
    full_name: string
    email: string | null
    phone: string | null
    tags: string[]
    category: string | null
    acquisition_channel: string | null
    total_orders: number
    total_spent: number
    created_at: string
    last_interaction_at?: string
}

export interface GetCustomersParams {
    page?: number
    limit?: number
    search?: string
    category?: string
    channel?: string
    tags?: string[]
}

export async function getCustomers({
    page = 1,
    limit = 25,
    search,
    category,
    channel,
    tags
}: GetCustomersParams) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error("Unauthorized")

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) throw new Error("No organization found")

    let query = supabase
        .from("customers")
        .select("*", { count: "exact" })
        .eq("organization_id", profile.organization_id)

    // Search
    if (search) {
        query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)
    }

    // Filters
    if (category && category !== "all") {
        query = query.eq("category", category)
    }

    if (channel && channel !== "all") {
        query = query.eq("acquisition_channel", channel)
    }

    if (tags && tags.length > 0) {
        query = query.contains("tags", tags)
    }

    // Pagination
    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(from, to)

    if (error) {
        console.error("Error fetching customers:", error)
        throw new Error("Failed to fetch customers")
    }

    return {
        customers: data as Customer[],
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
    }
}

export async function updateCustomer(customerId: string, data: Partial<Customer>) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error("Unauthorized")

    const { error } = await supabase
        .from("customers")
        .update(data)
        .eq("id", customerId)

    if (error) {
        throw new Error(`Failed to update customer: ${error.message}`)
    }

    revalidatePath("/dashboard/customers")
    return { success: true }
}

export async function deleteCustomer(customerId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error("Unauthorized")

    const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", customerId)

    if (error) {
        throw new Error(`Failed to delete customer: ${error.message}`)
    }

    revalidatePath("/dashboard/customers")
    return { success: true }
}
