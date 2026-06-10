"use server"

import { createClient, createServiceClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { type ActionResult, success, failure } from "@/types"
import { localeSettingsSchema, type LocaleSettingsInput } from "@/lib/i18n/locale-settings"

export interface OrganizationData {
    id: string
    name: string
    slug: string
    contact_email?: string
    status: 'active' | 'suspended' | 'archived'
    onboarding_completed: boolean
    created_at: string
    // i18n Fase 1 (single-locale-per-tenant)
    currency_code?: string
    locale?: string
    country_code?: string
    // Metrics (joined)
    users_count?: number
    chats_count?: number
}

export async function getOrganizations(page = 1, limit = 10, search = "") {
    const supabase = createServiceClient()

    // Calculate offset
    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabase
        .from("organizations")
        .select(`
            *,
            profiles:profiles(count),
            chats:chats(count)
        `, { count: 'exact' })
        .order("created_at", { ascending: false })
        .range(from, to)

    if (search) {
        query = query.ilike('name', `%${search}%`)
    }

    const { data, error, count } = await query

    if (error) {
        console.error("Error fetching organizations:", error)
        throw new Error("Failed to fetch organizations")
    }

    // Transform data to include counts properly
    type OrgRow = OrganizationData & {
        profiles?: { count: number }[]
        chats?: { count: number }[]
    }
    const organizations = (data as OrgRow[]).map((org) => ({
        ...org,
        users_count: org.profiles?.[0]?.count || 0,
        chats_count: org.chats?.[0]?.count || 0
    }))

    return {
        organizations,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
    }
}

/**
 * Actualiza moneda/idioma/país de cualquier organización (solo superadmin).
 *
 * Usa `createServiceClient()` para poder editar orgs ajenas, por eso el
 * guard explícito de `is_superadmin` ANTES de tocar datos (el layout de
 * /admin protege la UI, pero las server actions son invocables por fuera).
 *
 * Nota Fase 1: cambiar la moneda NO convierte precios — los precios
 * existentes se interpretan en la nueva moneda (single-locale-per-tenant).
 */
export async function updateOrganizationLocale(
    organizationId: string,
    input: LocaleSettingsInput
): Promise<ActionResult<void>> {
    try {
        const authClient = await createClient()
        const { data: { user } } = await authClient.auth.getUser()
        if (!user) return failure("No autorizado")

        const { data: profile } = await authClient
            .from("profiles")
            .select("is_superadmin")
            .eq("id", user.id)
            .single()

        if (!profile?.is_superadmin) return failure("No autorizado")

        const validation = localeSettingsSchema.safeParse(input)
        if (!validation.success) {
            return failure(validation.error.issues[0]?.message || "Datos inválidos")
        }

        const supabase = createServiceClient()
        const { error } = await supabase
            .from("organizations")
            .update(validation.data)
            .eq("id", organizationId)

        if (error) {
            console.error("Error updating organization locale:", error)
            return failure("Error al actualizar idioma y moneda")
        }

        revalidatePath("/admin/organizations")
        return success(undefined)
    } catch (error) {
        console.error("Error in updateOrganizationLocale:", error)
        return failure("Error inesperado al actualizar idioma y moneda")
    }
}

export async function updateOrganizationStatus(id: string, status: 'active' | 'suspended' | 'archived') {
    const supabase = createServiceClient()

    const { error } = await supabase
        .from("organizations")
        .update({ status })
        .eq("id", id)

    if (error) {
        console.error("Error updating organization status:", error)
        throw new Error("Failed to update organization status")
    }

    revalidatePath("/admin/organizations")
    return { success: true }
}

export async function deleteOrganization(id: string): Promise<{ success: boolean; error?: string }> {
    const supabase = createServiceClient()

    try {
        // 1. Verificar que la org existe y obtener info
        const { data: org, error: orgError } = await supabase
            .from("organizations")
            .select("id, name, slug")
            .eq("id", id)
            .single()

        if (orgError || !org) {
            return { success: false, error: "Organización no encontrada" }
        }

        // 2. Eliminar datos relacionados en orden (respetando FK)
        // Obtener IDs de chats para eliminar mensajes
        const { data: chatRows } = await supabase
            .from("chats")
            .select("id")
            .eq("organization_id", id)

        const chatIds = chatRows?.map((c: { id: string }) => c.id) || []

        // Mensajes de chats
        if (chatIds.length > 0) {
            await supabase.from("messages").delete().in("chat_id", chatIds)
        }

        // Chats
        await supabase.from("chats").delete().eq("organization_id", id)

        // Productos (imágenes, variantes, etc. se eliminan por CASCADE en FK)
        await supabase.from("products").delete().eq("organization_id", id)

        // Agentes
        await supabase.from("agents").delete().eq("organization_id", id)

        // Categorías
        await supabase.from("categories").delete().eq("organization_id", id)

        // Customers
        await supabase.from("customers").delete().eq("organization_id", id)

        // Orders
        await supabase.from("orders").delete().eq("organization_id", id)

        // Suscripciones
        await supabase.from("subscriptions").delete().eq("organization_id", id)

        // Founding slots
        await supabase.from("founding_slots").delete().eq("organization_id", id)

        // 3. Desvincular perfiles (no eliminar usuarios, solo quitar org)
        await supabase
            .from("profiles")
            .update({ organization_id: null })
            .eq("organization_id", id)

        // 4. Eliminar la organización
        const { error: deleteError } = await supabase
            .from("organizations")
            .delete()
            .eq("id", id)

        if (deleteError) {
            console.error("Error deleting organization:", deleteError)
            return { success: false, error: `Error al eliminar: ${deleteError.message}` }
        }

        revalidatePath("/admin/organizations")
        return { success: true }
    } catch (error) {
        console.error("Error in deleteOrganization:", error)
        return { success: false, error: "Error inesperado al eliminar la organización" }
    }
}
