/**
 * Utilidades para gestión de límites de conversaciones WhatsApp
 */

import { createServiceClient } from "@/lib/supabase/server"
import type { SupabaseClient } from "@supabase/supabase-js"

interface ConversationLimitResult {
    allowed: boolean
    used: number
    limit: number
    percentage: number
}

// Canales de mensajería que consumen la cuota de conversaciones. Cada chat nuevo
// en estos canales incrementaba el contador histórico; el chat web se gatea aparte
// (lib/utils/subscription.ts).
const MESSAGING_CHANNELS = ["whatsapp", "instagram", "messenger"]

/**
 * Conversaciones de mensajería (WhatsApp + social) creadas en el MES CALENDARIO
 * actual. Es la fuente de verdad del límite: cuenta filas de chat reales, por lo
 * que el límite resetea solo cada mes SIN depender del contador acumulativo
 * (organizations.whatsapp_conversations_used) ni del cron mensual —cuya falla
 * dejaba tenants bloqueados silenciosamente (incidente recurrente Casa Inmobiliaria).
 */
export async function getMessagingConversationsThisMonth(
    supabase: SupabaseClient,
    organizationId: string
): Promise<number> {
    const startOfMonth = new Date()
    startOfMonth.setUTCDate(1)
    startOfMonth.setUTCHours(0, 0, 0, 0)

    const { count } = await supabase
        .from("chats")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .in("channel", MESSAGING_CHANNELS)
        .gte("created_at", startOfMonth.toISOString())

    return count || 0
}

// Defaults de límite (deben coincidir con webhook-utils.ts checkConversationLimit)
const DEFAULT_LIMIT_NO_SUBSCRIPTION = 1000
const DEFAULT_LIMIT_FREE_PLAN = 10

/**
 * Tras crear una conversación NUEVA: si la org ya superó su límite mensual del
 * plan, consume 1 crédito comprado (overflow, roll-over). El bloqueo cuando NO
 * hay créditos ya lo decidió checkConversationLimit antes de crear. No-op si está
 * dentro del plan, si el plan es ilimitado, o si no quedan créditos.
 */
export async function consumeCreditIfOverPlanLimit(
    supabase: SupabaseClient,
    organizationId: string
): Promise<void> {
    // Fail-open: un error de contabilidad de créditos NO debe romper la entrega
    // del webhook ni sobre-cobrar. Ante cualquier error, no se consume (el cliente
    // obtiene la conversación; se registra el error).
    try {
        const { data: subscription } = await supabase
            .from("subscriptions")
            .select("plans(max_whatsapp_conversations)")
            .eq("organization_id", organizationId)
            .eq("status", "active")
            .maybeSingle()

        const planRow = subscription?.plans as
            | { max_whatsapp_conversations?: number | null }
            | { max_whatsapp_conversations?: number | null }[]
            | null
            | undefined
        const planData = Array.isArray(planRow) ? planRow[0] : planRow

        const limit = planData
            ? (planData.max_whatsapp_conversations || DEFAULT_LIMIT_FREE_PLAN)
            : DEFAULT_LIMIT_NO_SUBSCRIPTION

        if (limit === -1) return // ilimitado

        // 'used' ya incluye la conversación recién creada; si supera el límite del
        // plan, esta conversación es overflow y consume 1 crédito.
        const used = await getMessagingConversationsThisMonth(supabase, organizationId)
        if (used > limit) {
            await supabase.rpc("consume_conversation_credit", { org_id: organizationId })
        }
    } catch (error) {
        console.error("[whatsapp-limits] consumeCreditIfOverPlanLimit error (no-op):", error)
    }
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
    // Conteo dinámico por mes (resetea solo, sin depender del cron)
    const used = await getMessagingConversationsThisMonth(supabase, organizationId)
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

    const conversationsUsed = await getMessagingConversationsThisMonth(supabase, organizationId)
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
