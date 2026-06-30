"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { initiateReactivation, getReactivationQuote } from "@/app/dashboard/subscription/reactivate-actions"
import type { WompiWidgetData } from "@/app/dashboard/subscription/actions"

// Acceso al widget de Wompi sin redeclarar el global (ya lo declaran otros módulos).
type WidgetCheckoutCtor = new (config: Record<string, unknown>) => {
    open: (cb: (result: { transaction?: { id: string } }) => void) => void
}

function formatMoney(amount: number, currency: string): string {
    try {
        return new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount)
    } catch {
        return `$${Math.round(amount).toLocaleString("es-CO")}`
    }
}

/**
 * Banner de cuenta suspendida con pago self-serve de reactivación (2 meses).
 * Reusa el widget de Wompi (mismo patrón que buy-credits-dialog). El webhook
 * y la result page reactivan la org tras el pago aprobado.
 */
export function ReactivateBanner() {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [fallbackUrl, setFallbackUrl] = useState<string | null>(null)
    const [quote, setQuote] = useState<{ monthsOwed: number; amount: number; currency: string } | null>(null)

    useEffect(() => {
        getReactivationQuote().then((res) => {
            if (res.success && res.data) setQuote(res.data)
        })
    }, [])

    useEffect(() => {
        if (typeof window === "undefined") return
        if ((window as unknown as { WidgetCheckout?: unknown }).WidgetCheckout) return
        const script = document.createElement("script")
        script.src = "https://checkout.wompi.co/widget.js"
        script.async = true
        document.body.appendChild(script)
    }, [])

    const openWidget = useCallback((widgetData: WompiWidgetData) => {
        const WidgetCheckout = (window as unknown as { WidgetCheckout?: WidgetCheckoutCtor }).WidgetCheckout
        if (!WidgetCheckout) {
            if (widgetData.checkoutUrl) setFallbackUrl(widgetData.checkoutUrl)
            else setError("El widget de pago no está disponible. Recarga la página.")
            setLoading(false)
            return
        }
        try {
            const checkout = new WidgetCheckout({
                currency: widgetData.currency,
                amountInCents: widgetData.amountInCents,
                reference: widgetData.reference,
                publicKey: widgetData.publicKey,
                redirectUrl: widgetData.redirectUrl,
                "signature:integrity": widgetData.integritySignature,
                customerData: widgetData.customerEmail ? { email: widgetData.customerEmail } : undefined,
            })
            const timeoutId = setTimeout(() => {
                setLoading(false)
                if (widgetData.isTestMode && widgetData.checkoutUrl) {
                    setFallbackUrl(widgetData.checkoutUrl)
                    setError("El widget no abrió (común en localhost). Usa el botón alternativo abajo.")
                } else {
                    setError("El widget de pago tardó demasiado. Intenta de nuevo.")
                }
            }, 10000)
            checkout.open((result) => {
                clearTimeout(timeoutId)
                setLoading(false)
                if (result.transaction) {
                    window.location.href = `${widgetData.redirectUrl}?id=${result.transaction.id}`
                }
            })
        } catch {
            setError("Error al abrir el widget de pago.")
            setLoading(false)
        }
    }, [])

    const handlePay = async () => {
        setLoading(true)
        setError(null)
        setFallbackUrl(null)
        const result = await initiateReactivation()
        if (!result.success || !result.data) {
            setError(result.error || "No se pudo iniciar el pago")
            setLoading(false)
            return
        }
        openWidget(result.data.widgetData)
    }

    return (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/40">
            <div className="flex items-start gap-3">
                <span className="material-symbols-outlined mt-0.5 text-amber-600">lock</span>
                <div className="flex-1">
                    <p className="font-semibold text-amber-900 dark:text-amber-200">Cuenta suspendida</p>
                    <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
                        Tu tienda y el chat están fuera de línea para tus clientes.{" "}
                        {quote
                            ? `Debes ${quote.monthsOwed} ${quote.monthsOwed === 1 ? "mes" : "meses"} (${formatMoney(quote.amount, quote.currency)}). Reactívala pagando ahora.`
                            : "Reactívala pagando lo que debes."}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                        <Button onClick={handlePay} disabled={loading} className="bg-amber-600 text-white hover:bg-amber-700">
                            {loading ? "Abriendo pago…" : quote ? `Pagar ${formatMoney(quote.amount, quote.currency)}` : "Pagar reactivación"}
                        </Button>
                        {fallbackUrl && (
                            <a href={fallbackUrl} className="text-sm font-medium text-amber-700 underline" target="_blank" rel="noopener noreferrer">
                                Continuar al pago
                            </a>
                        )}
                        {error && <span className="text-sm text-red-600">{error}</span>}
                    </div>
                </div>
            </div>
        </div>
    )
}
