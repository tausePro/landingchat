"use server"

import { createClient, createServiceClient } from "@/lib/supabase/server"
import { getPlatformWompiCredentials } from "@/app/admin/platform-payments/actions"
import crypto from "crypto"
import type { WompiWidgetData } from "./actions"
import { resolveReactivationQuote } from "@/lib/billing/reactivation"

/**
 * Inicia el pago de REACTIVACIÓN self-serve de una org suspendida.
 *
 * Cobra 2 mensualidades (precio de la suscripción vigente × 2) vía Wompi,
 * reusando el mismo widget/firma que las suscripciones. La referencia
 * `reactivate_{orgId}_{timestamp}` la reconoce el webhook (/api/webhooks/wompi)
 * para reactivar la org (status='active', limpia suspend_at/suspended_at).
 */
export async function initiateReactivation(): Promise<{
    success: boolean
    data?: { widgetData: WompiWidgetData }
    error?: string
}> {
    try {
        const supabase = await createClient()
        const serviceSupabase = createServiceClient()

        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) return { success: false, error: "No autenticado" }

        const { data: profile } = await supabase
            .from("profiles")
            .select("organization_id, email")
            .eq("id", user.id)
            .single()
        if (!profile?.organization_id) return { success: false, error: "No pertenece a ninguna organización" }
        const organizationId = profile.organization_id

        // Solo orgs realmente suspendidas pueden iniciar la reactivación.
        const { data: org } = await serviceSupabase
            .from("organizations")
            .select("status")
            .eq("id", organizationId)
            .single()
        if (org?.status !== "suspended") {
            return { success: false, error: "La tienda no está suspendida" }
        }

        // Monto = mensualidad × meses que debe (dinámico). Ver lib/billing/reactivation.
        const quote = await resolveReactivationQuote(serviceSupabase, organizationId)
        if (!quote) {
            return { success: false, error: "No hay un plan con precio para calcular la reactivación. Contacta a soporte." }
        }
        const currency = quote.currency
        const amountInCents = quote.amountInCents

        const credentials = await getPlatformWompiCredentials()
        if (!credentials.success || !credentials.data) {
            return { success: false, error: "Pasarela de pagos no configurada" }
        }

        const reference = `reactivate_${organizationId}_${Date.now()}`
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://landingchat.co"
        const redirectUrl = `${baseUrl}/dashboard/subscription/reactivate/result`

        const signatureString = `${reference}${amountInCents}${currency}${credentials.data.integritySecret}`
        const integritySignature = crypto.createHash("sha256").update(signatureString).digest("hex")

        const customerEmail = profile.email || user.email || undefined

        let checkoutUrl: string | undefined
        if (credentials.data.isTestMode) {
            const params = new URLSearchParams({
                "public-key": credentials.data.publicKey,
                currency,
                "amount-in-cents": amountInCents.toString(),
                reference,
                "redirect-url": redirectUrl,
                "signature:integrity": integritySignature,
            })
            if (customerEmail) params.set("customer-data:email", customerEmail)
            checkoutUrl = `https://checkout.wompi.co/p/?${params.toString()}`
        }

        return {
            success: true,
            data: {
                widgetData: {
                    publicKey: credentials.data.publicKey,
                    amountInCents,
                    currency,
                    reference,
                    redirectUrl,
                    integritySignature,
                    customerEmail,
                    isTestMode: credentials.data.isTestMode,
                    checkoutUrl,
                },
            },
        }
    } catch (error) {
        console.error("[initiateReactivation] Error:", error)
        return { success: false, error: error instanceof Error ? error.message : "Error desconocido" }
    }
}

/**
 * Cotización para mostrar en el banner: cuántos meses debe y el monto, sin
 * iniciar el pago. Resuelve la org del usuario autenticado.
 */
export async function getReactivationQuote(): Promise<{
    success: boolean
    data?: { monthsOwed: number; amount: number; currency: string }
    error?: string
}> {
    try {
        const supabase = await createClient()
        const serviceSupabase = createServiceClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, error: "No autenticado" }
        const { data: profile } = await supabase
            .from("profiles")
            .select("organization_id")
            .eq("id", user.id)
            .single()
        if (!profile?.organization_id) return { success: false, error: "Sin organización" }

        const quote = await resolveReactivationQuote(serviceSupabase, profile.organization_id)
        if (!quote) return { success: false, error: "Sin plan con precio" }
        return { success: true, data: { monthsOwed: quote.monthsOwed, amount: quote.amount, currency: quote.currency } }
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Error" }
    }
}
