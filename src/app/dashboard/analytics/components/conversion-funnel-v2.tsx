"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export interface FunnelProduct {
    productId: string
    productName: string
    count: number
}

export interface FunnelStage {
    label: string
    value: number
    icon: string
    color: string
    products?: FunnelProduct[]
}

interface ConversionFunnelV2Props {
    stages: FunnelStage[]
    criticalDropOff?: {
        from: string
        to: string
        lost: number
        percentage: number
    } | null
}

function formatPercentage(value: number): string {
    return `${value.toFixed(1)}%`
}

export function ConversionFunnelV2({ stages, criticalDropOff }: ConversionFunnelV2Props) {
    const firstValue = stages[0]?.value || 0

    return (
        <Card>
            <CardHeader>
                <CardTitle>Embudo de Conversión</CardTitle>
                <CardDescription>Eventos first-party de tienda y checkout</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
                {criticalDropOff && criticalDropOff.lost > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                        Mayor ruptura: <strong>{criticalDropOff.from} → {criticalDropOff.to}</strong> perdió {criticalDropOff.lost} usuarios/eventos ({formatPercentage(criticalDropOff.percentage)}).
                    </div>
                )}

                <div className="space-y-4">
                    {stages.map((stage, index) => {
                        const previous = index === 0 ? stage.value : stages[index - 1]?.value || 0
                        const fromStartRate = firstValue > 0 ? (stage.value / firstValue) * 100 : 0
                        const stepRate = index === 0 ? 100 : previous > 0 ? (stage.value / previous) * 100 : 0
                        const lost = index === 0 ? 0 : Math.max(previous - stage.value, 0)
                        const barWidth = Math.max(Math.min(fromStartRate, 100), stage.value > 0 ? 6 : 0)

                        return (
                            <div key={stage.label} className="space-y-2">
                                <div className="flex items-center justify-between gap-3 text-sm">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="material-symbols-outlined text-muted-foreground text-xl">{stage.icon}</span>
                                        <span className="font-medium truncate">{stage.label}</span>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="font-bold">{stage.value.toLocaleString("es-CO")}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {index === 0 ? "Inicio" : `${formatPercentage(stepRate)} del paso anterior`}
                                        </div>
                                    </div>
                                </div>
                                <div className="h-3 rounded-full bg-muted overflow-hidden">
                                    <div className={`h-full rounded-full ${stage.color}`} style={{ width: `${barWidth}%` }} />
                                </div>
                                {index > 0 && (
                                    <div className="text-xs text-muted-foreground">
                                        Drop-off: {lost.toLocaleString("es-CO")} ({formatPercentage(Math.max(100 - stepRate, 0))})
                                    </div>
                                )}
                                {stage.products && stage.products.length > 0 && (
                                    <div className="rounded-lg bg-muted/50 px-3 py-2">
                                        <div className="text-xs font-medium text-muted-foreground mb-1">Productos involucrados</div>
                                        <div className="space-y-1">
                                            {stage.products.map((product) => (
                                                <div key={`${stage.label}-${product.productId}`} className="flex items-center justify-between gap-3 text-xs">
                                                    <span className="truncate">{product.productName}</span>
                                                    <span className="font-semibold shrink-0">{product.count.toLocaleString("es-CO")}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </CardContent>
        </Card>
    )
}
