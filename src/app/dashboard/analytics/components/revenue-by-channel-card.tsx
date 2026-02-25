"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface RevenueByChannelProps {
    revenueBySource: Record<string, { revenue: number; orders: number }>
    totalRevenue: number
    metaAdsSpend?: number | null
}

const sourceConfig: Record<string, { label: string; icon: string; color: string; bgColor: string }> = {
    chat: {
        label: "Chat Conversacional",
        icon: "chat",
        color: "text-blue-600",
        bgColor: "bg-blue-500",
    },
    direct: {
        label: "Venta Directa",
        icon: "language",
        color: "text-gray-600",
        bgColor: "bg-gray-500",
    },
    meta_ads: {
        label: "Meta Ads",
        icon: "campaign",
        color: "text-purple-600",
        bgColor: "bg-purple-500",
    },
    google_ads: {
        label: "Google Ads",
        icon: "ads_click",
        color: "text-yellow-600",
        bgColor: "bg-yellow-500",
    },
    whatsapp: {
        label: "WhatsApp",
        icon: "smartphone",
        color: "text-green-600",
        bgColor: "bg-green-500",
    },
    campaign: {
        label: "Otras Campañas",
        icon: "trending_up",
        color: "text-orange-600",
        bgColor: "bg-orange-500",
    },
}

export function RevenueByChannelCard({ revenueBySource, totalRevenue, metaAdsSpend }: RevenueByChannelProps) {
    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat("es-CO", {
            style: "currency",
            currency: "COP",
            minimumFractionDigits: 0,
        }).format(amount)

    const channels = Object.entries(revenueBySource)
        .map(([key, data]) => ({
            key,
            revenue: data.revenue,
            orders: data.orders,
            percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
            ...sourceConfig[key] || {
                label: key,
                icon: "help",
                color: "text-gray-500",
                bgColor: "bg-gray-400",
            },
        }))
        .sort((a, b) => b.revenue - a.revenue)

    // Calcular ROAS real si hay gasto de Meta Ads y revenue atribuido
    const metaRevenue = revenueBySource["meta_ads"]?.revenue || 0
    const roas = metaAdsSpend && metaAdsSpend > 0 ? metaRevenue / metaAdsSpend : null

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-green-500">account_balance</span>
                    Ingresos por Canal
                </CardTitle>
                <CardDescription>
                    Distribución de ingresos por origen (30 días)
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
                {channels.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                        <span className="material-symbols-outlined text-3xl mb-2 block">info</span>
                        <p className="text-sm">No hay datos de ingresos por canal</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {channels.map((ch) => (
                            <div key={ch.key} className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className={`material-symbols-outlined text-lg ${ch.color}`}>{ch.icon}</span>
                                        <span className="text-sm font-medium">{ch.label}</span>
                                        <span className="text-xs text-muted-foreground">({ch.orders} órdenes)</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-sm font-semibold">{formatCurrency(ch.revenue)}</span>
                                        <span className="text-xs text-muted-foreground ml-2">
                                            ({ch.percentage.toFixed(1)}%)
                                        </span>
                                    </div>
                                </div>
                                <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full ${ch.bgColor} rounded-full transition-all`}
                                        style={{ width: `${ch.percentage}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ROAS Card */}
                {roas !== null && (
                    <div className="pt-4 border-t">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                            <div>
                                <p className="text-sm font-medium text-purple-700 dark:text-purple-300">
                                    ROAS Real (Meta Ads)
                                </p>
                                <p className="text-xs text-purple-600/70 dark:text-purple-400/70 mt-0.5">
                                    Inversión: {formatCurrency(metaAdsSpend!)} → Ventas: {formatCurrency(metaRevenue)}
                                </p>
                            </div>
                            <div className={`text-2xl font-bold ${
                                roas >= 3 ? "text-green-600" : roas >= 1 ? "text-yellow-600" : "text-red-600"
                            }`}>
                                {roas.toFixed(1)}x
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
