"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, Loader2, Sparkles } from "lucide-react"
import { getAvailablePlans, selectPlan, type OnboardingPlan } from "./actions"

export default function OnboardingPlanPage() {
    const router = useRouter()
    const [plans, setPlans] = useState<OnboardingPlan[]>([])
    const [loading, setLoading] = useState(true)
    const [selecting, setSelecting] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        async function loadPlans() {
            const result = await getAvailablePlans()
            if (result.success && result.data) {
                setPlans(result.data)
            } else {
                setError(result.error || "Error al cargar planes")
            }
            setLoading(false)
        }
        loadPlans()
    }, [])

    const handleSelectPlan = async (planId: string) => {
        setSelecting(planId)
        setError(null)

        const result = await selectPlan(planId)

        if (result.success) {
            router.push("/onboarding/success")
        } else {
            setError(result.error || "Error al seleccionar plan")
            setSelecting(null)
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

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="size-8 animate-spin text-primary" />
                <p className="mt-4 text-slate-600">Cargando planes...</p>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="text-center">
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary mb-4">
                    <Sparkles className="size-4" />
                    7 días de prueba gratis en todos los planes
                </div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                    Elige tu plan
                </h1>
                <p className="mt-2 text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
                    Todos los planes incluyen 7 días de prueba gratis. No necesitas tarjeta de crédito para comenzar.
                </p>
            </div>

            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-900/20">
                    <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
            )}

            {/* Plans Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {plans.map((plan) => {
                    const isPopular = plan.slug === "starter" || plan.slug === "growth"
                    const isSelecting = selecting === plan.id

                    return (
                        <Card
                            key={plan.id}
                            className={`relative transition-all hover:shadow-lg ${
                                isPopular
                                    ? "border-primary shadow-md ring-1 ring-primary/20"
                                    : "hover:border-slate-300"
                            }`}
                        >
                            {isPopular && (
                                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                                    Más Popular
                                </Badge>
                            )}

                            <CardHeader className="text-center pb-2">
                                <CardTitle className="text-xl">{plan.name}</CardTitle>
                                <CardDescription className="min-h-[40px]">
                                    {plan.description}
                                </CardDescription>
                            </CardHeader>

                            <CardContent className="space-y-4">
                                <div className="text-center">
                                    <span className="text-4xl font-bold text-slate-900 dark:text-white">
                                        {formatPrice(plan.price, plan.currency)}
                                    </span>
                                    {plan.price > 0 && (
                                        <span className="text-slate-500 dark:text-slate-400">
                                            /{plan.billing_period === "monthly" ? "mes" : "año"}
                                        </span>
                                    )}
                                </div>

                                <div className="pt-4 border-t">
                                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
                                        Incluye:
                                    </p>
                                    <ul className="space-y-2 text-sm">
                                        <li className="flex items-center gap-2">
                                            <Check className="size-4 text-green-500 shrink-0" />
                                            <span>
                                                {plan.max_products === -1 ? "Productos ilimitados" : `${plan.max_products.toLocaleString("es-CO")} productos`}
                                            </span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Check className="size-4 text-green-500 shrink-0" />
                                            <span>
                                                {plan.max_agents === -1 ? "Agentes ilimitados" : `${plan.max_agents} agente${plan.max_agents > 1 ? "s" : ""} de IA`}
                                            </span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Check className="size-4 text-green-500 shrink-0" />
                                            <span>
                                                {plan.max_monthly_conversations === -1 ? "Conversaciones ilimitadas" : `${plan.max_monthly_conversations.toLocaleString("es-CO")} conversaciones/mes`}
                                            </span>
                                        </li>
                                        {plan.features?.whatsapp && (
                                            <li className="flex items-center gap-2">
                                                <Check className="size-4 text-green-500 shrink-0" />
                                                <span>Integración WhatsApp</span>
                                            </li>
                                        )}
                                        {plan.features?.analytics && (
                                            <li className="flex items-center gap-2">
                                                <Check className="size-4 text-green-500 shrink-0" />
                                                <span>Analytics avanzados</span>
                                            </li>
                                        )}
                                        {plan.features?.custom_domain && (
                                            <li className="flex items-center gap-2">
                                                <Check className="size-4 text-green-500 shrink-0" />
                                                <span>Dominio personalizado</span>
                                            </li>
                                        )}
                                        {plan.features?.crm_integration && (
                                            <li className="flex items-center gap-2">
                                                <Check className="size-4 text-green-500 shrink-0" />
                                                <span>CRM Integration</span>
                                            </li>
                                        )}
                                        {plan.features?.white_glove_support && (
                                            <li className="flex items-center gap-2">
                                                <Check className="size-4 text-green-500 shrink-0" />
                                                <span>Soporte White-Glove</span>
                                            </li>
                                        )}
                                    </ul>
                                </div>
                            </CardContent>

                            <CardFooter>
                                <Button
                                    className="w-full"
                                    variant={isPopular ? "default" : "outline"}
                                    onClick={() => handleSelectPlan(plan.id)}
                                    disabled={selecting !== null}
                                >
                                    {isSelecting ? (
                                        <>
                                            <Loader2 className="mr-2 size-4 animate-spin" />
                                            Seleccionando...
                                        </>
                                    ) : (
                                        "Comenzar prueba gratis"
                                    )}
                                </Button>
                            </CardFooter>
                        </Card>
                    )
                })}
            </div>

            {/* Footer note */}
            <p className="text-center text-sm text-slate-500">
                Puedes cambiar o cancelar tu plan en cualquier momento desde tu dashboard.
            </p>
        </div>
    )
}
