"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, Loader2, AlertTriangle, CreditCard, Calendar, Zap } from "lucide-react"
import { upgradeSubscription, type WompiWidgetData } from "../actions"

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

interface Plan {
    id: string
    name: string
    slug: string
    description: string | null
    price: number
    currency: string
    billing_period: string
    max_products: number
    max_agents: number
    max_monthly_conversations: number
    features: Record<string, boolean>
}

interface Subscription {
    id: string
    plan_id: string
    status: string
    current_period_start: string
    current_period_end: string
    cancel_at_period_end: boolean
    price: number
    currency: string
}

interface SubscriptionManagerProps {
    subscription: Subscription | null
    currentPlan: Plan | null
    plans: Plan[]
    daysRemaining: number
}

export function SubscriptionManager({
    subscription,
    currentPlan,
    plans,
    daysRemaining
}: SubscriptionManagerProps) {
    const [upgrading, setUpgrading] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [wompiLoaded, setWompiLoaded] = useState(false)
    const [fallbackUrl, setFallbackUrl] = useState<string | null>(null)

    // Cargar el script del Widget de Wompi
    useEffect(() => {
        if (typeof window !== "undefined" && !window.WidgetCheckout) {
            const script = document.createElement("script")
            script.src = "https://checkout.wompi.co/widget.js"
            script.async = true
            script.onload = () => setWompiLoaded(true)
            document.body.appendChild(script)

            return () => {
                // Cleanup si es necesario
            }
        } else if (window.WidgetCheckout) {
            setWompiLoaded(true)
        }
    }, [])

    const openWompiWidget = useCallback((widgetData: WompiWidgetData) => {
        if (!window.WidgetCheckout) {
            setError("El widget de pago no está disponible. Intenta recargar la página.")
            setUpgrading(null)
            return
        }

        try {
            console.log("[Wompi Widget] Abriendo widget con datos:", {
                currency: widgetData.currency,
                amountInCents: widgetData.amountInCents,
                reference: widgetData.reference,
                publicKey: widgetData.publicKey.substring(0, 20) + "...",
                redirectUrl: widgetData.redirectUrl,
                isTestMode: widgetData.isTestMode
            })

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

            // Timeout de seguridad: si el widget no responde en 10 segundos, mostrar fallback
            const timeoutId = setTimeout(() => {
                console.warn("[Wompi Widget] Timeout - el widget no respondió")
                setUpgrading(null)

                // Si estamos en modo sandbox y hay URL de fallback, mostrarla
                if (widgetData.isTestMode && widgetData.checkoutUrl) {
                    setFallbackUrl(widgetData.checkoutUrl)
                    setError("El widget de pago no pudo abrirse (esto es común en localhost). Usa el botón alternativo abajo para continuar con el pago en modo sandbox.")
                } else {
                    setError("El widget de pago tardó demasiado en responder. Por favor, intenta de nuevo o contacta soporte.")
                }
            }, 10000)

            checkout.open((result: WompiResult) => {
                clearTimeout(timeoutId)
                setUpgrading(null)

                console.log("[Wompi Widget] Resultado:", result)

                if (result.transaction) {
                    // Redirigir a la página de resultado con el ID de transacción
                    window.location.href = `${widgetData.redirectUrl}?id=${result.transaction.id}`
                }
            })
        } catch (err) {
            console.error("[Wompi Widget] Error al abrir widget:", err)
            setError("Error al abrir el widget de pago. Intenta recargar la página.")
            setUpgrading(null)
        }
    }, [])

    const handleUpgrade = async (planId: string) => {
        setUpgrading(planId)
        setError(null)
        setFallbackUrl(null)

        const result = await upgradeSubscription(planId)

        if (!result.success) {
            setError(result.error || "Error al cambiar plan")
            setUpgrading(null)
            return
        }

        if (result.data?.widgetData) {
            // Abrir el Widget de Wompi para pago seguro
            openWompiWidget(result.data.widgetData)
        } else if (result.data?.changed) {
            // El plan cambió inmediatamente (gratis o downgrade)
            window.location.reload()
        }
    }

    const formatPrice = (price: number, currency: string) => {
        if (price === 0) return "Gratis"
        return new Intl.NumberFormat("es-CO", {
            style: "currency",
            currency: currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(price)
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "active":
                return <Badge className="bg-green-500">Activo</Badge>
            case "trialing":
                return <Badge className="bg-blue-500">Período de Prueba</Badge>
            case "past_due":
                return <Badge className="bg-amber-500">Pago Pendiente</Badge>
            case "cancelled":
                return <Badge variant="secondary">Cancelado</Badge>
            default:
                return <Badge variant="secondary">{status}</Badge>
        }
    }

    return (
        <div className="space-y-8">
            {/* Current Subscription Card */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Plan Actual</CardTitle>
                            <CardDescription>
                                {currentPlan?.description || "Sin plan activo"}
                            </CardDescription>
                        </div>
                        {subscription && getStatusBadge(subscription.status)}
                    </div>
                </CardHeader>
                <CardContent>
                    {subscription && currentPlan ? (
                        <div className="grid gap-6 md:grid-cols-3">
                            <div className="flex items-start gap-3">
                                <div className="rounded-lg bg-primary/10 p-2">
                                    <CreditCard className="size-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500">Plan</p>
                                    <p className="font-semibold text-slate-900 dark:text-white">
                                        {currentPlan.name}
                                    </p>
                                    <p className="text-sm text-slate-600">
                                        {formatPrice(currentPlan.price, currentPlan.currency)}/{currentPlan.billing_period === "monthly" ? "mes" : "año"}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="rounded-lg bg-primary/10 p-2">
                                    <Calendar className="size-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500">
                                        {subscription.status === "trialing" ? "Fin de prueba" : "Próximo cobro"}
                                    </p>
                                    <p className="font-semibold text-slate-900 dark:text-white">
                                        {new Date(subscription.current_period_end).toLocaleDateString("es-CO", {
                                            year: "numeric",
                                            month: "long",
                                            day: "numeric"
                                        })}
                                    </p>
                                    <p className="text-sm text-slate-600">
                                        {daysRemaining} días restantes
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="rounded-lg bg-primary/10 p-2">
                                    <Zap className="size-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500">Límites</p>
                                    <p className="text-sm text-slate-900 dark:text-white">
                                        {currentPlan.max_products.toLocaleString("es-CO")} productos
                                    </p>
                                    <p className="text-sm text-slate-600">
                                        {currentPlan.max_monthly_conversations.toLocaleString("es-CO")} conv/mes
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/20">
                            <AlertTriangle className="size-5 text-amber-500" />
                            <p className="text-sm text-amber-700 dark:text-amber-300">
                                No tienes una suscripción activa. Selecciona un plan para continuar.
                            </p>
                        </div>
                    )}

                    {subscription?.status === "trialing" && (
                        <div className="mt-4 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-900/20">
                            <AlertTriangle className="size-5 text-blue-500" />
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                                Tu período de prueba termina en <strong>{daysRemaining} días</strong>.
                                {currentPlan && currentPlan.price > 0 && " Se cobrará automáticamente al finalizar."}
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-900/20">
                    <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                    {fallbackUrl && (
                        <div className="mt-3">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.location.href = fallbackUrl}
                                className="border-amber-500 text-amber-700 hover:bg-amber-50"
                            >
                                <AlertTriangle className="mr-2 size-4" />
                                Abrir checkout de Wompi (Sandbox)
                            </Button>
                            <p className="mt-2 text-xs text-slate-500">
                                Este enlace solo está disponible en modo sandbox para pruebas de desarrollo.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Available Plans */}
            <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
                    {subscription ? "Cambiar Plan" : "Selecciona un Plan"}
                </h2>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {plans.map((plan) => {
                        const isCurrent = currentPlan?.id === plan.id
                        const isUpgrade = currentPlan ? plan.price > currentPlan.price : false
                        const isDowngrade = currentPlan ? plan.price < currentPlan.price : false

                        return (
                            <Card
                                key={plan.id}
                                className={`relative transition-all ${isCurrent
                                        ? "border-green-500 bg-green-50/50 dark:bg-green-900/10"
                                        : "hover:border-slate-300 hover:shadow-md"
                                    }`}
                            >
                                {isCurrent && (
                                    <Badge className="absolute -top-3 left-4 bg-green-500">
                                        Plan Actual
                                    </Badge>
                                )}

                                <CardHeader>
                                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                                    <CardDescription className="min-h-[40px]">
                                        {plan.description}
                                    </CardDescription>
                                </CardHeader>

                                <CardContent className="space-y-4">
                                    <div>
                                        <span className="text-3xl font-bold">
                                            {formatPrice(plan.price, plan.currency)}
                                        </span>
                                        {plan.price > 0 && (
                                            <span className="text-slate-500">
                                                /{plan.billing_period === "monthly" ? "mes" : "año"}
                                            </span>
                                        )}
                                    </div>

                                    <ul className="space-y-2 text-sm">
                                        <li className="flex items-center gap-2">
                                            <Check className="size-4 text-green-500" />
                                            <span>{plan.max_products.toLocaleString("es-CO")} productos</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Check className="size-4 text-green-500" />
                                            <span>{plan.max_agents} agente{plan.max_agents > 1 ? "s" : ""}</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Check className="size-4 text-green-500" />
                                            <span>{plan.max_monthly_conversations.toLocaleString("es-CO")} conv/mes</span>
                                        </li>
                                    </ul>
                                </CardContent>

                                <CardFooter>
                                    {isCurrent ? (
                                        <Button className="w-full" disabled variant="outline">
                                            <Check className="mr-2 size-4" />
                                            Tu plan actual
                                        </Button>
                                    ) : (
                                        <Button
                                            className="w-full"
                                            variant={isUpgrade ? "default" : "outline"}
                                            onClick={() => handleUpgrade(plan.id)}
                                            disabled={upgrading !== null || (!wompiLoaded && isUpgrade && plan.price > 0)}
                                        >
                                            {upgrading === plan.id ? (
                                                <>
                                                    <Loader2 className="mr-2 size-4 animate-spin" />
                                                    Procesando...
                                                </>
                                            ) : isUpgrade ? (
                                                "Mejorar Plan"
                                            ) : isDowngrade ? (
                                                "Cambiar a este plan"
                                            ) : (
                                                "Seleccionar"
                                            )}
                                        </Button>
                                    )}
                                </CardFooter>
                            </Card>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
