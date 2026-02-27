"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { listSubCalendars } from "@/lib/calendar/google-calendar"
import type { WorkingHours } from "@/lib/advisors/assignment"

interface ActionResult {
    success: boolean
    error?: string
}

/**
 * Obtiene los asesores de la organización del usuario.
 */
export async function getOrgAdvisors() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) return []

    const { data } = await supabase
        .from("advisors")
        .select("*")
        .eq("organization_id", profile.organization_id)
        .order("name")

    return data || []
}

/**
 * Obtiene los sub-calendarios de Google Calendar disponibles.
 */
export async function getGoogleCalendars() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) return []

    const calendars = await listSubCalendars(profile.organization_id)
    return calendars || []
}

/**
 * Crea un nuevo asesor.
 */
export async function createAdvisor(input: {
    name: string
    specialty: "sales" | "rentals" | "both"
    color: string
    google_calendar_id?: string
    working_hours: WorkingHours
}): Promise<ActionResult> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: "No autorizado" }

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) return { success: false, error: "Sin organización" }

    const { error } = await supabase
        .from("advisors")
        .insert({
            organization_id: profile.organization_id,
            name: input.name,
            specialty: input.specialty,
            color: input.color,
            google_calendar_id: input.google_calendar_id || null,
            working_hours: input.working_hours,
            is_active: true,
        })

    if (error) return { success: false, error: error.message }

    revalidatePath("/dashboard/settings/advisors")
    return { success: true }
}

/**
 * Actualiza un asesor existente.
 */
export async function updateAdvisor(
    advisorId: string,
    input: {
        name?: string
        specialty?: "sales" | "rentals" | "both"
        color?: string
        google_calendar_id?: string | null
        working_hours?: WorkingHours
        is_active?: boolean
    }
): Promise<ActionResult> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: "No autorizado" }

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) return { success: false, error: "Sin organización" }

    const { error } = await supabase
        .from("advisors")
        .update(input)
        .eq("id", advisorId)
        .eq("organization_id", profile.organization_id)

    if (error) return { success: false, error: error.message }

    revalidatePath("/dashboard/settings/advisors")
    return { success: true }
}

/**
 * Elimina un asesor.
 */
export async function deleteAdvisor(advisorId: string): Promise<ActionResult> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: "No autorizado" }

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) return { success: false, error: "Sin organización" }

    const { error } = await supabase
        .from("advisors")
        .delete()
        .eq("id", advisorId)
        .eq("organization_id", profile.organization_id)

    if (error) return { success: false, error: error.message }

    revalidatePath("/dashboard/settings/advisors")
    return { success: true }
}
