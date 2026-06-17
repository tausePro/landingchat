/**
 * Aplicación del pago de un pack de créditos de conversaciones (reference credits_*).
 *
 * Lógica extraída del webhook (/api/webhooks/wompi) para poder testearla de forma
 * aislada — es billing-critical. Idempotente: acredita UNA sola vez vía claim
 * atómico de credited_at. Si la acreditación falla, revierte el claim y devuelve
 * 500 para que Wompi reintente.
 */

import type { SupabaseServiceClient } from "@/lib/supabase/server"
import { WOMPI_STATUS_MAP, type WompiTransactionStatus } from "@/lib/wompi/types"

export interface CreditPaymentTransaction {
    id: string
    status: WompiTransactionStatus
    reference: string
}

export interface CreditPaymentResult {
    httpStatus: number
    body: Record<string, unknown>
}

export async function applyConversationCreditPayment(
    supabase: SupabaseServiceClient,
    transaction: CreditPaymentTransaction
): Promise<CreditPaymentResult> {
    const reference = transaction.reference

    const { data: purchase, error } = await supabase
        .from("credit_purchases")
        .select("id, organization_id, credit_amount, credited_at")
        .eq("reference", reference)
        .maybeSingle()

    if (error || !purchase) {
        return { httpStatus: 404, body: { error: "Credit purchase not found" } }
    }

    // Idempotencia rápida: ya acreditado
    if (purchase.credited_at) {
        return { httpStatus: 200, body: { received: true, alreadyCredited: true } }
    }

    if (transaction.status !== "APPROVED") {
        const mapped = WOMPI_STATUS_MAP[transaction.status]
        const storedStatus = mapped === "voided" ? "error" : mapped
        await supabase
            .from("credit_purchases")
            .update({ status: storedStatus, provider_transaction_id: transaction.id, updated_at: new Date().toISOString() })
            .eq("id", purchase.id)
        return { httpStatus: 200, body: { received: true, status: storedStatus } }
    }

    // Claim atómico: marca credited_at solo si sigue null (evita doble-acreditación
    // bajo reintentos/concurrencia).
    const { data: claimed } = await supabase
        .from("credit_purchases")
        .update({
            status: "approved",
            provider_transaction_id: transaction.id,
            credited_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq("id", purchase.id)
        .is("credited_at", null)
        .select("id")
        .maybeSingle()

    if (!claimed) {
        return { httpStatus: 200, body: { received: true, alreadyCredited: true } }
    }

    const { error: creditError } = await supabase.rpc("add_conversation_credits", {
        org_id: purchase.organization_id,
        amount: purchase.credit_amount,
    })

    if (creditError) {
        // Revertir el claim para permitir el reintento de Wompi
        await supabase
            .from("credit_purchases")
            .update({ status: "error", credited_at: null, updated_at: new Date().toISOString() })
            .eq("id", purchase.id)
        return { httpStatus: 500, body: { error: "Crediting failed" } }
    }

    return { httpStatus: 200, body: { received: true, credited: purchase.credit_amount } }
}
