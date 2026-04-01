"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import {
    getCalendarEventsForRange,
    updateManagedAppointmentStatus,
    type AppointmentStatus,
    type CalendarEventItem,
} from "@/lib/appointments/service"

export type CalendarEvent = CalendarEventItem

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
    return getCalendarEventsForRange(supabase, profile.organization_id, startDate)
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

        const result = await updateManagedAppointmentStatus(supabase, {
            organizationId: profile.organization_id,
            appointmentId,
            newStatus,
        })

        if (!result.success) {
            return result
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
