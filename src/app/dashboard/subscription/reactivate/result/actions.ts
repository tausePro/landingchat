"use server"

import { createServiceClient } from "@/lib/supabase/server"
import { getPlatformWompiCredentials } from "@/app/admin/platform-payments/actions"
import { notifyMerchantSuspension } from "@/lib/notifications/suspension-notices"

/**
 * Verifica el pago de reactivación en Wompi y, si fue aprobado, reactiva la org
 * (idempotente). Complemento al webhook: si éste llega tarde o falla, la result
 * page reactiva igual. Referencia: reactivate_{orgId}_{timestamp}.
 */
export async function verifyReactivation(transactionId: string): Promise<{
    success: boolean
    data?: { status: string; reference: string; amount: number }
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
        if (!response.ok) return { success: false, error: "Error al verificar transacción" }

        const data = await response.json()
        const transaction = data.data

        if (
            transaction.status === "APPROVED" &&
            typeof transaction.reference === "string" &&
            transaction.reference.startsWith("reactivate_")
        ) {
            const parts = (transaction.reference as string).split("_")
            const organizationId = parts.length >= 3 ? parts.slice(1, -1).join("_") : null
            if (organizationId) {
                const supabase = createServiceClient()
                // Idempotente: solo flipa si estaba suspendida y notifica solo quien flipa
                // (evita duplicar el aviso con el webhook).
                const { data: flipped } = await supabase
                    .from("organizations")
                    .update({ status: "active", suspended_at: null, suspend_at: null })
                    .eq("id", organizationId)
                    .eq("status", "suspended")
                    .select("id")
                if (flipped && flipped.length > 0) {
                    await notifyMerchantSuspension({ organizationId, type: "reactivated" })
                }
            }
        }

        return {
            success: true,
            data: {
                status: transaction.status,
                reference: transaction.reference,
                amount: transaction.amount_in_cents / 100,
            },
        }
    } catch (error) {
        console.error("[verifyReactivation] Error:", error)
        return { success: false, error: error instanceof Error ? error.message : "Error desconocido" }
    }
}
