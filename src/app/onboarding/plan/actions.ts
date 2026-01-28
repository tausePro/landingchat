"use server"

import { createClient, createServiceClient } from "@/lib/supabase/server"

export interface OnboardingPlan {
    id: string
    name: string
    slug: string
    description: string | null
    price: number
    currency: string
    billing_period: string
    max_products: number
    max_agents: number
    max_monthly_conversations: number
    features: {
        whatsapp?: boolean
        analytics?: boolean
        custom_domain?: boolean
        [key: string]: boolean | undefined
    }
}

/**
 * Obtiene los planes disponibles para el onboarding
 */
export async function getAvailablePlans(): Promise<{
    success: boolean
    data?: OnboardingPlan[]
    error?: string
}> {
    try {
        const supabase = createServiceClient()

        const { data, error } = await supabase
            .from("plans")
            .select("id, name, slug, description, price, currency, billing_period, max_products, max_agents, max_monthly_conversations, features")
            .eq("is_active", true)
            .order("price", { ascending: true })

        if (error) throw error

        return {
            success: true,
            data: data as OnboardingPlan[]
        }
    } catch (error) {
        console.error("[getAvailablePlans] Error:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Error desconocido"
        }
    }
}

/**
 * Selecciona un plan y actualiza la suscripción del usuario
 * Todos los planes comienzan con 7 días de trial
 */
export async function selectPlan(planId: string): Promise<{
    success: boolean
    error?: string
}> {
    try {
        const supabase = await createClient()
        const serviceSupabase = createServiceClient()

        // 1. Verificar autenticación
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
            return { success: false, error: "No autenticado" }
        }

        // 2. Obtener organización del usuario
        const { data: profile } = await supabase
            .from("profiles")
            .select("organization_id")
            .eq("id", user.id)
            .single()

        if (!profile?.organization_id) {
            return { success: false, error: "No pertenece a ninguna organización" }
        }

        // 3. Obtener el plan seleccionado
        const { data: plan, error: planError } = await serviceSupabase
            .from("plans")
            .select("*")
            .eq("id", planId)
            .eq("is_active", true)
            .single()

        if (planError || !plan) {
            return { success: false, error: "Plan no encontrado o no disponible" }
        }

        // 4. Calcular período trial (7 días)
        const now = new Date()
        const trialEnd = new Date(now)
        trialEnd.setDate(trialEnd.getDate() + 7)

        // 5. Actualizar o crear suscripción
        const { data: existingSub } = await serviceSupabase
            .from("subscriptions")
            .select("id")
            .eq("organization_id", profile.organization_id)
            .single()

        if (existingSub) {
            // Actualizar suscripción existente
            const { error: updateError } = await serviceSupabase
                .from("subscriptions")
                .update({
                    plan_id: plan.id,
                    status: "trialing",
                    current_period_start: now.toISOString(),
                    current_period_end: trialEnd.toISOString(),
                    cancel_at_period_end: false,
                    currency: plan.currency || "COP",
                    price: plan.price || 0,
                    max_products: plan.max_products,
                    max_agents: plan.max_agents,
                    max_monthly_conversations: plan.max_monthly_conversations,
                    features: plan.features || {},
                    updated_at: now.toISOString(),
                })
                .eq("id", existingSub.id)

            if (updateError) {
                console.error("[selectPlan] Error updating subscription:", updateError)
                return { success: false, error: "Error al actualizar suscripción" }
            }
        } else {
            // Crear nueva suscripción
            const { error: insertError } = await serviceSupabase
                .from("subscriptions")
                .insert({
                    organization_id: profile.organization_id,
                    plan_id: plan.id,
                    status: "trialing",
                    current_period_start: now.toISOString(),
                    current_period_end: trialEnd.toISOString(),
                    cancel_at_period_end: false,
                    currency: plan.currency || "COP",
                    price: plan.price || 0,
                    max_products: plan.max_products,
                    max_agents: plan.max_agents,
                    max_monthly_conversations: plan.max_monthly_conversations,
                    features: plan.features || {},
                })

            if (insertError) {
                console.error("[selectPlan] Error creating subscription:", insertError)
                return { success: false, error: "Error al crear suscripción" }
            }
        }

        // 6. Actualizar paso de onboarding
        await serviceSupabase
            .from("organizations")
            .update({ onboarding_step: 4 })
            .eq("id", profile.organization_id)

        return { success: true }

    } catch (error) {
        console.error("[selectPlan] Error:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Error desconocido"
        }
    }
}
