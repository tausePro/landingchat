"use client"

import { useState } from "react"
import { retryPayment } from "./actions"
import { Loader2 } from "lucide-react"

interface RetryPaymentButtonProps {
    orderId: string
    slug: string
    paymentMethod: string
}

export function RetryPaymentButton({ orderId, slug, paymentMethod }: RetryPaymentButtonProps) {
    const [isLoading, setIsLoading] = useState(false)

    const handleRetry = async () => {
        setIsLoading(true)
        try {
            const result = await retryPayment(orderId, slug)
            if (result.success && result.paymentUrl) {
                window.location.href = result.paymentUrl
            } else {
                alert(result.error || "Error al reintentar el pago")
                setIsLoading(false)
            }
        } catch (error) {
            console.error("Error retrying payment:", error)
            alert("Error al reintentar el pago")
            setIsLoading(false)
        }
    }

    return (
        <button
            onClick={handleRetry}
            disabled={isLoading}
            className="px-6 py-3 rounded-lg bg-primary-light dark:bg-primary-dark text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
            {isLoading ? (
                <>
                    <Loader2 className="size-5 animate-spin" />
                    Procesando...
                </>
            ) : (
                "Reintentar Pago"
            )}
        </button>
    )
}
