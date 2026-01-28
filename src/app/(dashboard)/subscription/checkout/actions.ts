"use server"

import { createServiceClient, createClient } from "@/lib/supabase/server"
import { getPlatformWompiCredentials } from "@/app/admin/platform-payments/actions"
import crypto from "crypto"

export interface CheckoutPlan {
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
    features: Record<string, boolean>
}

export interface CurrentSubscription {
    id: string
    plan_id: string
    status: string
    current_period_end: string
}

/**
 * Obtiene los planes disponibles para suscripción
 */
export async function getAvailablePlans(): Promise<{
    success: boolean
    data?: CheckoutPlan[]
    error?: string
}> {
    try {
        const supabase = createServiceClient()

        const { data, error } = await supabase
            .from("plans")
            .select("*")
            .eq("is_active", true)
            .order("price", { ascending: true })

        if (error) throw error

        return {
            success: true,
            data: data as CheckoutPlan[]
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
 * Obtiene la suscripción actual de la organización del usuario
 */
export async function getCurrentSubscription(): Promise<{
    success: boolean
    data?: CurrentSubscription | null
    organizationId?: string
    error?: string
}> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return { success: false, error: "No autenticado" }
        }

        // Obtener organización del usuario
        const { data: profile } = await supabase
            .from("profiles")
            .select("organization_id")
            .eq("id", user.id)
            .single()

        if (!profile?.organization_id) {
            return { success: false, error: "No pertenece a ninguna organización" }
        }

        const serviceSupabase = createServiceClient()

        // Obtener suscripción activa
        const { data: subscription } = await serviceSupabase
            .from("subscriptions")
            .select("id, plan_id, status, current_period_end")
            .eq("organization_id", profile.organization_id)
            .in("status", ["active", "trialing", "past_due"])
            .single()

        return {
            success: true,
            data: subscription as CurrentSubscription | null,
            organizationId: profile.organization_id
        }
    } catch (error) {
        console.error("[getCurrentSubscription] Error:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Error desconocido"
        }
    }
}

/**
 * Inicia el proceso de pago con Wompi
 */
export async function initiateWompiPayment(planId: string): Promise<{
    success: boolean
    data?: {
        publicKey: string
        amountInCents: number
        currency: string
        reference: string
        redirectUrl: string
        integritySignature: string
        isTestMode: boolean
    }
    error?: string
}> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return { success: false, error: "No autenticado" }
        }

        // Obtener organización del usuario
        const { data: profile } = await supabase
            .from("profiles")
            .select("organization_id")
            .eq("id", user.id)
            .single()

        if (!profile?.organization_id) {
            return { success: false, error: "No pertenece a ninguna organización" }
        }

        const serviceSupabase = createServiceClient()

        // Obtener el plan
        const { data: plan, error: planError } = await serviceSupabase
            .from("plans")
            .select("*")
            .eq("id", planId)
            .eq("is_active", true)
            .single()

        if (planError || !plan) {
            return { success: false, error: "Plan no encontrado o no disponible" }
        }

        // Obtener credenciales de Wompi de la plataforma
        const credentials = await getPlatformWompiCredentials()
        if (!credentials.success || !credentials.data) {
            return { success: false, error: "Pasarela de pagos no configurada" }
        }

        // Obtener o crear suscripción
        let subscriptionId: string
        const { data: existingSub } = await serviceSupabase
            .from("subscriptions")
            .select("id")
            .eq("organization_id", profile.organization_id)
            .single()

        if (existingSub) {
            subscriptionId = existingSub.id
        } else {
            // Crear nueva suscripción en estado incomplete
            const now = new Date()
            const { data: newSub, error: createError } = await serviceSupabase
                .from("subscriptions")
                .insert({
                    organization_id: profile.organization_id,
                    plan_id: planId,
                    status: "incomplete",
                    current_period_start: now.toISOString(),
                    current_period_end: now.toISOString(), // Se actualizará al confirmar pago
                    currency: plan.currency || "COP",
                    price: plan.price,
                    max_products: plan.max_products,
                    max_agents: plan.max_agents,
                    max_monthly_conversations: plan.max_monthly_conversations,
                    features: plan.features || {},
                })
                .select("id")
                .single()

            if (createError || !newSub) {
                console.error("[initiateWompiPayment] Error creating subscription:", createError)
                return { success: false, error: "Error al crear suscripción" }
            }
            subscriptionId = newSub.id
        }

        // Generar referencia única: sub_{subscription_id}_{timestamp}
        const timestamp = Date.now()
        const reference = `sub_${subscriptionId}_${timestamp}`

        // Calcular monto en centavos
        const amountInCents = Math.round(plan.price * 100)
        const currency = plan.currency || "COP"

        // URL de redirección
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://landingchat.co"
        const redirectUrl = `${baseUrl}/subscription/checkout/result`

        // Generar firma de integridad
        // Formato: reference + amountInCents + currency + integritySecret
        const signatureString = `${reference}${amountInCents}${currency}${credentials.data.integritySecret}`
        const integritySignature = crypto
            .createHash("sha256")
            .update(signatureString)
            .digest("hex")

        return {
            success: true,
            data: {
                publicKey: credentials.data.publicKey,
                amountInCents,
                currency,
                reference,
                redirectUrl,
                integritySignature,
                isTestMode: credentials.data.isTestMode
            }
        }
    } catch (error) {
        console.error("[initiateWompiPayment] Error:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Error desconocido"
        }
    }
}

/**
 * Verifica el estado de una transacción de Wompi
 */
export async function verifyWompiTransaction(transactionId: string): Promise<{
    success: boolean
    data?: {
        status: string
        reference: string
        amount: number
    }
    error?: string
}> {
    try {
        const credentials = await getPlatformWompiCredentials()
        if (!credentials.success || !credentials.data) {
            return { success: false, error: "Pasarela de pagos no configurada" }
        }

        const baseUrl = credentials.data.isTestMode
            ? "https://sandbox.wompi.co/v1"
            : "https://production.wompi.co/v1"

        const response = await fetch(`${baseUrl}/transactions/${transactionId}`)

        if (!response.ok) {
            return { success: false, error: "Error al verificar transacción" }
        }

        const data = await response.json()
        const transaction = data.data

        return {
            success: true,
            data: {
                status: transaction.status,
                reference: transaction.reference,
                amount: transaction.amount_in_cents / 100
            }
        }
    } catch (error) {
        console.error("[verifyWompiTransaction] Error:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Error desconocido"
        }
    }
}
