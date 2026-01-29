"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Zap, Check, Clock, Shield, Loader2, AlertTriangle } from "lucide-react"
import { formatFoundingPrice } from "@/types"
import {
    generateFoundingPaymentData,
    extendSlotExpiration,
    type FoundingSlotCheckoutData,
} from "../actions"

// Declarar tipos para el widget de Wompi
declare global {
    interface Window {
        WidgetCheckout?: new (config: WompiWidgetConfig) => WompiWidget
    }
}

interface WompiWidgetConfig {
    currency: string
    amountInCents: number
    reference: string
    publicKey: string
    redirectUrl: string
    "signature:integrity": string
    customerData?: {
        email?: string
    }
}

interface WompiWidget {
    open: (callback: (result: WompiResult) => void) => void
}

interface WompiResult {
    transaction?: {
        id: string
        status: string
    }
}

interface FoundingCheckoutProps {
    slot: FoundingSlotCheckoutData
    userEmail: string
}

export function FoundingCheckout({ slot, userEmail }: FoundingCheckoutProps) {
    const router = useRouter()
    const [processing, setProcessing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [wompiLoaded, setWompiLoaded] = useState(false)
    const [fallbackUrl, setFallbackUrl] = useState<string | null>(null)
    const [timeLeft, setTimeLeft] = useState<number>(0)

    // Cargar script de Wompi
    useEffect(() => {
        if (typeof window !== "undefined" && !window.WidgetCheckout) {
            const script = document.createElement("script")
            script.src = "https://checkout.wompi.co/widget.js"
            script.async = true
            script.onload = () => setWompiLoaded(true)
            document.body.appendChild(script)
        } else if (window.WidgetCheckout) {
            setWompiLoaded(true)
        }
    }, [])

    // Countdown timer
    useEffect(() => {
        if (!slot.expires_at) return

        const calculateTimeLeft = () => {
            const expiresAt = new Date(slot.expires_at).getTime()
            const now = Date.now()
            return Math.max(0, Math.floor((expiresAt - now) / 1000))
        }

        setTimeLeft(calculateTimeLeft())

        const interval = setInterval(() => {
            const remaining = calculateTimeLeft()
            setTimeLeft(remaining)

            if (remaining <= 0) {
                clearInterval(interval)
                router.push("/founding?error=expired")
            }
        }, 1000)

        return () => clearInterval(interval)
    }, [slot.expires_at, router])

    // Formatear tiempo restante
    const formatTimeLeft = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, "0")}`
    }

    // Extender tiempo si quedan menos de 5 minutos
    useEffect(() => {
        if (timeLeft > 0 && timeLeft <= 300 && timeLeft % 60 === 0) {
            extendSlotExpiration(slot.id)
        }
    }, [timeLeft, slot.id])

    const openWompiWidget = useCallback((widgetData: {
        publicKey: string
        amountInCents: number
        currency: string
        reference: string
        redirectUrl: string
        integritySignature: string
        customerEmail?: string
        isTestMode: boolean
        checkoutUrl?: string
    }) => {
        if (!window.WidgetCheckout) {
            setError("El widget de pago no está disponible. Intenta recargar la página.")
            setProcessing(false)
            return
        }

        try {
            const checkout = new window.WidgetCheckout({
                currency: widgetData.currency,
                amountInCents: widgetData.amountInCents,
                reference: widgetData.reference,
                publicKey: widgetData.publicKey,
                redirectUrl: widgetData.redirectUrl,
                "signature:integrity": widgetData.integritySignature,
                customerData: widgetData.customerEmail ? {
                    email: widgetData.customerEmail
                } : undefined
            })

            // Timeout de seguridad
            const timeoutId = setTimeout(() => {
                setProcessing(false)

                if (widgetData.isTestMode && widgetData.checkoutUrl) {
                    setFallbackUrl(widgetData.checkoutUrl)
                    setError("El widget de pago no pudo abrirse (común en localhost). Usa el botón alternativo.")
                } else {
                    setError("El widget de pago tardó demasiado. Intenta de nuevo.")
                }
            }, 10000)

            checkout.open((result: WompiResult) => {
                clearTimeout(timeoutId)
                setProcessing(false)

                if (result.transaction) {
                    router.push(`${widgetData.redirectUrl}?id=${result.transaction.id}&slot=${slot.id}`)
                }
            })
        } catch (err) {
            console.error("[Wompi Widget] Error:", err)
            setError("Error al abrir el widget de pago.")
            setProcessing(false)
        }
    }, [router, slot.id])

    const handlePayment = async () => {
        setProcessing(true)
        setError(null)
        setFallbackUrl(null)

        const result = await generateFoundingPaymentData(slot.id, userEmail)

        if (!result.success) {
            setError(result.error || "Error al generar datos de pago")
            setProcessing(false)
            return
        }

        if (!result.data) {
            setError("Error al generar datos de pago")
            setProcessing(false)
            return
        }

        openWompiWidget(result.data.widgetData)
    }

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white">
            {/* Header */}
            <header className="border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-xl">
                <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
                    <div className="flex items-center gap-2">
                        <div className="size-8 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center">
                            <Zap className="size-5 text-white" />
                        </div>
                        <span className="text-lg font-bold">LandingChat</span>
                    </div>

                    {/* Timer */}
                    <div className="flex items-center gap-2 text-sm">
                        <Clock className={`size-4 ${timeLeft < 300 ? "text-red-400" : "text-amber-400"}`} />
                        <span className={timeLeft < 300 ? "text-red-400 font-bold" : "text-slate-400"}>
                            Reserva expira en: {formatTimeLeft(timeLeft)}
                        </span>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-4xl px-4 py-12">
                <div className="grid md:grid-cols-2 gap-8">
                    {/* Left: Order Summary */}
                    <div>
                        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 mb-4">
                            <Zap className="size-3 mr-1" />
                            FOUNDING MEMBER #{slot.slot_number}
                        </Badge>

                        <h1 className="text-3xl font-black mb-2">
                            Completa tu pago
                        </h1>
                        <p className="text-slate-400 mb-8">
                            Asegura tu cupo como Founding Member con precio congelado de por vida.
                        </p>

                        <Card className="bg-white/5 border-white/10">
                            <CardHeader>
                                <CardTitle className="text-white flex items-center justify-between">
                                    <span>Plan {slot.tier_name}</span>
                                    <Badge className="bg-emerald-500">FOUNDING</Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">Precio mensual congelado</span>
                                    <span className="font-semibold">{formatFoundingPrice(slot.locked_price)}/mes</span>
                                </div>

                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">Facturación</span>
                                    <span>Anual (paga {12 - slot.free_months}, obtén 12)</span>
                                </div>

                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">Meses gratis</span>
                                    <span className="text-emerald-400 font-semibold">+{slot.free_months} meses</span>
                                </div>

                                <div className="border-t border-white/10 pt-4">
                                    <div className="flex justify-between">
                                        <span className="font-semibold">Total a pagar hoy</span>
                                        <span className="text-2xl font-black text-emerald-400">
                                            {formatFoundingPrice(slot.annual_price)}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">
                                        {slot.locked_currency} - Pago único anual
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Benefits */}
                        <div className="mt-6 space-y-3">
                            <div className="flex items-center gap-3 text-sm">
                                <div className="rounded-full bg-emerald-500/20 p-1">
                                    <Check className="size-4 text-emerald-400" />
                                </div>
                                <span>Precio congelado mientras mantengas suscripción</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <div className="rounded-full bg-emerald-500/20 p-1">
                                    <Check className="size-4 text-emerald-400" />
                                </div>
                                <span>Soporte Concierge 1:1 por WhatsApp</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <div className="rounded-full bg-emerald-500/20 p-1">
                                    <Check className="size-4 text-emerald-400" />
                                </div>
                                <span>Prioridad en el roadmap de desarrollo</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <div className="rounded-full bg-emerald-500/20 p-1">
                                    <Check className="size-4 text-emerald-400" />
                                </div>
                                <span>Insignia de Founding Member</span>
                            </div>
                        </div>
                    </div>

                    {/* Right: Payment */}
                    <div>
                        <Card className="bg-white/5 border-white/10">
                            <CardHeader>
                                <CardTitle className="text-white flex items-center gap-2">
                                    <Shield className="size-5 text-emerald-400" />
                                    Pago Seguro
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {error && (
                                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
                                        <p className="text-sm text-red-400">{error}</p>
                                        {fallbackUrl && (
                                            <div className="mt-3">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => window.location.href = fallbackUrl}
                                                    className="border-amber-500 text-amber-400 hover:bg-amber-500/10"
                                                >
                                                    <AlertTriangle className="mr-2 size-4" />
                                                    Abrir checkout Wompi (Sandbox)
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <p className="text-sm text-slate-400">
                                    Tu pago será procesado de forma segura a través de Wompi.
                                    Aceptamos tarjetas de crédito, débito, PSE y Nequi.
                                </p>

                                <Button
                                    onClick={handlePayment}
                                    disabled={processing || !wompiLoaded}
                                    className="w-full h-14 text-lg bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 font-bold"
                                >
                                    {processing ? (
                                        <>
                                            <Loader2 className="mr-2 size-5 animate-spin" />
                                            Procesando...
                                        </>
                                    ) : (
                                        <>
                                            <Zap className="mr-2 size-5" />
                                            Pagar {formatFoundingPrice(slot.annual_price)}
                                        </>
                                    )}
                                </Button>

                                <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
                                    <span className="flex items-center gap-1">
                                        <Shield className="size-3" />
                                        SSL Seguro
                                    </span>
                                    <span>•</span>
                                    <span>Powered by Wompi</span>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Guarantee */}
                        <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                            <h4 className="font-semibold text-emerald-400 mb-2">
                                Garantía de Satisfacción
                            </h4>
                            <p className="text-sm text-slate-400">
                                Si no estás satisfecho en los primeros 14 días, te devolvemos el 100% de tu dinero.
                                Sin preguntas.
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
