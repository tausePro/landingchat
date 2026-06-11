"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import {
    getCalendarEventsForRange,
    updateManagedAppointmentStatus,
    type AppointmentStatus,
    type CalendarEventItem,
} from "@/lib/appointments/service"
import { resolveBookingHours, type BookingHoursConfig } from "@/lib/appointments/booking-config"
import { type ActionResult, success, failure } from "@/types"
import type { OrganizationSettingsOverrides } from "@/types"

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

// ─── Horario de atención (settings.booking) ───────────────────────

const bookingHoursSchema = z.object({
    dayStartHour: z.number().int().min(0).max(23),
    dayEndHour: z.number().int().min(1).max(24),
    skipSundays: z.boolean(),
}).refine((data) => data.dayEndHour > data.dayStartHour, {
    message: "La hora de cierre debe ser posterior a la de apertura",
    path: ["dayEndHour"],
})

async function getOrganizationForUser() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { supabase, organization: null }

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()
    if (!profile?.organization_id) return { supabase, organization: null }

    const { data: organization } = await supabase
        .from("organizations")
        .select("id, settings")
        .eq("id", profile.organization_id)
        .single()

    return { supabase, organization }
}

/** Lee el horario de atención del org (default 9-18, domingos cerrados). */
export async function getBookingHours(): Promise<ActionResult<BookingHoursConfig>> {
    try {
        const { organization } = await getOrganizationForUser()
        if (!organization) return failure("Organización no encontrada")
        return success(resolveBookingHours(organization.settings))
    } catch (error) {
        console.error("[appointments/booking-hours] Error:", error)
        return failure("Error al cargar el horario")
    }
}

/**
 * Guarda el horario de atención en settings.booking preservando el resto
 * del JSONB. Afecta los slots ofrecidos por el chat AI, el storefront y
 * la API pública de bookings.
 */
export async function updateBookingHours(input: BookingHoursConfig): Promise<ActionResult<void>> {
    try {
        const validation = bookingHoursSchema.safeParse(input)
        if (!validation.success) {
            return failure(validation.error.issues[0]?.message || "Datos inválidos")
        }

        const { supabase, organization } = await getOrganizationForUser()
        if (!organization) return failure("Organización no encontrada")

        const currentSettings = (organization.settings as OrganizationSettingsOverrides | null) ?? {}
        const nextSettings: OrganizationSettingsOverrides = {
            ...currentSettings,
            booking: {
                ...(currentSettings.booking ?? {}),
                day_start_hour: validation.data.dayStartHour,
                day_end_hour: validation.data.dayEndHour,
                skip_sundays: validation.data.skipSundays,
            },
        }

        const { error } = await supabase
            .from("organizations")
            .update({ settings: nextSettings })
            .eq("id", organization.id)

        if (error) return failure("No se pudo guardar el horario")

        revalidatePath("/dashboard/appointments")
        return success(undefined)
    } catch (error) {
        console.error("[appointments/booking-hours] Error updating:", error)
        return failure("Error inesperado al guardar el horario")
    }
}
