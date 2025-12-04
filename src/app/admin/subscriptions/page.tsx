"use client"

import { useState, useEffect } from "react"
import { type SubscriptionWithOrg, type SubscriptionMetrics, type SubscriptionStatus } from "@/types"
import { getSubscriptions, getSubscriptionMetrics } from "./actions"
import { SubscriptionList } from "./components/subscription-list"
import { RefreshCw, Users, DollarSign, TrendingUp, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export default function SubscriptionsPage() {
    const [subscriptions, setSubscriptions] = useState<SubscriptionWithOrg[]>([])
    const [metrics, setMetrics] = useState<SubscriptionMetrics | null>(null)
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState<SubscriptionStatus | "all">("all")

    const loadData = async () => {
        setLoading(true)

        const [subsResult, metricsResult] = await Promise.all([
            getSubscriptions(statusFilter === "all" ? undefined : { status: statusFilter }),
            getSubscriptionMetrics(),
        ])

        setLoading(false)

        if (subsResult.success) {
            setSubscriptions(subsResult.data.subscriptions)
        } else {
            toast.error(subsResult.error)
        }

        if (metricsResult.success) {
            setMetrics(metricsResult.data)
        }
    }

    useEffect(() => {
        loadData()
    }, [statusFilter])

    const formatPrice = (price: number, currency = "COP") => {
        return new Intl.NumberFormat("es-CO", {
            style: "currency",
            currency,
            minimumFractionDigits: 0,
        }).format(price)
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Suscripciones</h2>
                    <p className="text-muted-foreground">
                        Monitorea las suscripciones de todas las organizaciones.
                    </p>
                </div>
                <Button variant="outline" size="icon" onClick={loadData} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
            </div>

            {/* Métricas */}
            {metrics && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border bg-card p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">MRR</p>
                                <h3 className="mt-2 text-3xl font-bold">
                                    {formatPrice(metrics.mrr, metrics.mrr_currency)}
                                </h3>
                            </div>
                            <div className="rounded-full bg-green-50 p-3 dark:bg-green-900/20">
                                <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl border bg-card p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Suscripciones Activas</p>
                                <h3 className="mt-2 text-3xl font-bold">{metrics.active_subscriptions}</h3>
                            </div>
                            <div className="rounded-full bg-blue-50 p-3 dark:bg-blue-900/20">
                                <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl border bg-card p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Total Suscripciones</p>
                                <h3 className="mt-2 text-3xl font-bold">{metrics.total_subscriptions}</h3>
                            </div>
                            <div className="rounded-full bg-purple-50 p-3 dark:bg-purple-900/20">
                                <Users className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl border bg-card p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Vencidas</p>
                                <h3 className="mt-2 text-3xl font-bold">
                                    {metrics.subscriptions_by_status.find((s) => s.status === "past_due")?.count || 0}
                                </h3>
                            </div>
                            <div className="rounded-full bg-red-50 p-3 dark:bg-red-900/20">
                                <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Lista de suscripciones */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <SubscriptionList
                    subscriptions={subscriptions}
                    onFilterChange={setStatusFilter}
                    currentFilter={statusFilter}
                />
            )}
        </div>
    )
}
