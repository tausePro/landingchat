"use server"

import { createServiceClient } from "@/lib/supabase/server"

interface RegisterResult {
    success: boolean
    error?: string
    userId?: string
    organizationId?: string
}

/**
 * Crea la organización, perfil y suscripción trial para un nuevo usuario
 * Esta función se llama después de que el usuario se registra con supabase.auth.signUp
 */
export async function setupNewUser(
    userId: string,
    fullName: string,
    email: string
): Promise<RegisterResult> {
    const supabase = createServiceClient()

    try {
        // 1. Verificar si el perfil ya existe
        const { data: existingProfile } = await supabase
            .from("profiles")
            .select("id, organization_id")
            .eq("id", userId)
            .single()

        if (existingProfile) {
            // Usuario ya configurado, verificar suscripción
            await ensureSubscriptionExists(supabase, existingProfile.organization_id)
            return {
                success: true,
                userId,
                organizationId: existingProfile.organization_id
            }
        }

        // 2. Crear o obtener organización
        const slug = `org-${userId.substring(0, 8)}`
        let organizationId: string

        const { data: existingOrg } = await supabase
            .from("organizations")
            .select("id")
            .eq("slug", slug)
            .single()

        if (existingOrg) {
            organizationId = existingOrg.id
        } else {
            const { data: newOrg, error: orgError } = await supabase
                .from("organizations")
                .insert({
                    name: `${fullName}'s Organization`,
                    slug: slug,
                    contact_email: email,
                    onboarding_completed: false,
                    onboarding_step: 0,
                })
                .select("id")
                .single()

            if (orgError) {
                // Race condition - intentar obtener de nuevo
                if (orgError.code === "23505") {
                    const { data: retryOrg } = await supabase
                        .from("organizations")
                        .select("id")
                        .eq("slug", slug)
                        .single()

                    if (retryOrg) {
                        organizationId = retryOrg.id
                    } else {
                        throw orgError
                    }
                } else {
                    throw orgError
                }
            } else {
                organizationId = newOrg.id
            }
        }

        // 3. Crear perfil
        const { error: profileError } = await supabase
            .from("profiles")
            .insert({
                id: userId,
                organization_id: organizationId,
                full_name: fullName,
                email: email,
                role: "admin",
            })

        if (profileError && profileError.code !== "23505") {
            throw profileError
        }

        // 4. Crear suscripción trial
        await createTrialSubscription(supabase, organizationId)

        return {
            success: true,
            userId,
            organizationId
        }

    } catch (error) {
        console.error("[setupNewUser] Error:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Error al configurar usuario"
        }
    }
}

/**
 * Crea una suscripción trial de 7 días con el plan free
 */
async function createTrialSubscription(
    supabase: ReturnType<typeof createServiceClient>,
    organizationId: string
): Promise<void> {
    // Verificar si ya tiene suscripción
    const { data: existingSub } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("organization_id", organizationId)
        .single()

    if (existingSub) {
        console.log("[createTrialSubscription] Subscription already exists for org:", organizationId)
        return
    }

    // Obtener el plan free
    const { data: freePlan } = await supabase
        .from("plans")
        .select("*")
        .eq("slug", "free")
        .eq("is_active", true)
        .single()

    if (!freePlan) {
        console.error("[createTrialSubscription] Free plan not found")
        // Buscar cualquier plan activo como fallback
        const { data: anyPlan } = await supabase
            .from("plans")
            .select("*")
            .eq("is_active", true)
            .order("price", { ascending: true })
            .limit(1)
            .single()

        if (!anyPlan) {
            console.error("[createTrialSubscription] No active plans found")
            return
        }
    }

    const plan = freePlan || null
    if (!plan) return

    // Calcular período trial (7 días)
    const now = new Date()
    const trialEnd = new Date(now)
    trialEnd.setDate(trialEnd.getDate() + 7)

    // Crear suscripción
    const { error: subError } = await supabase
        .from("subscriptions")
        .insert({
            organization_id: organizationId,
            plan_id: plan.id,
            status: "trialing",
            current_period_start: now.toISOString(),
            current_period_end: trialEnd.toISOString(),
            cancel_at_period_end: false,
            currency: plan.currency || "COP",
            price: plan.price || 0,
            max_products: plan.max_products || 100,
            max_agents: plan.max_agents || 1,
            max_monthly_conversations: plan.max_monthly_conversations || 500,
            features: plan.features || {},
        })

    if (subError) {
        console.error("[createTrialSubscription] Error creating subscription:", subError)
        throw subError
    }

    console.log(`[createTrialSubscription] Created trial subscription for org ${organizationId} until ${trialEnd.toISOString()}`)
}

/**
 * Asegura que una organización existente tenga suscripción
 */
async function ensureSubscriptionExists(
    supabase: ReturnType<typeof createServiceClient>,
    organizationId: string
): Promise<void> {
    const { data: existingSub } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("organization_id", organizationId)
        .single()

    if (!existingSub) {
        await createTrialSubscription(supabase, organizationId)
    }
}

/**
 * Obtiene información de la suscripción actual del usuario
 */
export async function getUserSubscription(userId: string): Promise<{
    success: boolean
    data?: {
        id: string
        status: string
        plan_id: string
        current_period_end: string
        days_remaining: number
    }
    error?: string
}> {
    const supabase = createServiceClient()

    try {
        // Obtener organización del usuario
        const { data: profile } = await supabase
            .from("profiles")
            .select("organization_id")
            .eq("id", userId)
            .single()

        if (!profile?.organization_id) {
            return { success: false, error: "Usuario sin organización" }
        }

        // Obtener suscripción
        const { data: subscription } = await supabase
            .from("subscriptions")
            .select("id, status, plan_id, current_period_end")
            .eq("organization_id", profile.organization_id)
            .single()

        if (!subscription) {
            return { success: false, error: "Sin suscripción" }
        }

        // Calcular días restantes
        const now = new Date()
        const periodEnd = new Date(subscription.current_period_end)
        const daysRemaining = Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))

        return {
            success: true,
            data: {
                ...subscription,
                days_remaining: daysRemaining
            }
        }
    } catch (error) {
        console.error("[getUserSubscription] Error:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Error desconocido"
        }
    }
}
