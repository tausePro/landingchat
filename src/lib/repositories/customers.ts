/**
 * Repositorio de Clientes/Leads
 *
 * Centraliza queries a la tabla `customers`.
 * Siempre recibe el cliente Supabase como parámetro (nunca lo crea).
 * Siempre filtra por organization_id en toda operación.
 *
 * Conectado actualmente:
 * - (archivo nuevo, aún no conectado a consumidores)
 *
 * Pendiente de migrar:
 * - tool-executor.ts (identifyCustomer, getCustomerHistory)
 * - unified.ts (identifyCustomer en sendResponse flow)
 * - webhook-utils.ts, identify route, chat init, dashboard, leads, etc.
 */

import { logger } from "@/lib/logger"

const log = logger("repositories/customers")

// ============================================
// Tipos
// ============================================

export interface CustomerCreateInput {
    organizationId: string
    fullName?: string
    email?: string | null
    phone?: string | null
    source?: string
    metadata?: Record<string, unknown>
}

export interface CustomerUpdateInput {
    fullName?: string
    email?: string | null
    phone?: string | null
    lastInteractionAt?: string
    metadata?: Record<string, unknown>
    [key: string]: unknown
}

// ============================================
// Queries
// ============================================

/**
 * Buscar cliente por email con prioridad, fallback a phone.
 * Replica el comportamiento de tool-executor.ts identifyCustomer:
 * si hay email lo usa primero; si no, usa phone.
 * Incluye órdenes para determinar si es returning customer.
 */
export async function findCustomerByEmailThenPhone(
    supabase: any,
    organizationId: string,
    options: { email?: string | null; phone?: string | null }
): Promise<any | null> {
    const { email, phone } = options

    // Prioridad: email primero (como tool-executor.ts)
    if (email) {
        const { data } = await supabase
            .from("customers")
            .select("*, orders(id, total, status, created_at)")
            .eq("organization_id", organizationId)
            .eq("email", email)
            .limit(1)
            .single()
        if (data) return data
    }

    // Fallback: phone
    if (phone) {
        const { data } = await supabase
            .from("customers")
            .select("*, orders(id, total, status, created_at)")
            .eq("organization_id", organizationId)
            .eq("phone", phone)
            .limit(1)
            .single()
        if (data) return data
    }

    return null
}

/**
 * Buscar cliente por phone con prioridad, fallback a email.
 * Replica el comportamiento de unified.ts identifyCustomer:
 * canales WhatsApp priorizan phone.
 */
export async function findCustomerByPhoneThenEmail(
    supabase: any,
    organizationId: string,
    options: { phone?: string | null; email?: string | null }
): Promise<{ id: string } | null> {
    const { phone, email } = options

    if (phone) {
        const { data } = await supabase
            .from("customers")
            .select("id")
            .eq("organization_id", organizationId)
            .eq("phone", phone)
            .limit(1)
            .single()
        if (data) return data
    }

    if (email) {
        const { data } = await supabase
            .from("customers")
            .select("id")
            .eq("organization_id", organizationId)
            .eq("email", email)
            .limit(1)
            .single()
        if (data) return data
    }

    return null
}

/**
 * Buscar cliente por ID dentro de una organización
 */
export async function findCustomerById(
    supabase: any,
    organizationId: string,
    customerId: string
): Promise<any | null> {
    const { data } = await supabase
        .from("customers")
        .select("full_name, email, phone, metadata, total_orders, total_spent, document_type, document_number, person_type, business_name")
        .eq("id", customerId)
        .eq("organization_id", organizationId)
        .single()
    return data || null
}

/**
 * Crear un nuevo cliente. Retorna la fila creada (id + campos).
 */
export async function createCustomer(
    supabase: any,
    input: CustomerCreateInput
): Promise<any | null> {
    const { data, error } = await supabase
        .from("customers")
        .insert({
            organization_id: input.organizationId,
            full_name: input.fullName || (input.phone ? `WhatsApp ${input.phone.slice(-4)}` : "Cliente"),
            email: input.email || null,
            phone: input.phone || null,
            name: input.fullName || (input.phone ? `WhatsApp ${input.phone.slice(-4)}` : "Cliente"),
            source: input.source || "web",
            last_interaction_at: new Date().toISOString(),
            metadata: input.metadata || {},
        })
        .select()
        .single()

    if (error) {
        log.error("Error creating customer", { error: error.message })
        return null
    }
    return data
}

/**
 * Actualizar un cliente existente. Retorna la fila actualizada o null.
 */
export async function updateCustomer(
    supabase: any,
    organizationId: string,
    customerId: string,
    fields: CustomerUpdateInput
): Promise<any | null> {
    const updateData: Record<string, unknown> = {}
    if (fields.fullName !== undefined) updateData.full_name = fields.fullName
    if (fields.email !== undefined) updateData.email = fields.email
    if (fields.phone !== undefined) updateData.phone = fields.phone
    if (fields.lastInteractionAt !== undefined) updateData.last_interaction_at = fields.lastInteractionAt
    if (fields.metadata !== undefined) updateData.metadata = fields.metadata

    // Pasar campos extra directamente (instagram_id, messenger_id, etc.)
    for (const [key, value] of Object.entries(fields)) {
        if (!["fullName", "email", "phone", "lastInteractionAt", "metadata"].includes(key)) {
            updateData[key] = value
        }
    }

    const { data, error } = await supabase
        .from("customers")
        .update(updateData)
        .eq("id", customerId)
        .eq("organization_id", organizationId)
        .select()
        .single()

    if (error) {
        log.error("Error updating customer", { customerId, error: error.message })
        return null
    }
    return data
}

/**
 * Eliminar un cliente dentro de una organización (para merge de shell customers)
 */
export async function deleteCustomer(
    supabase: any,
    organizationId: string,
    customerId: string
): Promise<boolean> {
    const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", customerId)
        .eq("organization_id", organizationId)

    if (error) {
        log.error("Error deleting customer", { customerId, error: error.message })
        return false
    }
    return true
}

/**
 * Contar clientes nuevos en un período (para dashboard)
 */
export async function countNewCustomers(
    supabase: any,
    organizationId: string,
    since: string
): Promise<number> {
    const { count } = await supabase
        .from("customers")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .gte("created_at", since)
    return count || 0
}

/**
 * Obtener leads recientes con canal (para dashboard RE)
 */
export async function getRecentLeadsWithChannel(
    supabase: any,
    organizationId: string,
    since: string
): Promise<{ id: string; channel?: string }[]> {
    const { data } = await supabase
        .from("customers")
        .select("id, channel")
        .eq("organization_id", organizationId)
        .gte("created_at", since)
    return data || []
}
