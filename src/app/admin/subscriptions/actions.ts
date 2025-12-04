"use server"

import { createServiceClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import {
    type ActionResult,
    success,
    failure,
    type Subscription,
    type SubscriptionWithOrg,
    type SubscriptionMetrics,
    type SubscriptionFilters,
    type SubscriptionStatus,
    SubscriptionFiltersSchema,
    UpdateSubscriptionInputSchema,
} from "@/types"

/**
 * Obtiene las suscripciones con filtros opcionales
 */
export async function getSubscriptions(
    filters?: SubscriptionFilters
): Promise<ActionResult<{ subscriptions: SubscriptionWithOrg[]; total: number; totalPages: number }>> {
    try {
        const supabase = await createServiceClient()

        // Validar y aplicar defaults a los filtros
        const validatedFilters = SubscriptionFiltersSchema.parse(filters || {})
        const { status, plan_id, search } = validatedFilters
        const page = validatedFilters.page ?? 1
        const limit = validatedFilters.limit ?? 10

        const from = (page - 1) * limit
        const to = from + limit - 1

        let query = supabase
            .from("subscriptions")
            .select(`
                *,
                organization:organizations(id, name, subdomain),
                plan:plans(id, name, price)
            `, { count: "exact" })
            .order("created_at", { ascending: false })
            .range(from, to)

        // Aplicar filtros
        if (status) {
            query = query.eq("status", status)
        }
        if (plan_id) {
            query = query.eq("plan_id", plan_id)
        }
        if (search) {
            // Buscar por nombre de organización (requiere join)
            query = query.ilike("organizations.name", `%${search}%`)
        }

        const { data, error, count } = await query

        if (error) {
            console.error("Error fetching subscriptions:", error)
            return failure("Error al obtener las suscripciones")
        }

        const subscriptions = (data || []).map((row) => ({
            ...row,
            organization: row.organization,
            plan: row.plan,
        })) as SubscriptionWithOrg[]

        return success({
            subscriptions,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limit),
        })
    } catch (error) {
        console.error("Error in getSubscriptions:", error)
        return failure("Error inesperado al obtener las suscripciones")
    }
}

/**
 * Obtiene métricas de suscripciones para el dashboard
 */
export async function getSubscriptionMetrics(): Promise<ActionResult<SubscriptionMetrics>> {
    try {
        const supabase = await createServiceClient()

        // Total de suscripciones
        const { count: totalSubscriptions } = await supabase
            .from("subscriptions")
            .select("*", { count: "exact", head: true })

        // Suscripciones activas
        const { count: activeSubscriptions } = await supabase
            .from("subscriptions")
            .select("*", { count: "exact", head: true })
            .eq("status", "active")

        // Calcular MRR (suma de precios de suscripciones activas)
        const { data: activeWithPrices } = await supabase
            .from("subscriptions")
            .select(`
                price,
                currency,
                plan:plans(price, currency)
            `)
            .eq("status", "active")

        let mrr = 0
        const mrrCurrency = "COP"

        if (activeWithPrices) {
            mrr = activeWithPrices.reduce((sum, sub) => {
                // Usar precio de la suscripción o del plan
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const planData = sub.plan as any
                const price = sub.price || planData?.price || 0
                return sum + Number(price)
            }, 0)
        }

        // Suscripciones por plan
        const { data: byPlan } = await supabase
            .from("subscriptions")
            .select(`
                plan_id,
                plan:plans(name)
            `)

        const planCounts: Record<string, { plan_id: string; plan_name: string; count: number }> = {}
        if (byPlan) {
            byPlan.forEach((sub) => {
                const planId = sub.plan_id
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const planData = sub.plan as any
                const planName = planData?.name || "Sin plan"
                if (!planCounts[planId]) {
                    planCounts[planId] = { plan_id: planId, plan_name: planName, count: 0 }
                }
                planCounts[planId].count++
            })
        }

        // Suscripciones por estado
        const { data: byStatus } = await supabase
            .from("subscriptions")
            .select("status")

        const statusCounts: Record<string, number> = {}
        if (byStatus) {
            byStatus.forEach((sub) => {
                statusCounts[sub.status] = (statusCounts[sub.status] || 0) + 1
            })
        }

        const metrics: SubscriptionMetrics = {
            total_subscriptions: totalSubscriptions || 0,
            active_subscriptions: activeSubscriptions || 0,
            mrr,
            mrr_currency: mrrCurrency,
            subscriptions_by_plan: Object.values(planCounts),
            subscriptions_by_status: Object.entries(statusCounts).map(([status, count]) => ({
                status: status as SubscriptionStatus,
                count,
            })),
        }

        return success(metrics)
    } catch (error) {
        console.error("Error in getSubscriptionMetrics:", error)
        return failure("Error inesperado al obtener las métricas")
    }
}

/**
 * Actualiza el estado de una suscripción
 */
export async function updateSubscriptionStatus(
    id: string,
    status: SubscriptionStatus
): Promise<ActionResult<Subscription>> {
    try {
        const validation = UpdateSubscriptionInputSchema.safeParse({ status })
        if (!validation.success) {
            return failure("Estado inválido")
        }

        const supabase = await createServiceClient()

        const { data, error } = await supabase
            .from("subscriptions")
            .update({ status, updated_at: new Date().toISOString() })
            .eq("id", id)
            .select()
            .single()

        if (error) {
            console.error("Error updating subscription status:", error)
            return failure("Error al actualizar el estado de la suscripción")
        }

        revalidatePath("/admin/subscriptions")
        return success(data as Subscription)
    } catch (error) {
        console.error("Error in updateSubscriptionStatus:", error)
        return failure("Error inesperado al actualizar la suscripción")
    }
}

/**
 * Obtiene la suscripción de una organización específica
 */
export async function getOrganizationSubscription(
    orgId: string
): Promise<ActionResult<SubscriptionWithOrg | null>> {
    try {
        const supabase = await createServiceClient()

        const { data, error } = await supabase
            .from("subscriptions")
            .select(`
                *,
                organization:organizations(id, name, subdomain),
                plan:plans(id, name, price, max_products, max_agents, max_monthly_conversations, features)
            `)
            .eq("organization_id", orgId)
            .order("created_at", { ascending: false })
            .limit(1)
            .single()

        if (error) {
            if (error.code === "PGRST116") {
                // No subscription found
                return success(null)
            }
            console.error("Error fetching organization subscription:", error)
            return failure("Error al obtener la suscripción")
        }

        return success(data as SubscriptionWithOrg)
    } catch (error) {
        console.error("Error in getOrganizationSubscription:", error)
        return failure("Error inesperado al obtener la suscripción")
    }
}
