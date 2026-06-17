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
  type ImportCustomerRow,
  type CustomerStats,
} from "@/types/customer"
import { computeIntentScore, type IntentScore } from "./lib/intent-score"
import { fetchAllPages } from "@/lib/supabase/fetch-all"

// Cliente con sus pedidos embebidos (para computar comportamiento)
type CustomerWithOrders = Customer & {
  orders?: Array<{ id: string; total: number | null; status: string | null }>
}

const isCompletedOrder = (o: { status: string | null }): boolean =>
  Boolean(o.status) && !["cancelled", "cancelado", "refunded", "reembolsado"].includes((o.status || "").toLowerCase())

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

    // Traemos TODOS los clientes que matchean los filtros de COLUMNA (search,
    // category, channel, zone, tags) y computamos en memoria. Los segmentos y el
    // intent score son por COMPORTAMIENTO (nº de pedidos) — las categorías en la
    // práctica vienen null — así que NO se pueden filtrar en SQL. Paginar en DB
    // primero rompía el filtro por score: solo veía 25 filas y devolvía 0.
    const { rows, error } = await fetchAllPages<CustomerWithOrders>((from, to) => {
      let q = supabase
        .from("customers")
        .select("*, orders(id, total, status)")
        .eq("organization_id", profile.organization_id)
      if (search) {
        q = q.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)
      }
      if (category && category !== "all") q = q.eq("category", category)
      if (channel && channel !== "all") q = q.eq("acquisition_channel", channel)
      if (zone && zone !== "all") q = q.eq("address->>zone", zone)
      if (tags && tags.length > 0) q = q.contains("tags", tags)
      return q.order("created_at", { ascending: false }).range(from, to)
    }, { maxRows: 20_000 })

    if (error) {
      return { success: false, error: `Failed to fetch customers: ${error}` }
    }

    // Computar total_orders / total_spent / intent por cliente
    const computed = rows.map((customer) => {
      const completed = (customer.orders || []).filter(isCompletedOrder)
      const total_orders = completed.length
      const total_spent = completed.reduce((sum, o) => sum + (o.total || 0), 0)
      const intent = computeIntentScore({
        category: customer.category,
        total_orders,
        total_spent,
        last_interaction_at: customer.last_interaction_at,
      })
      const { orders: _orders, ...rest } = customer
      return { ...rest, total_orders, total_spent, intent }
    })

    // Filtro por SEGMENTO (comportamiento, no strings de categoría)
    let filtered = computed
    if (segment === "recurring") {
      filtered = filtered.filter((c) => c.total_orders >= 2)
    } else if (segment === "whatsapp_leads") {
      filtered = filtered.filter((c) => c.acquisition_channel === "whatsapp")
    } else if (segment === "pending_followup") {
      filtered = filtered.filter((c) => c.intent === "riesgo")
    }

    // Filtro por intent score (sobre el set COMPLETO, no por página)
    if (intentScores && intentScores.length > 0) {
      filtered = filtered.filter((c) => intentScores.includes(c.intent))
    }

    // Paginación en memoria → total / totalPages correctos sobre el set filtrado
    const total = filtered.length
    const totalPages = Math.max(1, Math.ceil(total / limit))
    const startIdx = (page - 1) * limit
    const pageItems = filtered.slice(startIdx, startIdx + limit)

    return {
      success: true,
      data: {
        customers: pageItems as Customer[],
        total,
        totalPages,
      },
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

    // Queries en paralelo. Los segmentos "recurrentes" y "pendiente seguimiento"
    // y los intent scores se computan por COMPORTAMIENTO (nº de pedidos) sobre
    // todos los clientes (scoreRows), NO por strings de categoría (vienen null).
    // scoreRows pagina con fetchAllPages para no caer en el cap de 1000.
    const [
      leadsThisMonth,
      leadsLastMonth,
      activeChats,
      allCustomers,
      whatsappLeads,
      scoreRows,
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

      // Todos los clientes + pedidos para computar intent y segmentos
      fetchAllPages<{ category: string | null; orders: Array<{ total: number | null; status: string | null }> | null }>(
        (from, to) =>
          supabase
            .from("customers")
            .select("category, orders(id, total, status)")
            .eq("organization_id", orgId)
            .range(from, to),
        { maxRows: 20_000 }
      ),
    ])

    // Calcular growth
    const thisMonthCount = leadsThisMonth.count || 0
    const lastMonthCount = leadsLastMonth.count || 0
    const growthPercent = lastMonthCount > 0
      ? Math.round(((thisMonthCount - lastMonthCount) / lastMonthCount) * 100)
      : thisMonthCount > 0 ? 100 : 0

    // Calcular intent score counts + segmentos por comportamiento (un solo loop)
    const intentScoreCounts: CustomerStats["intentScoreCounts"] = {
      alta: 0,
      media: 0,
      baja: 0,
      riesgo: 0,
    }
    let recurringBuyersCount = 0
    let pendingFollowUpCount = 0

    for (const customer of scoreRows.rows) {
      const completedOrders = (customer.orders || []).filter(isCompletedOrder)
      const total_orders = completedOrders.length
      const total_spent = completedOrders.reduce((sum, o) => sum + (o.total || 0), 0)
      const score = computeIntentScore({ category: customer.category, total_orders, total_spent })
      intentScoreCounts[score]++
      if (total_orders >= 2) recurringBuyersCount++
      if (score === "riesgo") pendingFollowUpCount++
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
          recurringBuyers: recurringBuyersCount,
          pendingFollowUp: pendingFollowUpCount,
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

    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", customerId)
      .eq("organization_id", profile.organization_id)

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

export async function deleteCustomers(
  customerIds: string[]
): Promise<ActionResult<{ deleted: number }>> {
  try {
    if (customerIds.length === 0) {
      return { success: false, error: "No customers selected" }
    }

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

    const { error, count } = await supabase
      .from("customers")
      .delete({ count: "exact" })
      .in("id", customerIds)
      .eq("organization_id", profile.organization_id)

    if (error) {
      return { success: false, error: `Failed to delete customers: ${error.message}` }
    }

    revalidatePath("/dashboard/customers")
    return { success: true, data: { deleted: count || 0 } }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error deleting customers"
    }
  }
}

// ============================================================================
// Bulk Import Action
// ============================================================================

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
