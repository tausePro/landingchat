"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, Loader2 } from "lucide-react"
import { initiateWompiPayment, type CheckoutPlan, type CurrentSubscription } from "../actions"

interface CheckoutClientProps {
    plans: CheckoutPlan[]
    currentSubscription: CurrentSubscription | null
}

export function CheckoutClient({ plans, currentSubscription }: CheckoutClientProps) {
    const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSelectPlan = async (planId: string) => {
        setSelectedPlan(planId)
        setLoading(true)
        setError(null)

        try {
            const result = await initiateWompiPayment(planId)

            if (!result.success || !result.data) {
                setError(result.error || "Error al iniciar el pago")
                setLoading(false)
                return
            }

            // Redirigir al widget de Wompi
            const { publicKey, amountInCents, currency, reference, redirectUrl, integritySignature } = result.data

            // Crear formulario oculto y enviar a Wompi
            const form = document.createElement("form")
            form.method = "GET"
            form.action = result.data.isTestMode
                ? "https://checkout.wompi.co/p/"
                : "https://checkout.wompi.co/p/"

            const params = {
                "public-key": publicKey,
                "currency": currency,
                "amount-in-cents": amountInCents.toString(),
                "reference": reference,
                "redirect-url": redirectUrl,
                "signature:integrity": integritySignature,
            }

            Object.entries(params).forEach(([key, value]) => {
                const input = document.createElement("input")
                input.type = "hidden"
                input.name = key
                input.value = value
                form.appendChild(input)
            })

            document.body.appendChild(form)
            form.submit()

        } catch (err) {
            console.error("Error initiating payment:", err)
            setError("Error inesperado al iniciar el pago")
            setLoading(false)
        }
    }

    const formatPrice = (price: number, currency: string) => {
        return new Intl.NumberFormat("es-CO", {
            style: "currency",
            currency: currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(price)
    }

    const isPlanCurrent = (planId: string) => {
        return currentSubscription?.plan_id === planId &&
            (currentSubscription?.status === "active" || currentSubscription?.status === "trialing")
    }

    return (
        <div className="space-y-6">
            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-900/20">
                    <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
            )}

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {plans.map((plan) => {
                    const isCurrent = isPlanCurrent(plan.id)
                    const isSelected = selectedPlan === plan.id

                    return (
                        <Card
                            key={plan.id}
                            className={`relative transition-all ${isCurrent
                                    ? "border-green-500 bg-green-50/50 dark:bg-green-900/10"
                                    : isSelected
                                        ? "border-indigo-500 ring-2 ring-indigo-500"
                                        : "hover:border-slate-300"
                                }`}
                        >
                            {isCurrent && (
                                <Badge className="absolute -top-3 left-4 bg-green-500">
                                    Plan Actual
                                </Badge>
                            )}

                            <CardHeader>
                                <CardTitle className="text-xl">{plan.name}</CardTitle>
                                <CardDescription>{plan.description}</CardDescription>
                            </CardHeader>

                            <CardContent className="space-y-4">
                                <div>
                                    <span className="text-3xl font-bold">
                                        {formatPrice(plan.price, plan.currency)}
                                    </span>
                                    <span className="text-slate-500 dark:text-slate-400">
                                        /{plan.billing_period === "monthly" ? "mes" : "año"}
                                    </span>
                                </div>

                                <ul className="space-y-2 text-sm">
                                    <li className="flex items-center gap-2">
                                        <Check className="size-4 text-green-500" />
                                        <span>{plan.max_products.toLocaleString("es-CO")} productos</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <Check className="size-4 text-green-500" />
                                        <span>{plan.max_agents} agente{plan.max_agents > 1 ? "s" : ""} de IA</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <Check className="size-4 text-green-500" />
                                        <span>{plan.max_monthly_conversations.toLocaleString("es-CO")} conversaciones/mes</span>
                                    </li>
                                    {plan.features && Object.entries(plan.features).map(([feature, enabled]) => (
                                        enabled && (
                                            <li key={feature} className="flex items-center gap-2">
                                                <Check className="size-4 text-green-500" />
                                                <span className="capitalize">{feature.replace(/_/g, " ")}</span>
                                            </li>
                                        )
                                    ))}
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
                                        onClick={() => handleSelectPlan(plan.id)}
                                        disabled={loading}
                                    >
                                        {loading && isSelected ? (
                                            <>
                                                <Loader2 className="mr-2 size-4 animate-spin" />
                                                Procesando...
                                            </>
                                        ) : (
                                            plan.price === 0 ? "Comenzar Gratis" : "Seleccionar Plan"
                                        )}
                                    </Button>
                                )}
                            </CardFooter>
                        </Card>
                    )
                })}
            </div>

            {currentSubscription && (
                <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                    <h3 className="font-medium text-slate-900 dark:text-white">
                        Tu suscripcion actual
                    </h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        Estado: <Badge variant={currentSubscription.status === "active" ? "default" : "secondary"}>
                            {currentSubscription.status === "active" ? "Activo" :
                                currentSubscription.status === "trialing" ? "Periodo de Prueba" :
                                    currentSubscription.status === "past_due" ? "Pago Pendiente" :
                                        currentSubscription.status}
                        </Badge>
                    </p>
                    {currentSubscription.current_period_end && (
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                            Proximo cobro: {new Date(currentSubscription.current_period_end).toLocaleDateString("es-CO", {
                                year: "numeric",
                                month: "long",
                                day: "numeric"
                            })}
                        </p>
                    )}
                </div>
            )}
        </div>
    )
}
