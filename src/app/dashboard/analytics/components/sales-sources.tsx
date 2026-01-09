"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface SalesSourcesProps {
    ordersBySource: Record<string, number>
    totalOrders: number
}

const sourceConfig: Record<string, { label: string; icon: string; color: string; bgColor: string }> = {
    chat: { 
        label: "Chat Conversacional", 
        icon: "chat", 
        color: "text-blue-600",
        bgColor: "bg-blue-500"
    },
    direct: { 
        label: "Venta Directa", 
        icon: "language", 
        color: "text-gray-600",
        bgColor: "bg-gray-500"
    },
    meta_ads: { 
        label: "Meta Ads", 
        icon: "campaign", 
        color: "text-purple-600",
        bgColor: "bg-purple-500"
    },
    google_ads: { 
        label: "Google Ads", 
        icon: "ads_click", 
        color: "text-yellow-600",
        bgColor: "bg-yellow-500"
    },
    whatsapp: { 
        label: "WhatsApp", 
        icon: "smartphone", 
        color: "text-green-600",
        bgColor: "bg-green-500"
    },
    campaign: { 
        label: "Otras Campañas", 
        icon: "trending_up", 
        color: "text-orange-600",
        bgColor: "bg-orange-500"
    },
}

export function SalesSources({ ordersBySource, totalOrders }: SalesSourcesProps) {
    const sources = Object.entries(ordersBySource)
        .map(([key, count]) => ({
            key,
            count,
            percentage: totalOrders > 0 ? (count / totalOrders) * 100 : 0,
            ...sourceConfig[key] || { 
                label: key, 
                icon: "help", 
                color: "text-gray-500",
                bgColor: "bg-gray-400"
            }
        }))
        .sort((a, b) => b.count - a.count)

    if (sources.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Origen de Ventas</CardTitle>
                    <CardDescription>De dónde vienen tus clientes</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                        <span className="material-symbols-outlined text-4xl mb-2 block">info</span>
                        <p>No hay datos de origen disponibles</p>
                        <p className="text-sm mt-1">Las nuevas órdenes mostrarán su origen aquí</p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Origen de Ventas</CardTitle>
                <CardDescription>De dónde vienen tus clientes ({totalOrders} órdenes)</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {sources.map((source) => (
                        <div key={source.key} className="flex items-center gap-4">
                            <div className={`p-2 rounded-lg ${source.color} bg-opacity-10`}>
                                <span className="material-symbols-outlined">{source.icon}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-medium text-sm">{source.label}</span>
                                    <span className="text-sm text-muted-foreground">
                                        {source.count} ({source.percentage.toFixed(1)}%)
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                    <div 
                                        className={`${source.bgColor} h-2 rounded-full transition-all`}
                                        style={{ width: `${source.percentage}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
