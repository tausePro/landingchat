"use server"

import { createClient, createServiceClient } from "@/lib/supabase/server"
import { getPlatformWompiCredentials } from "@/app/admin/platform-payments/actions"
import crypto from "crypto"

/**
 * Actualiza o cambia el plan de suscripción del usuario
 * Si el plan es gratuito o menor, cambia inmediatamente
 * Si el plan requiere pago, genera URL de checkout de Wompi
 */
export async function upgradeSubscription(planId: string): Promise<{
    success: boolean
    data?: {
        checkoutUrl?: string
        changed?: boolean
    }
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
        const { data: newPlan, error: planError } = await serviceSupabase
            .from("plans")
            .select("*")
            .eq("id", planId)
            .eq("is_active", true)
            .single()

        if (planError || !newPlan) {
            return { success: false, error: "Plan no encontrado o no disponible" }
        }

        // 4. Obtener suscripción actual
        const { data: currentSub } = await serviceSupabase
            .from("subscriptions")
            .select("id, plan_id, status, current_period_end")
            .eq("organization_id", profile.organization_id)
            .single()

        // 5. Si el plan es gratuito, cambiar inmediatamente
        if (newPlan.price === 0) {
            return await changeToFreePlan(serviceSupabase, profile.organization_id, newPlan, currentSub?.id)
        }

        // 6. Obtener plan actual para comparar
        let currentPlanPrice = 0
        if (currentSub?.plan_id) {
            const { data: currentPlan } = await serviceSupabase
                .from("plans")
                .select("price")
                .eq("id", currentSub.plan_id)
                .single()
            currentPlanPrice = currentPlan?.price || 0
        }

        // 7. Si es downgrade o mismo precio, cambiar inmediatamente
        if (newPlan.price <= currentPlanPrice) {
            return await changePlanImmediately(serviceSupabase, profile.organization_id, newPlan, currentSub?.id)
        }

        // 8. Es un upgrade, generar checkout de Wompi
        return await generateWompiCheckout(serviceSupabase, profile.organization_id, newPlan, currentSub?.id)

    } catch (error) {
        console.error("[upgradeSubscription] Error:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Error desconocido"
        }
    }
}

async function changeToFreePlan(
    supabase: ReturnType<typeof createServiceClient>,
    organizationId: string,
    plan: Record<string, unknown>,
    subscriptionId?: string
): Promise<{ success: boolean; data?: { changed: boolean }; error?: string }> {
    const now = new Date()
    const periodEnd = new Date(now)
    periodEnd.setMonth(periodEnd.getMonth() + 1) // Free plan válido por 1 mes

    const subscriptionData = {
        organization_id: organizationId,
        plan_id: plan.id as string,
        status: "active",
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: false,
        currency: (plan.currency as string) || "COP",
        price: 0,
        max_products: plan.max_products as number,
        max_agents: plan.max_agents as number,
        max_monthly_conversations: plan.max_monthly_conversations as number,
        features: plan.features as Record<string, boolean> || {},
        updated_at: now.toISOString(),
    }

    if (subscriptionId) {
        const { error } = await supabase
            .from("subscriptions")
            .update(subscriptionData)
            .eq("id", subscriptionId)

        if (error) throw error
    } else {
        const { error } = await supabase
            .from("subscriptions")
            .insert(subscriptionData)

        if (error) throw error
    }

    return { success: true, data: { changed: true } }
}

async function changePlanImmediately(
    supabase: ReturnType<typeof createServiceClient>,
    organizationId: string,
    plan: Record<string, unknown>,
    subscriptionId?: string
): Promise<{ success: boolean; data?: { changed: boolean }; error?: string }> {
    const now = new Date()

    // Mantener el período actual pero actualizar el plan
    const subscriptionData = {
        plan_id: plan.id as string,
        currency: (plan.currency as string) || "COP",
        price: plan.price as number,
        max_products: plan.max_products as number,
        max_agents: plan.max_agents as number,
        max_monthly_conversations: plan.max_monthly_conversations as number,
        features: plan.features as Record<string, boolean> || {},
        updated_at: now.toISOString(),
    }

    if (subscriptionId) {
        const { error } = await supabase
            .from("subscriptions")
            .update(subscriptionData)
            .eq("id", subscriptionId)

        if (error) throw error
    } else {
        // Crear nueva suscripción con trial
        const periodEnd = new Date(now)
        periodEnd.setDate(periodEnd.getDate() + 7)

        const { error } = await supabase
            .from("subscriptions")
            .insert({
                organization_id: organizationId,
                ...subscriptionData,
                status: "trialing",
                current_period_start: now.toISOString(),
                current_period_end: periodEnd.toISOString(),
                cancel_at_period_end: false,
            })

        if (error) throw error
    }

    return { success: true, data: { changed: true } }
}

async function generateWompiCheckout(
    supabase: ReturnType<typeof createServiceClient>,
    organizationId: string,
    plan: Record<string, unknown>,
    subscriptionId?: string
): Promise<{ success: boolean; data?: { checkoutUrl: string }; error?: string }> {
    // Obtener credenciales de Wompi de la plataforma
    const credentials = await getPlatformWompiCredentials()
    if (!credentials.success || !credentials.data) {
        return { success: false, error: "Pasarela de pagos no configurada" }
    }

    // Crear o actualizar suscripción en estado incomplete
    const now = new Date()
    let subId = subscriptionId

    if (!subId) {
        const { data: newSub, error: insertError } = await supabase
            .from("subscriptions")
            .insert({
                organization_id: organizationId,
                plan_id: plan.id as string,
                status: "incomplete",
                current_period_start: now.toISOString(),
                current_period_end: now.toISOString(),
                currency: (plan.currency as string) || "COP",
                price: plan.price as number,
                max_products: plan.max_products as number,
                max_agents: plan.max_agents as number,
                max_monthly_conversations: plan.max_monthly_conversations as number,
                features: plan.features as Record<string, boolean> || {},
            })
            .select("id")
            .single()

        if (insertError) throw insertError
        subId = newSub.id
    } else {
        // Actualizar plan pendiente
        await supabase
            .from("subscriptions")
            .update({
                plan_id: plan.id as string,
                price: plan.price as number,
                updated_at: now.toISOString(),
            })
            .eq("id", subId)
    }

    // Generar referencia única
    const timestamp = Date.now()
    const reference = `sub_${subId}_${timestamp}`

    // Calcular monto en centavos
    const amountInCents = Math.round((plan.price as number) * 100)
    const currency = (plan.currency as string) || "COP"

    // URL de redirección
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://landingchat.co"
    const redirectUrl = `${baseUrl}/dashboard/subscription/result`

    // Generar firma de integridad
    const signatureString = `${reference}${amountInCents}${currency}${credentials.data.integritySecret}`
    const integritySignature = crypto
        .createHash("sha256")
        .update(signatureString)
        .digest("hex")

    // Construir URL de checkout de Wompi
    const checkoutParams = new URLSearchParams({
        "public-key": credentials.data.publicKey,
        "currency": currency,
        "amount-in-cents": amountInCents.toString(),
        "reference": reference,
        "redirect-url": redirectUrl,
        "signature:integrity": integritySignature,
    })

    const checkoutUrl = `https://checkout.wompi.co/p/?${checkoutParams.toString()}`

    return {
        success: true,
        data: { checkoutUrl }
    }
}
