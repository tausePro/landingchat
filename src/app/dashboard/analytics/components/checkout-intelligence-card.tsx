"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export interface CheckoutStageInsight {
    label: string
    value: number
    icon: string
    dropOffFromPrevious: number
    dropOffRate: number
}

export interface CheckoutIssueInsight {
    label: string
    count: number
    detail: string
    icon: string
    severity: "warning" | "danger"
}

export interface CheckoutProductRisk {
    productId: string
    productName: string
    checkouts: number
    purchases: number
    dropOffRate: number
}

export interface CheckoutIntelligence {
    started: number
    purchases: number
    checkoutToPurchaseRate: number
    biggestLeak: {
        from: string
        to: string
        lost: number
        percentage: number
    } | null
    stages: CheckoutStageInsight[]
    issues: CheckoutIssueInsight[]
    productRisks: CheckoutProductRisk[]
}

interface CheckoutIntelligenceCardProps {
    intelligence: CheckoutIntelligence
}

function formatPercentage(value: number): string {
    return `${value.toFixed(1)}%`
}

function getIssueStyles(severity: CheckoutIssueInsight["severity"]): string {
    return severity === "danger"
        ? "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200"
        : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
}

export function CheckoutIntelligenceCard({ intelligence }: CheckoutIntelligenceCardProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-purple-500">shopping_cart_checkout</span>
                    Inteligencia de Checkout
                </CardTitle>
                <CardDescription>Abandono, fallos y productos con intención alta en los últimos 30 días</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
                <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="rounded-lg bg-muted/50 p-3">
                        <div className="text-2xl font-bold">{intelligence.started.toLocaleString("es-CO")}</div>
                        <div className="text-xs text-muted-foreground">Checkouts</div>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3">
                        <div className="text-2xl font-bold">{intelligence.purchases.toLocaleString("es-CO")}</div>
                        <div className="text-xs text-muted-foreground">Compras</div>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3">
                        <div className="text-2xl font-bold">{formatPercentage(intelligence.checkoutToPurchaseRate)}</div>
                        <div className="text-xs text-muted-foreground">Checkout → compra</div>
                    </div>
                </div>

                {intelligence.biggestLeak && intelligence.biggestLeak.lost > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                        Mayor fuga: <strong>{intelligence.biggestLeak.from} → {intelligence.biggestLeak.to}</strong> perdió {intelligence.biggestLeak.lost.toLocaleString("es-CO")} sesiones ({formatPercentage(intelligence.biggestLeak.percentage)}).
                    </div>
                )}

                <div className="space-y-3">
                    {intelligence.stages.map((stage) => (
                        <div key={stage.label} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
                            <div className="flex min-w-0 items-center gap-2">
                                <span className="material-symbols-outlined text-lg text-muted-foreground">{stage.icon}</span>
                                <div className="min-w-0">
                                    <div className="truncate font-medium">{stage.label}</div>
                                    <div className="text-xs text-muted-foreground">
                                        Drop-off: {stage.dropOffFromPrevious.toLocaleString("es-CO")} · {formatPercentage(stage.dropOffRate)}
                                    </div>
                                </div>
                            </div>
                            <div className="shrink-0 text-right font-semibold">{stage.value.toLocaleString("es-CO")}</div>
                        </div>
                    ))}
                </div>

                {intelligence.issues.length > 0 && (
                    <div className="space-y-2 border-t pt-4">
                        <div className="text-xs font-medium text-muted-foreground">Fricciones detectadas</div>
                        {intelligence.issues.map((issue) => (
                            <div key={issue.label} className={`rounded-lg border px-3 py-2 text-sm ${getIssueStyles(issue.severity)}`}>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex min-w-0 items-start gap-2">
                                        <span className="material-symbols-outlined text-lg">{issue.icon}</span>
                                        <div className="min-w-0">
                                            <div className="font-medium">{issue.label}</div>
                                            <div className="text-xs opacity-80">{issue.detail}</div>
                                        </div>
                                    </div>
                                    <div className="shrink-0 font-bold">{issue.count.toLocaleString("es-CO")}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {intelligence.productRisks.length > 0 && (
                    <div className="space-y-2 border-t pt-4">
                        <div className="text-xs font-medium text-muted-foreground">Productos con checkout sin compra</div>
                        {intelligence.productRisks.map((product) => (
                            <div key={product.productId} className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="truncate font-medium">{product.productName}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {product.checkouts.toLocaleString("es-CO")} checkouts · {product.purchases.toLocaleString("es-CO")} compras
                                        </div>
                                    </div>
                                    <div className="shrink-0 text-right text-xs font-semibold text-amber-600 dark:text-amber-400">
                                        {formatPercentage(product.dropOffRate)} fuga
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
