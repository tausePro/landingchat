/**
 * Utilidades para gestión de suscripciones y límites
 * Feature: plan-subscription-management
 */

import { createClient } from "@/lib/supabase/server"

export interface UsageData {
    products_count: number
    agents_count: number
    conversations_count: number
}

export interface PlanLimits {
    max_products: number
    max_agents: number
    max_monthly_conversations: number
}

export interface UsageWithLimits {
    usage: UsageData
    limits: PlanLimits
    percentages: {
        products: number
        agents: number
        conversations: number
    }
    alerts: {
        products: boolean
        agents: boolean
        conversations: boolean
    }
    blocked: {
        products: boolean
        agents: boolean
        conversations: boolean
    }
}

/**
 * Calcula el porcentaje de uso de un recurso
 * -1 significa ilimitado → siempre retorna 0%
 */
export function calculateUsagePercentage(usage: number, limit: number): number {
    if (limit === -1) return 0 // Ilimitado
    if (limit <= 0) return 0
    return (usage / limit) * 100
}

/**
 * Verifica si un recurso está dentro del límite
 * -1 significa ilimitado → siempre permitido
 */
export function checkResourceLimit(usage: number, limit: number): boolean {
    if (limit === -1) return true // Ilimitado
    return usage <= limit
}

/**
 * Determina si se debe mostrar alerta de uso alto (>=80%)
 * -1 significa ilimitado → nunca alerta
 */
export function shouldShowUsageAlert(usage: number, limit: number): boolean {
    if (limit === -1) return false // Ilimitado
    const percentage = calculateUsagePercentage(usage, limit)
    return percentage >= 80
}

/**
 * Obtiene el uso actual de una organización
 * @param orgId - ID de la organización
 * @returns Datos de uso actual
 */
export async function getOrganizationUsage(orgId: string): Promise<UsageData> {
    const supabase = await createClient()

    // Contar productos
    const { count: productsCount } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId)

    // Contar agentes
    const { count: agentsCount } = await supabase
        .from("agents")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId)

    // Contar conversaciones del mes actual
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const { count: conversationsCount } = await supabase
        .from("chats")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .gte("created_at", startOfMonth.toISOString())

    return {
        products_count: productsCount || 0,
        agents_count: agentsCount || 0,
        conversations_count: conversationsCount || 0,
    }
}

/**
 * Obtiene los límites del plan de una organización
 * @param orgId - ID de la organización
 * @returns Límites del plan o defaults si no tiene suscripción
 */
export async function getOrganizationLimits(orgId: string): Promise<PlanLimits> {
    const supabase = await createClient()

    // Buscar suscripción activa
    const { data: subscription } = await supabase
        .from("subscriptions")
        .select(`
            max_products,
            max_agents,
            max_monthly_conversations,
            plan:plans(max_products, max_agents, max_monthly_conversations)
        `)
        .eq("organization_id", orgId)
        .eq("status", "active")
        .single()

    if (subscription) {
        // Usar límites de la suscripción o del plan
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const planData = subscription.plan as any
        return {
            max_products: subscription.max_products || planData?.max_products || 10,
            max_agents: subscription.max_agents || planData?.max_agents || 1,
            max_monthly_conversations: subscription.max_monthly_conversations || planData?.max_monthly_conversations || 100,
        }
    }

    // Defaults para plan gratuito
    return {
        max_products: 10,
        max_agents: 1,
        max_monthly_conversations: 100,
    }
}

/**
 * Obtiene el uso completo con límites, porcentajes y alertas
 * @param orgId - ID de la organización
 * @returns Datos completos de uso
 */
export async function getOrganizationUsageWithLimits(orgId: string): Promise<UsageWithLimits> {
    const [usage, limits] = await Promise.all([
        getOrganizationUsage(orgId),
        getOrganizationLimits(orgId),
    ])

    const percentages = {
        products: calculateUsagePercentage(usage.products_count, limits.max_products),
        agents: calculateUsagePercentage(usage.agents_count, limits.max_agents),
        conversations: calculateUsagePercentage(usage.conversations_count, limits.max_monthly_conversations),
    }

    const alerts = {
        products: shouldShowUsageAlert(usage.products_count, limits.max_products),
        agents: shouldShowUsageAlert(usage.agents_count, limits.max_agents),
        conversations: shouldShowUsageAlert(usage.conversations_count, limits.max_monthly_conversations),
    }

    const blocked = {
        products: !checkResourceLimit(usage.products_count, limits.max_products),
        agents: !checkResourceLimit(usage.agents_count, limits.max_agents),
        conversations: !checkResourceLimit(usage.conversations_count, limits.max_monthly_conversations),
    }

    return {
        usage,
        limits,
        percentages,
        alerts,
        blocked,
    }
}

/**
 * Verifica si una organización puede crear un nuevo recurso
 * @param orgId - ID de la organización
 * @param resourceType - Tipo de recurso ('product' | 'agent' | 'conversation')
 * @returns { allowed: boolean, message?: string }
 */
export async function canCreateResource(
    orgId: string,
    resourceType: "product" | "agent" | "conversation"
): Promise<{ allowed: boolean; message?: string }> {
    const usageData = await getOrganizationUsageWithLimits(orgId)

    const resourceMap = {
        product: {
            blocked: usageData.blocked.products,
            current: usageData.usage.products_count,
            limit: usageData.limits.max_products,
            name: "productos",
        },
        agent: {
            blocked: usageData.blocked.agents,
            current: usageData.usage.agents_count,
            limit: usageData.limits.max_agents,
            name: "agentes",
        },
        conversation: {
            blocked: usageData.blocked.conversations,
            current: usageData.usage.conversations_count,
            limit: usageData.limits.max_monthly_conversations,
            name: "conversaciones",
        },
    }

    const resource = resourceMap[resourceType]

    if (resource.blocked) {
        return {
            allowed: false,
            message: `Has alcanzado el límite de ${resource.name} (${resource.current}/${resource.limit}). Actualiza tu plan para continuar.`,
        }
    }

    return { allowed: true }
}
