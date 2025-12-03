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
    address?: {
        city?: string
        neighborhood?: string
    }
}

export interface GetCustomersParams {
    page?: number
    limit?: number
    search?: string
    category?: string
    channel?: string
    zone?: string
    tags?: string[]
}

export async function getCustomers({
    page = 1,
    limit = 25,
    search,
    category,
    channel,
    zone,
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

    if (zone && zone !== "all") {
        // Filter by JSONB field address->>zone
        query = query.eq("address->>zone", zone) // Note: This syntax might need adjustment depending on Supabase JS client version, but usually works for simple equality. 
        // Alternatively: query.filter('address->>zone', 'eq', zone)
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

export async function createCustomer(data: {
    full_name: string
    email?: string
    phone?: string
    category?: string
    acquisition_channel?: string
    address?: any
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error("Unauthorized")

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) throw new Error("No organization found")

    const { error } = await supabase
        .from("customers")
        .insert({
            organization_id: profile.organization_id,
            full_name: data.full_name,
            email: data.email || null,
            phone: data.phone || null,
            category: data.category || 'nuevo',
            acquisition_channel: data.acquisition_channel || 'web',
            address: data.address || {},
            tags: []
        })

    if (error) {
        throw new Error(`Failed to create customer: ${error.message}`)
    }

    revalidatePath("/dashboard/customers")
    return { success: true }
}

export async function importCustomers(customers: any[]) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error("Unauthorized")

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) throw new Error("No organization found")

    // Prepare data for bulk insert
    const customersToInsert = customers.map(c => ({
        organization_id: profile.organization_id,
        full_name: c.full_name || c.nombre || "Sin Nombre",
        email: c.email || null,
        phone: c.phone || c.telefono || null,
        category: c.category || c.categoria || 'nuevo',
        acquisition_channel: c.channel || c.canal || 'importado',
        tags: c.tags ? c.tags.split(',').map((t: string) => t.trim()) : []
    }))

    const { error } = await supabase
        .from("customers")
        .insert(customersToInsert)

    if (error) {
        throw new Error(`Failed to import customers: ${error.message}`)
    }

    revalidatePath("/dashboard/customers")
    return { success: true }
}
