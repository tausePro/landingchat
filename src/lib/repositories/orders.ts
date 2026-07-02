/**
 * Repositorio de Órdenes/Pedidos
 *
 * Centraliza queries a la tabla `orders`.
 * Siempre recibe el cliente Supabase como parámetro (nunca lo crea).
 * Siempre filtra por organization_id.
 *
 * Conectado actualmente:
 * - (archivo nuevo, aún no conectado a consumidores)
 *
 * Pendiente de migrar:
 * - tool-executor.ts (getOrderStatus, getCustomerHistory, createPaymentLink, identifyCustomer)
 * - dashboard/orders/actions.ts
 * - dashboard/dashboard-actions.ts (revenue, KPIs)
 * - dashboard/analytics/page.tsx
 * - api/webhooks/payments/ (wompi, epayco)
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { logger } from "@/lib/logger"

const log = logger("repositories/orders")

// Campos que nunca deben ser mutados por el caller
const PROTECTED_FIELDS = ["organization_id", "id"]

// ============================================
// Queries de lectura
// ============================================

/**
 * Obtener orden por ID o por order_number (para getOrderStatus tool)
 */
export async function findOrder(
    supabase: SupabaseClient,
    organizationId: string,
    identifier: string
): Promise<any | null> {
    // Intentar por ID primero
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier)
    if (isUUID) {
        const { data } = await supabase
            .from("orders")
            .select("id, status, total, items, created_at, shipping_cost, payment_method")
            .eq("id", identifier)
            .eq("organization_id", organizationId)
            .single()
        if (data) return data
    }

    // Fallback: por order_number
    const { data } = await supabase
        .from("orders")
        .select("id, status, total, items, created_at, shipping_cost, payment_method")
        .eq("organization_id", organizationId)
        .eq("order_number", identifier)
        .single()
    return data || null
}

/**
 * Obtener órdenes recientes de un cliente (para getCustomerHistory tool)
 */
export async function getCustomerOrders(
    supabase: SupabaseClient,
    organizationId: string,
    customerId: string
): Promise<any[]> {
    const { data } = await supabase
        .from("orders")
        .select("id, items, total, status, created_at, customer_info")
        .eq("organization_id", organizationId)
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(5)
    return data || []
}

/**
 * Verificar si un cliente tiene órdenes (para merge de shell customers)
 */
export async function customerHasOrders(
    supabase: SupabaseClient,
    organizationId: string,
    customerId: string
): Promise<boolean> {
    const { data } = await supabase
        .from("orders")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("customer_id", customerId)
        .limit(1)
    return (data?.length || 0) > 0
}

/**
 * Obtener todas las órdenes de una org en un período (para dashboard/analytics)
 */
export async function getOrgOrders(
    supabase: SupabaseClient,
    organizationId: string,
    options?: { since?: string; statuses?: string[] }
): Promise<any[]> {
    let query = supabase
        .from("orders")
        .select("id, total, created_at, status, payment_status, source_channel, chat_id, utm_data, items, customer_id")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: true })

    if (options?.since) {
        query = query.gte("created_at", options.since)
    }
    if (options?.statuses) {
        query = query.in("status", options.statuses)
    }

    const { data } = await query
    return data || []
}

// ============================================
// Queries de escritura
// ============================================

/**
 * Crear una orden. Retorna id y order_number.
 * organization_id se establece desde el parámetro (previene override).
 */
export async function createOrder(
    supabase: SupabaseClient,
    organizationId: string,
    data: Record<string, unknown>
): Promise<{ data: Record<string, unknown> | null; error: string | null }> {
    const sanitized = { ...data }
    for (const field of PROTECTED_FIELDS) {
        delete sanitized[field]
    }

    const { data: order, error } = await supabase
        .from("orders")
        .insert({
            ...sanitized,
            organization_id: organizationId,
        })
        .select("id, order_number")
        .single()

    if (error) {
        log.error("Error creating order", { error: error.message })
        return { data: null, error: error.message }
    }
    return { data: order, error: null }
}

/**
 * Actualizar campos de una orden.
 * Campos protegidos (organization_id, id) se eliminan automáticamente.
 */
export async function updateOrder(
    supabase: SupabaseClient,
    organizationId: string,
    orderId: string,
    fields: Record<string, unknown>
): Promise<boolean> {
    const sanitized = { ...fields }
    for (const field of PROTECTED_FIELDS) {
        delete sanitized[field]
    }

    const { error } = await supabase
        .from("orders")
        .update(sanitized)
        .eq("id", orderId)
        .eq("organization_id", organizationId)

    if (error) {
        log.error("Error updating order", { orderId, error: error.message })
        return false
    }
    return true
}
