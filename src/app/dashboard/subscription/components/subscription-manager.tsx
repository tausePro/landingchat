"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, Loader2, AlertTriangle, CreditCard, Calendar, Zap } from "lucide-react"
import { upgradeSubscription } from "../actions"

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

    const handleUpgrade = async (planId: string) => {
        setUpgrading(planId)
        setError(null)

        const result = await upgradeSubscription(planId)

        if (!result.success) {
            setError(result.error || "Error al cambiar plan")
            setUpgrading(null)
            return
        }

        if (result.data?.checkoutUrl) {
            // Redirigir a Wompi para pago
            window.location.href = result.data.checkoutUrl
        } else {
            // Recargar página para ver cambios
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
                                            disabled={upgrading !== null}
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
