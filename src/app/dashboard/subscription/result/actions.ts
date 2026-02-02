"use server"

import { createServiceClient } from "@/lib/supabase/server"
import { getPlatformWompiCredentials } from "@/app/admin/platform-payments/actions"

/**
 * Verifica el estado de una transacción de Wompi y activa la suscripción si fue aprobada.
 * Esto es un complemento al webhook: si el webhook llega tarde o falla,
 * la result page activa la suscripción de forma idempotente.
 */
export async function verifyTransaction(transactionId: string): Promise<{
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

        // Si la transacción fue aprobada, activar la suscripción
        if (transaction.status === "APPROVED" && transaction.reference) {
            await activateSubscriptionFromReference(
                transaction.reference,
                transaction.id,
                transaction.amount_in_cents,
                transaction.currency,
                transaction.payment_method_type
            )
        }

        return {
            success: true,
            data: {
                status: transaction.status,
                reference: transaction.reference,
                amount: transaction.amount_in_cents / 100
            }
        }
    } catch (error) {
        console.error("[verifyTransaction] Error:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Error desconocido"
        }
    }
}

/**
 * Activa la suscripción basándose en la referencia de la transacción.
 * Formato de referencia: sub_{subscriptionId}_{timestamp}
 * Es idempotente: si ya está activa, no hace nada.
 */
async function activateSubscriptionFromReference(
    reference: string,
    wompiTransactionId: string,
    amountInCents: number,
    currency: string,
    paymentMethod?: string
) {
    // Extraer subscription ID de la referencia
    if (!reference.startsWith("sub_")) {
        console.log("[activateSubscription] Reference not a subscription:", reference)
        return
    }

    const parts = reference.split("_")
    if (parts.length < 3) {
        console.error("[activateSubscription] Invalid reference format:", reference)
        return
    }

    // UUID está entre sub_ y el timestamp final
    const subscriptionId = parts.slice(1, -1).join("_")

    const supabase = createServiceClient()

    // Buscar la suscripción
    const { data: subscription, error: subError } = await supabase
        .from("subscriptions")
        .select("id, organization_id, status, plan_id, current_period_end")
        .eq("id", subscriptionId)
        .single()

    if (subError || !subscription) {
        console.error("[activateSubscription] Subscription not found:", subscriptionId)
        return
    }

    // Idempotencia: si ya está activa con período vigente, no repetir
    if (subscription.status === "active") {
        const periodEnd = new Date(subscription.current_period_end)
        if (periodEnd > new Date()) {
            console.log("[activateSubscription] Subscription already active:", subscriptionId)
            return
        }
    }

    // Calcular nuevo período (1 mes)
    const now = new Date()
    const newPeriodEnd = new Date(now)
    newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1)

    // Activar suscripción
    await supabase
        .from("subscriptions")
        .update({
            status: "active",
            current_period_start: now.toISOString(),
            current_period_end: newPeriodEnd.toISOString(),
            updated_at: now.toISOString(),
        })
        .eq("id", subscription.id)

    // Registrar transacción de pago (idempotente con upsert)
    await supabase
        .from("payment_transactions")
        .upsert({
            subscription_id: subscription.id,
            organization_id: subscription.organization_id,
            amount: amountInCents / 100,
            currency: currency,
            status: "approved",
            provider: "wompi",
            provider_transaction_id: wompiTransactionId,
            provider_reference: reference,
            payment_method: paymentMethod?.toLowerCase(),
            completed_at: now.toISOString(),
        }, {
            onConflict: "provider_transaction_id"
        })

    console.log(`[activateSubscription] Subscription ${subscriptionId} activated until ${newPeriodEnd.toISOString()}`)
}
