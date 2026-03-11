/**
 * Repositorio de Citas/Appointments
 *
 * Centraliza queries a la tabla `appointments`.
 * Siempre recibe el cliente Supabase como parámetro (nunca lo crea).
 * Siempre filtra por organization_id.
 *
 * Conectado actualmente:
 * - (archivo nuevo, aún no conectado a consumidores)
 *
 * Pendiente de migrar:
 * - tool-executor.ts (checkAvailability, scheduleAppointment)
 * - dashboard/appointments/actions.ts
 * - dashboard/dashboard-actions.ts (KPIs RE)
 * - dashboard/leads/actions.ts, leads/[phone]/actions.ts
 * - api/bookings/create/route.ts, api/bookings/availability/route.ts
 * - lib/advisors/assignment.ts
 */

import { logger } from "@/lib/logger"

const log = logger("repositories/appointments")

// Campos que nunca deben ser mutados por el caller
const PROTECTED_FIELDS = ["organization_id", "id"]

// ============================================
// Queries de lectura
// ============================================

/**
 * Obtener citas en un rango de fechas con status activo (para checkAvailability)
 */
export async function getActiveAppointmentsInRange(
    supabase: any,
    organizationId: string,
    startDate: string,
    endDate: string
): Promise<{ id: string; title: string; proposed_date: string; proposed_end_date: string | null; status: string }[]> {
    const { data } = await supabase
        .from("appointments")
        .select("id, title, proposed_date, proposed_end_date, status")
        .eq("organization_id", organizationId)
        .in("status", ["pending", "confirmed"])
        .gte("proposed_date", startDate)
        .lte("proposed_date", endDate)
        .order("proposed_date", { ascending: true })
    return data || []
}

/**
 * Verificar conflictos de horario (para scheduleAppointment).
 * Usa lógica estricta de solapamiento: existing.start < newEnd AND existing.end > newStart
 * Citas pegadas al borde (ej: una termina a 10:00, otra empieza a 10:00) NO son conflicto.
 */
export async function getConflictingAppointments(
    supabase: any,
    organizationId: string,
    startDate: string,
    endDate: string
): Promise<{ id: string; title: string; proposed_date: string; proposed_end_date: string | null }[]> {
    const { data } = await supabase
        .from("appointments")
        .select("id, title, proposed_date, proposed_end_date")
        .eq("organization_id", organizationId)
        .in("status", ["pending", "confirmed"])
        .lt("proposed_date", endDate)
        .gt("proposed_end_date", startDate)
    return data || []
}

/**
 * Obtener citas recientes con status (para dashboard RE KPIs)
 */
export async function getRecentAppointments(
    supabase: any,
    organizationId: string,
    since: string
): Promise<{ id: string; status: string }[]> {
    const { data } = await supabase
        .from("appointments")
        .select("id, status")
        .eq("organization_id", organizationId)
        .gte("created_at", since)
    return data || []
}

// ============================================
// Queries de escritura
// ============================================

/**
 * Crear una cita. Retorna la fila creada.
 * organization_id se establece desde el parámetro, no desde data (previene override).
 */
export async function createAppointment(
    supabase: any,
    organizationId: string,
    data: Record<string, unknown>
): Promise<{ data: any | null; error: string | null }> {
    // Sanitizar: no permitir override de organization_id desde data
    const sanitized = { ...data }
    for (const field of PROTECTED_FIELDS) {
        delete sanitized[field]
    }

    const insertData = {
        ...sanitized,
        organization_id: organizationId,
    }

    const { data: appointment, error } = await supabase
        .from("appointments")
        .insert(insertData)
        .select()
        .single()

    if (error) {
        log.error("Error creating appointment", { error: error.message })
        return { data: null, error: error.message }
    }
    return { data: appointment, error: null }
}

/**
 * Actualizar campos de una cita (ej: google_event_id después de sync con GCal).
 * Campos protegidos (organization_id, id) se eliminan automáticamente de fields.
 */
export async function updateAppointment(
    supabase: any,
    organizationId: string,
    appointmentId: string,
    fields: Record<string, unknown>
): Promise<boolean> {
    // Sanitizar: no permitir mutación de campos protegidos
    const sanitized = { ...fields }
    for (const field of PROTECTED_FIELDS) {
        delete sanitized[field]
    }

    const { error } = await supabase
        .from("appointments")
        .update(sanitized)
        .eq("id", appointmentId)
        .eq("organization_id", organizationId)

    if (error) {
        log.error("Error updating appointment", { appointmentId, error: error.message })
        return false
    }
    return true
}
