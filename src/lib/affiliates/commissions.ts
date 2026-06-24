import { type SupabaseServiceClient } from "@/lib/supabase/server"

/** Comisión = base × rate%, redondeada a centavos. 0 ante valores inválidos. */
export function computeCommissionAmount(baseAmount: number, rate: number): number {
    if (!Number.isFinite(baseAmount) || !Number.isFinite(rate) || baseAmount <= 0 || rate <= 0) return 0
    return Math.round(baseAmount * rate) / 100
}

/**
 * Genera la comisión de afiliado para un pago de suscripción de un merchant.
 *
 * Idempotente: `unique(source_type, source_id)` en affiliate_commissions evita
 * doble comisión. Se llama desde el webhook de Wompi Y desde la result page
 * (ambos confirman el pago) — la idempotencia cubre que se dispare en cualquiera.
 *
 * NO lanza ni bloquea: cualquier fallo se loguea (es un efecto secundario del pago).
 * El org del merchant se obtiene de `subscriptions` (no de payment_transactions,
 * que el webhook no llena con organization_id). Marca el referral como
 * 'converted' en el primer pago (nace 'pending' en el signup).
 */
export async function generateAffiliateCommissionForSubscriptionPayment(
    supabase: SupabaseServiceClient,
    params: { subscriptionId: string; providerTransactionId: string; amount: number },
): Promise<void> {
    const { subscriptionId, providerTransactionId, amount } = params
    try {
        if (!subscriptionId || !providerTransactionId || !amount || amount <= 0) return

        // Org del merchant que pagó.
        const { data: sub } = await supabase
            .from("subscriptions")
            .select("organization_id")
            .eq("id", subscriptionId)
            .single()
        if (!sub?.organization_id) return

        // Referral del merchant (cualquier estado: en el primer pago está 'pending').
        const { data: referral } = await supabase
            .from("affiliate_referrals")
            .select("id, affiliate_id, status")
            .eq("subject_type", "organization")
            .eq("subject_id", sub.organization_id)
            .limit(1)
            .maybeSingle()
        if (!referral) return // el merchant no fue referido por nadie

        // Afiliado activo + su tarifa.
        const { data: affiliate } = await supabase
            .from("affiliates")
            .select("id, commission_rate, status")
            .eq("id", referral.affiliate_id)
            .single()
        if (!affiliate || affiliate.status !== "active") return

        // Id del payment_transaction = source de la comisión (idempotencia).
        const { data: paymentTx } = await supabase
            .from("payment_transactions")
            .select("id")
            .eq("provider_transaction_id", providerTransactionId)
            .maybeSingle()
        if (!paymentTx) return

        const rate = Number(affiliate.commission_rate)
        const commissionAmount = computeCommissionAmount(amount, rate)

        const { error } = await supabase
            .from("affiliate_commissions")
            .upsert({
                affiliate_id: affiliate.id,
                referral_id: referral.id,
                source_type: "subscription_payment",
                source_id: paymentTx.id,
                base_amount: amount,
                rate,
                amount: commissionAmount,
                status: "pending",
            }, { onConflict: "source_type,source_id", ignoreDuplicates: true })
        if (error) {
            console.error("[affiliateCommission] upsert error:", error.message)
            return
        }

        // Primer pago → marcar el referral como convertido.
        if (referral.status !== "converted") {
            await supabase
                .from("affiliate_referrals")
                .update({ status: "converted", converted_at: new Date().toISOString() })
                .eq("id", referral.id)
        }
    } catch (error) {
        console.error("[affiliateCommission] no-fatal:", error)
    }
}
