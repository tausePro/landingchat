"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export interface ProactiveNudgeProductInsight {
    productId: string
    productName: string
    shown: number
    clicked: number
    dismissed: number
    ctr: number
}

export interface ProactiveNudgeAnalytics {
    shown: number
    clicked: number
    dismissed: number
    chatsStarted: number
    orders: number
    revenue: number
    ctr: number
    chatStartRate: number
    orderRate: number
    webChatClicks: number
    whatsappClicks: number
    topProducts: ProactiveNudgeProductInsight[]
}

interface ProactiveNudgeCardProps {
    analytics: ProactiveNudgeAnalytics
}

function formatPercentage(value: number): string {
    return `${value.toFixed(1)}%`
}

function formatNumber(value: number): string {
    return value.toLocaleString("es-CO")
}

function formatCurrency(value: number): string {
    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: 0,
    }).format(value)
}

export function ProactiveNudgeCard({ analytics }: ProactiveNudgeCardProps) {
    const totalClicks = analytics.webChatClicks + analytics.whatsappClicks
    const webChatShare = totalClicks > 0 ? (analytics.webChatClicks / totalClicks) * 100 : 0
    const whatsappShare = totalClicks > 0 ? (analytics.whatsappClicks / totalClicks) * 100 : 0

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-500">bolt</span>
                    Burbuja proactiva
                </CardTitle>
                <CardDescription>Intención generada por nudges contextuales en PDP</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div className="rounded-lg bg-muted/50 p-3">
                        <div className="text-2xl font-bold">{formatNumber(analytics.shown)}</div>
                        <div className="text-xs text-muted-foreground">Mostradas</div>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3">
                        <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatNumber(analytics.clicked)}</div>
                        <div className="text-xs text-muted-foreground">Clicks</div>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3">
                        <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{formatPercentage(analytics.ctr)}</div>
                        <div className="text-xs text-muted-foreground">CTR</div>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3">
                        <div className="text-2xl font-bold">{formatNumber(analytics.dismissed)}</div>
                        <div className="text-xs text-muted-foreground">Cerradas</div>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-300">{formatNumber(analytics.chatsStarted)}</div>
                        <div className="text-xs text-muted-foreground">Chats iniciados</div>
                    </div>
                    <div className="rounded-lg bg-green-50 p-3 dark:bg-green-900/20">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-300">{formatNumber(analytics.orders)}</div>
                        <div className="text-xs text-muted-foreground">Órdenes atribuidas</div>
                    </div>
                    <div className="rounded-lg bg-emerald-50 p-3 dark:bg-emerald-900/20">
                        <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-300">{formatCurrency(analytics.revenue)}</div>
                        <div className="text-xs text-muted-foreground">Revenue atribuido</div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg border px-3 py-2">
                        <div className="font-semibold">{formatPercentage(analytics.chatStartRate)}</div>
                        <div className="text-xs text-muted-foreground">Click → chat</div>
                    </div>
                    <div className="rounded-lg border px-3 py-2">
                        <div className="font-semibold">{formatPercentage(analytics.orderRate)}</div>
                        <div className="text-xs text-muted-foreground">Chat → orden</div>
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Destino de clicks</span>
                        <span className="font-medium">{formatNumber(totalClicks)} total</span>
                    </div>
                    <div className="flex h-3 overflow-hidden rounded-full bg-muted">
                        {totalClicks > 0 && (
                            <>
                                <div
                                    className="bg-blue-500"
                                    style={{ width: `${webChatShare}%` }}
                                    title={`Chat AI: ${formatNumber(analytics.webChatClicks)}`}
                                />
                                <div
                                    className="bg-green-500"
                                    style={{ width: `${whatsappShare}%` }}
                                    title={`WhatsApp: ${formatNumber(analytics.whatsappClicks)}`}
                                />
                            </>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-blue-500" />
                            Chat AI ({formatNumber(analytics.webChatClicks)})
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-green-500" />
                            WhatsApp fallback ({formatNumber(analytics.whatsappClicks)})
                        </span>
                    </div>
                </div>

                {analytics.topProducts.length > 0 ? (
                    <div className="space-y-2 border-t pt-4">
                        <div className="text-xs font-medium text-muted-foreground">Productos con más intención</div>
                        {analytics.topProducts.map((product) => (
                            <div key={product.productId} className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="truncate font-medium">{product.productName}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {formatNumber(product.shown)} vistas · {formatNumber(product.clicked)} clicks · {formatNumber(product.dismissed)} cerradas
                                        </div>
                                    </div>
                                    <div className="shrink-0 text-right text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                        {formatPercentage(product.ctr)} CTR
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                        Aún no hay eventos de burbuja proactiva en este período.
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
