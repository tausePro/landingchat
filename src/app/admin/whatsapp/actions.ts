"use server"

import { createClient } from "@/lib/supabase/server"
import {
    type ActionResult,
    success,
    failure,
    type WhatsAppInstance,
    deserializeWhatsAppInstance,
} from "@/types"

/**
 * Verifica que el usuario sea superadmin
 */
async function checkSuperAdmin() {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) return false

    const { data: profile } = await supabase
        .from("profiles")
        .select("is_superadmin")
        .eq("id", user.id)
        .single()

    return profile?.is_superadmin === true
}

/**
 * Obtiene todas las instancias de WhatsApp
 */
export async function getAllInstances(filters?: {
    organizationId?: string
    status?: string
}): Promise<ActionResult<WhatsAppInstance[]>> {
    try {
        const isSuperAdmin = await checkSuperAdmin()
        if (!isSuperAdmin) {
            return failure("No autorizado")
        }

        const supabase = await createClient()
        let query = supabase
            .from("whatsapp_instances")
            .select(
                `
                *,
                organizations (
                    name,
                    slug
                )
            `
            )
            .order("created_at", { ascending: false })

        if (filters?.organizationId) {
            query = query.eq("organization_id", filters.organizationId)
        }

        if (filters?.status) {
            query = query.eq("status", filters.status)
        }

        const { data, error } = await query

        if (error) {
            return failure(error.message)
        }

        const instances = data.map((item) => deserializeWhatsAppInstance(item))
        return success(instances)
    } catch (error) {
        return failure(
            error instanceof Error ? error.message : "Error al obtener instancias"
        )
    }
}

/**
 * Desconecta una instancia de WhatsApp
 */
export async function disconnectInstance(
    instanceId: string
): Promise<ActionResult<void>> {
    try {
        const isSuperAdmin = await checkSuperAdmin()
        if (!isSuperAdmin) {
            return failure("No autorizado")
        }

        const supabase = await createClient()

        // Actualizar estado en DB
        const { error } = await supabase
            .from("whatsapp_instances")
            .update({
                status: "disconnected",
                disconnected_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq("id", instanceId)

        if (error) {
            return failure(error.message)
        }

        // TODO: Llamar a Evolution API para desconectar la instancia

        return success(undefined)
    } catch (error) {
        return failure(
            error instanceof Error ? error.message : "Error al desconectar instancia"
        )
    }
}
