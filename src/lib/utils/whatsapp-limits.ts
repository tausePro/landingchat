/**
 * Utilidades para gestión de límites de conversaciones WhatsApp
 */

import { createServiceClient } from "@/lib/supabase/server"

interface ConversationLimitResult {
    allowed: boolean
    used: number
    limit: number
    percentage: number
}

/**
 * Verifica si una organización puede crear más conversaciones WhatsApp
 */
export async function checkConversationLimit(
    organizationId: string
): Promise<ConversationLimitResult> {
    const supabase = await createServiceClient()

    // Obtener organización con su plan
    const { data: org } = await supabase
        .from("organizations")
        .select(
            `
            id,
            whatsapp_conversations_used,
            subscriptions!inner(
                plans!inner(max_whatsapp_conversations)
            )
        `
        )
        .eq("id", organizationId)
        .single()

    if (!org) {
        return {
            allowed: false,
            used: 0,
            limit: 0,
            percentage: 0,
        }
    }

    const subscription = org.subscriptions?.[0] as any
    const limit = subscription?.plans?.max_whatsapp_conversations || 0
    const used = org.whatsapp_conversations_used || 0
    const percentage = limit > 0 ? (used / limit) * 100 : 0

    return {
        allowed: used < limit,
        used,
        limit,
        percentage,
    }
}

/**
 * Incrementa el contador de conversaciones usadas
 */
export async function incrementConversationCount(
    organizationId: string
): Promise<boolean> {
    try {
        const supabase = await createServiceClient()

        await supabase.rpc("increment_whatsapp_conversations", {
            org_id: organizationId,
        })

        return true
    } catch (error) {
        console.error("[WhatsApp Limits] Error incrementing conversation count:", error)
        return false
    }
}

/**
 * Resetea los contadores mensuales de todas las organizaciones
 * Esta función debe ser ejecutada por un cron job al inicio de cada mes
 */
export async function resetMonthlyCounters(): Promise<{
    success: boolean
    organizationsReset: number
}> {
    try {
        const supabase = await createServiceClient()

        // Ejecutar función RPC que resetea todos los contadores
        await supabase.rpc("reset_all_whatsapp_counters")

        // Contar organizaciones afectadas
        const { count } = await supabase
            .from("organizations")
            .select("id", { count: "exact", head: true })

        return {
            success: true,
            organizationsReset: count || 0,
        }
    } catch (error) {
        console.error("[WhatsApp Limits] Error resetting monthly counters:", error)
        return {
            success: false,
            organizationsReset: 0,
        }
    }
}

/**
 * Obtiene el uso actual de WhatsApp para una organización
 */
export async function getWhatsAppUsage(organizationId: string): Promise<{
    conversationsUsed: number
    conversationsLimit: number
    messagesThisMonth: number
    percentageUsed: number
    isNearLimit: boolean
}> {
    const supabase = await createServiceClient()

    // Obtener datos de la organización y su plan
    const { data: org } = await supabase
        .from("organizations")
        .select(
            `
            whatsapp_conversations_used,
            subscriptions!inner(
                plans!inner(max_whatsapp_conversations)
            )
        `
        )
        .eq("id", organizationId)
        .single()

    // Obtener métricas de la instancia
    const { data: instance } = await supabase
        .from("whatsapp_instances")
        .select("messages_sent_this_month, conversations_this_month")
        .eq("organization_id", organizationId)
        .eq("instance_type", "corporate")
        .single()

    const conversationsUsed = org?.whatsapp_conversations_used || 0
    const subscription = org?.subscriptions?.[0] as any
    const conversationsLimit = subscription?.plans?.max_whatsapp_conversations || 0
    const messagesThisMonth = instance?.messages_sent_this_month || 0

    const percentageUsed =
        conversationsLimit > 0 ? (conversationsUsed / conversationsLimit) * 100 : 0
    const isNearLimit = percentageUsed >= 80

    return {
        conversationsUsed,
        conversationsLimit,
        messagesThisMonth,
        percentageUsed,
        isNearLimit,
    }
}
