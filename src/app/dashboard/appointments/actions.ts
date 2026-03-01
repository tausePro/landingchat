"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { updateCalendarEvent, cancelCalendarEvent, listUpcomingEvents, isCalendarConnected } from "@/lib/calendar/google-calendar"

type AppointmentStatus = "pending" | "confirmed" | "cancelled" | "completed" | "rescheduled"

export interface CalendarEvent {
    id: string
    title: string
    start: string
    end: string
    source: "local" | "google"
    status?: string
    type?: string
    customerName?: string
    customerPhone?: string | null
    location?: string | null
    propertyCode?: string | null
    propertyTitle?: string | null
    advisorName?: string | null
    advisorColor?: string | null
}

/**
 * Obtiene citas locales + eventos de Google Calendar para una semana.
 */
export async function getCalendarEvents(weekStart: string): Promise<{
    events: CalendarEvent[]
    gcalConnected: boolean
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { events: [], gcalConnected: false }

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) return { events: [], gcalConnected: false }

    const startDate = new Date(weekStart)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000)

    const events: CalendarEvent[] = []

    // 1. Citas locales (con propiedad y asesor vinculados si existen)
    const { data: appointments } = await supabase
        .from("appointments")
        .select("id, title, proposed_date, proposed_end_date, status, appointment_type, customer_name, customer_phone, location, google_event_id, property_id, assigned_to, properties(external_code, title), advisors(name, color)")
        .eq("organization_id", profile.organization_id)
        .gte("proposed_date", startDate.toISOString())
        .lte("proposed_date", endDate.toISOString())
        .order("proposed_date", { ascending: true })

    for (const apt of (appointments || [])) {
        const prop = apt.properties as any
        const advisor = apt.advisors as any
        events.push({
            id: apt.id,
            title: apt.title,
            start: apt.proposed_date,
            end: apt.proposed_end_date || new Date(new Date(apt.proposed_date).getTime() + 60 * 60 * 1000).toISOString(),
            source: "local",
            status: apt.status,
            type: apt.appointment_type,
            customerName: apt.customer_name,
            customerPhone: apt.customer_phone,
            location: apt.location,
            propertyCode: prop?.external_code || null,
            propertyTitle: prop?.title || null,
            advisorName: advisor?.name || null,
            advisorColor: advisor?.color || null,
        })
    }

    // 2. Eventos de Google Calendar (solo los que NO son citas locales)
    let gcalConnected = false
    try {
        gcalConnected = await isCalendarConnected(profile.organization_id)
        console.log(`[getCalendarEvents] GCal connected: ${gcalConnected} for org ${profile.organization_id}`)

        if (gcalConnected) {
            const gcalEvents = await listUpcomingEvents(profile.organization_id, startDate, endDate, 50)
            console.log(`[getCalendarEvents] GCal events fetched: ${gcalEvents?.length || 0}`)

            const localGoogleIds = new Set(
                (appointments || []).filter((a: any) => a.google_event_id).map((a: any) => a.google_event_id)
            )

            for (const gEvent of (gcalEvents || [])) {
                if (!localGoogleIds.has(gEvent.id)) {
                    events.push({
                        id: `gcal-${gEvent.id}`,
                        title: gEvent.summary,
                        start: gEvent.start,
                        end: gEvent.end,
                        source: "google",
                    })
                }
            }
            console.log(`[getCalendarEvents] Total events after merge: ${events.length}`)
        }
    } catch (error) {
        console.error("[getCalendarEvents] GCal fetch failed:", error)
    }

    return { events, gcalConnected }
}

interface UpdateResult {
    success: boolean
    error?: string
}

/**
 * Confirma una cita y actualiza Google Calendar si está conectado.
 */
export async function confirmAppointment(appointmentId: string): Promise<UpdateResult> {
    return updateAppointmentStatus(appointmentId, "confirmed")
}

/**
 * Cancela una cita y elimina el evento de Google Calendar si existe.
 */
export async function cancelAppointment(appointmentId: string): Promise<UpdateResult> {
    return updateAppointmentStatus(appointmentId, "cancelled")
}

/**
 * Marca una cita como completada.
 */
export async function completeAppointment(appointmentId: string): Promise<UpdateResult> {
    return updateAppointmentStatus(appointmentId, "completed")
}

/**
 * Actualiza el estado de una cita con sync a Google Calendar.
 */
async function updateAppointmentStatus(
    appointmentId: string,
    newStatus: AppointmentStatus
): Promise<UpdateResult> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) return { success: false, error: "No autorizado" }

        const { data: profile } = await supabase
            .from("profiles")
            .select("organization_id")
            .eq("id", user.id)
            .single()

        if (!profile?.organization_id) return { success: false, error: "Sin organización" }

        // Obtener la cita actual (verificar pertenencia a la org)
        const { data: appointment, error: fetchError } = await supabase
            .from("appointments")
            .select("id, status, google_event_id, organization_id")
            .eq("id", appointmentId)
            .eq("organization_id", profile.organization_id)
            .single()

        if (fetchError || !appointment) {
            return { success: false, error: "Cita no encontrada" }
        }

        // Validar transiciones de estado válidas
        const validTransitions: Record<string, AppointmentStatus[]> = {
            pending: ["confirmed", "cancelled"],
            confirmed: ["completed", "cancelled", "rescheduled"],
            rescheduled: ["confirmed", "cancelled"],
        }

        const allowed = validTransitions[appointment.status]
        if (!allowed || !allowed.includes(newStatus)) {
            return {
                success: false,
                error: `No se puede cambiar de "${appointment.status}" a "${newStatus}"`
            }
        }

        // Actualizar en BD
        const { error: updateError } = await supabase
            .from("appointments")
            .update({
                status: newStatus,
                updated_at: new Date().toISOString(),
            })
            .eq("id", appointmentId)

        if (updateError) {
            return { success: false, error: updateError.message }
        }

        // Sync con Google Calendar (non-blocking)
        if (appointment.google_event_id) {
            try {
                if (newStatus === "cancelled") {
                    await cancelCalendarEvent(
                        profile.organization_id,
                        appointment.google_event_id
                    )
                } else if (newStatus === "confirmed") {
                    await updateCalendarEvent(
                        profile.organization_id,
                        appointment.google_event_id,
                        { description: "Estado: Confirmada" }
                    )
                }
            } catch (gcalError) {
                console.warn("[appointments/actions] GCal sync failed (non-blocking):", gcalError)
            }
        }

        revalidatePath("/dashboard/appointments")
        return { success: true }
    } catch (error) {
        console.error("[appointments/actions] Error:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Error desconocido"
        }
    }
}
