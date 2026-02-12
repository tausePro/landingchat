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
  type CustomerStats,
} from "@/types/customer"
import { computeIntentScore, type IntentScore } from "./lib/intent-score"

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
  tags,
  segment,
  intentScores,
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
      .select("*, orders(id, total, status)", { count: "exact" })
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

    // Segment filters
    if (segment && segment !== "all") {
      if (segment === "whatsapp_leads") {
        query = query.eq("acquisition_channel", "whatsapp")
      } else if (segment === "recurring") {
        query = query.in("category", ["recurrente", "vip", "fieles 1", "fieles 2", "fieles 3", "fieles 4"])
      } else if (segment === "pending_followup") {
        query = query.in("category", ["riesgo", "inactivo"])
      }
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

    // Procesar datos para calcular total_spent y total_orders
    const customersWithTotals = (data || []).map((customer: any) => {
      const orders = customer.orders || []
      const completedOrders = orders.filter((o: any) =>
        o.status && !['cancelled', 'cancelado', 'refunded', 'reembolsado'].includes(o.status.toLowerCase())
      )
      return {
        ...customer,
        total_orders: completedOrders.length,
        total_spent: completedOrders.reduce((sum: number, o: any) => sum + (o.total || 0), 0),
        orders: undefined // Remover el array de orders del resultado
      }
    })

    // Filtrar por intent score (post-fetch ya que es calculado)
    let filteredCustomers = customersWithTotals
    if (intentScores && intentScores.length > 0) {
      filteredCustomers = customersWithTotals.filter((c: any) =>
        intentScores.includes(computeIntentScore({
          category: c.category,
          total_orders: c.total_orders,
          total_spent: c.total_spent,
          last_interaction_at: c.last_interaction_at,
        }))
      )
    }

    return {
      success: true,
      data: {
        customers: filteredCustomers as Customer[],
        total: intentScores && intentScores.length > 0 ? filteredCustomers.length : (count || 0),
        totalPages: intentScores && intentScores.length > 0
          ? Math.ceil(filteredCustomers.length / limit)
          : Math.ceil((count || 0) / limit)
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
// Stats Action (KPIs + Segments)
// ============================================================================

export async function getCustomerStats(): Promise<ActionResult<CustomerStats>> {
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

    const orgId = profile.organization_id
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString()

    // Queries en paralelo
    const [
      leadsThisMonth,
      leadsLastMonth,
      activeChats,
      allCustomers,
      whatsappLeads,
      recurringBuyers,
      pendingFollowUp,
      customersForScore,
    ] = await Promise.all([
      // Total leads este mes
      supabase
        .from("customers")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .gte("created_at", startOfMonth),

      // Total leads mes anterior
      supabase
        .from("customers")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .gte("created_at", startOfLastMonth)
        .lte("created_at", endOfLastMonth),

      // Conversaciones activas
      supabase
        .from("chats")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("status", "active"),

      // Total clientes
      supabase
        .from("customers")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId),

      // Leads de WhatsApp
      supabase
        .from("customers")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("acquisition_channel", "whatsapp"),

      // Compradores recurrentes
      supabase
        .from("customers")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .in("category", ["recurrente", "vip", "fieles 1", "fieles 2", "fieles 3", "fieles 4"]),

      // Pendiente seguimiento
      supabase
        .from("customers")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .in("category", ["riesgo", "inactivo"]),

      // Todos los clientes para calcular intent scores
      supabase
        .from("customers")
        .select("category, orders(id, total, status)")
        .eq("organization_id", orgId),
    ])

    // Calcular growth
    const thisMonthCount = leadsThisMonth.count || 0
    const lastMonthCount = leadsLastMonth.count || 0
    const growthPercent = lastMonthCount > 0
      ? Math.round(((thisMonthCount - lastMonthCount) / lastMonthCount) * 100)
      : thisMonthCount > 0 ? 100 : 0

    // Calcular intent score counts
    const intentScoreCounts: CustomerStats["intentScoreCounts"] = {
      alta: 0,
      media: 0,
      baja: 0,
      riesgo: 0,
    }

    if (customersForScore.data) {
      for (const customer of customersForScore.data) {
        const orders = (customer as any).orders || []
        const completedOrders = orders.filter((o: any) =>
          o.status && !['cancelled', 'cancelado', 'refunded', 'reembolsado'].includes(o.status.toLowerCase())
        )
        const score = computeIntentScore({
          category: customer.category,
          total_orders: completedOrders.length,
          total_spent: completedOrders.reduce((sum: number, o: any) => sum + (o.total || 0), 0),
        })
        intentScoreCounts[score]++
      }
    }

    return {
      success: true,
      data: {
        totalLeadsThisMonth: thisMonthCount,
        leadsGrowthPercent: growthPercent,
        activeConversations: activeChats.count || 0,
        avgResponseTime: "2m",
        segments: {
          all: allCustomers.count || 0,
          whatsappLeads: whatsappLeads.count || 0,
          recurringBuyers: recurringBuyers.count || 0,
          pendingFollowUp: pendingFollowUp.count || 0,
        },
        intentScoreCounts,
      },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error fetching customer stats",
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
