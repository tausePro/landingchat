"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { ActionResult } from "@/types/common"
import {
  createCustomerSchema,
  updateCustomerSchema,
  type Customer,
  type CreateCustomerInput,
  type UpdateCustomerInput,
  type GetCustomersParams,
} from "@/types/customer"

// Re-export types for backward compatibility
export type { Customer, GetCustomersParams, CreateCustomerInput }

// ============================================================================
// Query Actions
// ============================================================================

export interface GetCustomersResult {
  customers: Customer[]
  total: number
  totalPages: number
}

export async function getCustomers({
  page = 1,
  limit = 25,
  search,
  category,
  channel,
  zone,
  tags
}: GetCustomersParams): Promise<ActionResult<GetCustomersResult>> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: "Unauthorized" }
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single()

    if (!profile?.organization_id) {
      return { success: false, error: "No organization found" }
    }

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
      query = query.eq("address->>zone", zone)
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
      return { success: false, error: `Failed to fetch customers: ${error.message}` }
    }

    return {
      success: true,
      data: {
        customers: data as Customer[],
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error fetching customers"
    }
  }
}

// ============================================================================
// Mutation Actions
// ============================================================================

export async function createCustomer(
  input: CreateCustomerInput
): Promise<ActionResult<{ id: string }>> {
  // 1. Validate input
  const parsed = createCustomerSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>
    }
  }

  try {
    // 2. Auth check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: "Unauthorized" }
    }

    // 3. Get org context
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single()

    if (!profile?.organization_id) {
      return { success: false, error: "No organization found" }
    }

    // 4. Execute operation
    const { data, error } = await supabase
      .from("customers")
      .insert({
        organization_id: profile.organization_id,
        full_name: parsed.data.full_name,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        category: parsed.data.category || "nuevo",
        acquisition_channel: parsed.data.acquisition_channel || "web",
        address: parsed.data.address || {},
        tags: parsed.data.tags || []
      })
      .select("id")
      .single()

    if (error) {
      return { success: false, error: `Failed to create customer: ${error.message}` }
    }

    revalidatePath("/dashboard/customers")
    return { success: true, data: { id: data.id } }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error creating customer"
    }
  }
}

export async function updateCustomer(
  customerId: string,
  input: UpdateCustomerInput
): Promise<ActionResult<void>> {
  // 1. Validate input
  const parsed = updateCustomerSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>
    }
  }

  try {
    // 2. Auth check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: "Unauthorized" }
    }

    // 3. Execute operation
    const { error } = await supabase
      .from("customers")
      .update(parsed.data)
      .eq("id", customerId)

    if (error) {
      return { success: false, error: `Failed to update customer: ${error.message}` }
    }

    revalidatePath("/dashboard/customers")
    return { success: true, data: undefined }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error updating customer"
    }
  }
}

export async function deleteCustomer(
  customerId: string
): Promise<ActionResult<void>> {
  try {
    // 1. Auth check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: "Unauthorized" }
    }

    // 2. Execute operation
    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", customerId)

    if (error) {
      return { success: false, error: `Failed to delete customer: ${error.message}` }
    }

    revalidatePath("/dashboard/customers")
    return { success: true, data: undefined }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error deleting customer"
    }
  }
}

// ============================================================================
// Bulk Import Action
// ============================================================================

export interface ImportCustomerRow {
  full_name?: string
  nombre?: string
  email?: string
  phone?: string
  telefono?: string
  category?: string
  categoria?: string
  channel?: string
  canal?: string
  tags?: string
}

export async function importCustomers(
  customers: ImportCustomerRow[]
): Promise<ActionResult<{ imported: number }>> {
  try {
    // 1. Auth check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: "Unauthorized" }
    }

    // 2. Get org context
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single()

    if (!profile?.organization_id) {
      return { success: false, error: "No organization found" }
    }

    // 3. Prepare and validate data for bulk insert
    const customersToInsert = customers.map(c => ({
      organization_id: profile.organization_id,
      full_name: c.full_name || c.nombre || "Sin Nombre",
      email: c.email || null,
      phone: c.phone || c.telefono || null,
      category: c.category || c.categoria || "nuevo",
      acquisition_channel: c.channel || c.canal || "importado",
      tags: c.tags ? c.tags.split(",").map((t: string) => t.trim()) : []
    }))

    // 4. Execute operation
    const { error } = await supabase
      .from("customers")
      .insert(customersToInsert)

    if (error) {
      return { success: false, error: `Failed to import customers: ${error.message}` }
    }

    revalidatePath("/dashboard/customers")
    return { success: true, data: { imported: customersToInsert.length } }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error importing customers"
    }
  }
}
