"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import {
    getCreditPacks,
    initiateCreditPurchase,
    type CreditPack,
} from "@/app/dashboard/subscription/credit-actions"
import type { WompiWidgetData } from "@/app/dashboard/subscription/actions"

// Acceso al widget de Wompi sin redeclarar el global (ya lo declaran otros módulos).
type WidgetCheckoutCtor = new (config: Record<string, unknown>) => {
    open: (cb: (result: { transaction?: { id: string } }) => void) => void
}

interface BuyCreditsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function BuyCreditsDialog({ open, onOpenChange }: BuyCreditsDialogProps) {
    const [packs, setPacks] = useState<CreditPack[] | null>(null)
    const [loadingPacks, setLoadingPacks] = useState(false)
    const [purchasingId, setPurchasingId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [fallbackUrl, setFallbackUrl] = useState<string | null>(null)

    // Cargar packs al abrir (una sola vez)
    useEffect(() => {
        if (!open) return
        setError(null)
        setFallbackUrl(null)
        if (packs === null) {
            setLoadingPacks(true)
            getCreditPacks()
                .then((p) => setPacks(p))
                .catch(() => setPacks([]))
                .finally(() => setLoadingPacks(false))
        }
    }, [open, packs])

    // Cargar el script del widget de Wompi
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
            setPurchasingId(null)
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
                setPurchasingId(null)
                if (widgetData.isTestMode && widgetData.checkoutUrl) {
                    setFallbackUrl(widgetData.checkoutUrl)
                    setError("El widget no abrió (común en localhost). Usa el botón alternativo abajo.")
                } else {
                    setError("El widget de pago tardó demasiado. Intenta de nuevo.")
                }
            }, 10000)
            checkout.open((result) => {
                clearTimeout(timeoutId)
                setPurchasingId(null)
                if (result.transaction) {
                    window.location.href = `${widgetData.redirectUrl}?id=${result.transaction.id}`
                }
            })
        } catch {
            setError("Error al abrir el widget de pago.")
            setPurchasingId(null)
        }
    }, [])

    const handleBuy = async (packId: string) => {
        setPurchasingId(packId)
        setError(null)
        setFallbackUrl(null)
        const result = await initiateCreditPurchase(packId)
        if (!result.success || !result.data) {
            setError(result.error || "No se pudo iniciar la compra")
            setPurchasingId(null)
            return
        }
        openWidget(result.data.widgetData)
    }

    const formatCOP = (n: number) =>
        n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Comprar conversaciones</DialogTitle>
                    <DialogDescription>
                        Los créditos se suman a tu límite mensual y no vencen.
                    </DialogDescription>
                </DialogHeader>

                {loadingPacks && (
                    <div className="flex justify-center py-8">
                        <Loader2 className="size-6 animate-spin text-muted-foreground" />
                    </div>
                )}

                {!loadingPacks && packs && packs.length === 0 && (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                        No hay packs disponibles por ahora.
                    </p>
                )}

                {!loadingPacks && packs && packs.length > 0 && (
                    <div className="space-y-3">
                        {packs.map((pack) => (
                            <div
                                key={pack.id}
                                className="flex items-center justify-between rounded-lg border border-border-light/80 p-3 dark:border-border-dark/80"
                            >
                                <div>
                                    <p className="font-semibold">{pack.name}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {pack.creditAmount.toLocaleString("es-CO")} conversaciones · {formatCOP(pack.price)}
                                    </p>
                                </div>
                                <Button size="sm" onClick={() => handleBuy(pack.id)} disabled={purchasingId !== null}>
                                    {purchasingId === pack.id ? <Loader2 className="size-4 animate-spin" /> : "Comprar"}
                                </Button>
                            </div>
                        ))}
                    </div>
                )}

                {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

                {fallbackUrl && (
                    <a href={fallbackUrl} target="_blank" rel="noopener noreferrer" className="block">
                        <Button variant="outline" className="w-full">
                            Continuar el pago (sandbox)
                        </Button>
                    </a>
                )}

                <div className="border-t border-border-light/80 pt-3 text-center text-sm text-muted-foreground dark:border-border-dark/80">
                    ¿Necesitas más en tu plan base?{" "}
                    <Link href="/dashboard/subscription" className="font-medium text-primary hover:underline">
                        Subir de plan
                    </Link>
                </div>
            </DialogContent>
        </Dialog>
    )
}
