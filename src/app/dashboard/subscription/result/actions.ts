"use server"

import { getPlatformWompiCredentials } from "@/app/admin/platform-payments/actions"

/**
 * Verifica el estado de una transacción de Wompi
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
