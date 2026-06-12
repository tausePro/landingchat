"use server"

import { requireAdminRole } from "@/lib/admin/roles"
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
    if (!(await requireAdminRole(["finance"]))) throw new Error("No autorizado")
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
    if (!(await requireAdminRole(["finance"]))) throw new Error("No autorizado")
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
    if (!(await requireAdminRole(["finance"]))) throw new Error("No autorizado")
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
 * Snapshot de campos del plan que se copian a la suscripción
 *
 * Las columnas `max_products`, `max_agents`, `max_monthly_conversations`,
 * `price`, `currency` y `features` viven duplicadas en `subscriptions` para
 * evitar reads cruzados al chequear límites. `getOrganizationLimits` prioriza
 * el snapshot de la sub sobre el plan, por lo que SIEMPRE deben quedar
 * sincronizados al cambiar `plan_id`.
 */
type PlanSnapshot = {
    plan_id: string
    max_products: number | null
    max_agents: number | null
    max_monthly_conversations: number | null
    price: number | null
    currency: string | null
    features: Record<string, boolean>
    updated_at: string
}

function buildPlanSnapshot(plan: Record<string, unknown>): PlanSnapshot {
    return {
        plan_id: plan.id as string,
        max_products: (plan.max_products as number | null) ?? null,
        max_agents: (plan.max_agents as number | null) ?? null,
        max_monthly_conversations: (plan.max_monthly_conversations as number | null) ?? null,
        price: (plan.price as number | null) ?? null,
        currency: (plan.currency as string | null) ?? "COP",
        features: (plan.features as Record<string, boolean> | null) ?? {},
        updated_at: new Date().toISOString(),
    }
}

/**
 * Actualiza el plan de una suscripción existente
 *
 * Cambia el `plan_id` de una sub por otro y sincroniza el snapshot de límites
 * y features (clave para que el chequeo de `canCreateResource` use los valores
 * del nuevo plan). No crea sub nueva — para eso usar `assignPlanToOrganization`.
 */
export async function updateSubscriptionPlan(
    id: string,
    planId: string
): Promise<ActionResult<Subscription>> {
    if (!(await requireAdminRole(["finance"]))) throw new Error("No autorizado")
    try {
        const validation = UpdateSubscriptionInputSchema.safeParse({ plan_id: planId })
        if (!validation.success) {
            return failure(validation.error.issues[0]?.message || "Plan inválido")
        }

        const supabase = await createServiceClient()

        // Traer todos los campos del plan para snapshot completo
        const { data: plan, error: planError } = await supabase
            .from("plans")
            .select("id, name, max_products, max_agents, max_monthly_conversations, price, currency, features")
            .eq("id", planId)
            .single()

        if (planError || !plan) {
            return failure("El plan seleccionado no existe")
        }

        const { data, error } = await supabase
            .from("subscriptions")
            .update(buildPlanSnapshot(plan))
            .eq("id", id)
            .select()
            .single()

        if (error) {
            console.error("Error updating subscription plan:", error)
            return failure("Error al cambiar el plan de la suscripción")
        }

        revalidatePath("/admin/subscriptions")
        revalidatePath("/admin/organizations")
        return success(data as Subscription)
    } catch (error) {
        console.error("Error in updateSubscriptionPlan:", error)
        return failure("Error inesperado al cambiar el plan")
    }
}

/**
 * Asigna un plan a una organización (upsert)
 *
 * - Si la organización NO tiene suscripción activa: crea una nueva `active` con período
 *   de 1 mes desde hoy.
 * - Si ya tiene una sub activa: actualiza su `plan_id` (equivalente a `updateSubscriptionPlan`).
 * - Si solo tiene subs canceladas/past_due: crea una nueva activa.
 *
 * Pensado para el flujo del superadmin que quiere "poner a la org X en el plan beta".
 */
export async function assignPlanToOrganization(
    orgId: string,
    planId: string
): Promise<ActionResult<Subscription>> {
    if (!(await requireAdminRole(["finance"]))) throw new Error("No autorizado")
    try {
        if (!orgId || typeof orgId !== "string") {
            return failure("organization_id requerido")
        }
        if (!planId || typeof planId !== "string") {
            return failure("plan_id requerido")
        }

        const supabase = await createServiceClient()

        // Validar que org y plan existen — traemos todos los campos del plan
        // para sincronizar el snapshot en la sub
        const [{ data: org, error: orgError }, { data: plan, error: planError }] = await Promise.all([
            supabase.from("organizations").select("id, name").eq("id", orgId).single(),
            supabase
                .from("plans")
                .select("id, name, max_products, max_agents, max_monthly_conversations, price, currency, features")
                .eq("id", planId)
                .single(),
        ])

        if (orgError || !org) {
            return failure("La organización no existe")
        }
        if (planError || !plan) {
            return failure("El plan no existe")
        }

        // Buscar sub activa (o trialing) de esta org
        const { data: existingActive } = await supabase
            .from("subscriptions")
            .select("id, plan_id, status")
            .eq("organization_id", orgId)
            .in("status", ["active", "trialing"])
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()

        if (existingActive) {
            // Ya tiene sub activa/trial → actualizar plan + snapshot completo
            const { data, error } = await supabase
                .from("subscriptions")
                .update(buildPlanSnapshot(plan))
                .eq("id", existingActive.id)
                .select()
                .single()

            if (error) {
                console.error("Error updating existing subscription plan:", error)
                return failure("Error al cambiar el plan de la suscripción existente")
            }

            revalidatePath("/admin/subscriptions")
            revalidatePath("/admin/organizations")
            return success(data as Subscription)
        }

        // No hay sub activa → crear una nueva con período de 1 mes + snapshot completo
        const now = new Date()
        const periodEnd = new Date(now)
        periodEnd.setMonth(periodEnd.getMonth() + 1)

        const { data, error } = await supabase
            .from("subscriptions")
            .insert({
                organization_id: orgId,
                status: "active",
                current_period_start: now.toISOString(),
                current_period_end: periodEnd.toISOString(),
                cancel_at_period_end: false,
                ...buildPlanSnapshot(plan),
            })
            .select()
            .single()

        if (error) {
            console.error("Error creating subscription:", error)
            return failure("Error al crear la suscripción")
        }

        revalidatePath("/admin/subscriptions")
        revalidatePath("/admin/organizations")
        return success(data as Subscription)
    } catch (error) {
        console.error("Error in assignPlanToOrganization:", error)
        return failure("Error inesperado al asignar el plan")
    }
}

/**
 * Obtiene la suscripción de una organización específica
 */
export async function getOrganizationSubscription(
    orgId: string
): Promise<ActionResult<SubscriptionWithOrg | null>> {
    if (!(await requireAdminRole(["finance"]))) throw new Error("No autorizado")
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
