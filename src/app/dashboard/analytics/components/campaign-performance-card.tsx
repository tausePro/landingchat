"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export interface CampaignPerformance {
    campaignName: string
    source: string
    visits: number
    productViews: number
    addToCart: number
    checkouts: number
    purchases: number
    revenue: number
}

interface CampaignPerformanceCardProps {
    campaigns: CampaignPerformance[]
}

function formatCurrency(amount: number) {
    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: 0,
    }).format(amount)
}

export function CampaignPerformanceCard({ campaigns }: CampaignPerformanceCardProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Campañas Meta</CardTitle>
                <CardDescription>Rendimiento first-party por campaña detectada</CardDescription>
            </CardHeader>
            <CardContent>
                {campaigns.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                        Aún no hay eventos con atribución de campañas Meta.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {campaigns.map((campaign) => {
                            const checkoutRate = campaign.addToCart > 0 ? (campaign.checkouts / campaign.addToCart) * 100 : 0
                            const purchaseRate = campaign.checkouts > 0 ? (campaign.purchases / campaign.checkouts) * 100 : 0

                            return (
                                <div key={`${campaign.source}-${campaign.campaignName}`} className="rounded-lg border p-4 space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="font-semibold truncate">{campaign.campaignName}</div>
                                            <div className="text-xs text-muted-foreground truncate">{campaign.source}</div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="font-bold">{formatCurrency(campaign.revenue)}</div>
                                            <div className="text-xs text-muted-foreground">Revenue</div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                        <div className="rounded-md bg-muted/50 p-2">
                                            <div className="font-semibold">{campaign.visits.toLocaleString("es-CO")}</div>
                                            <div className="text-muted-foreground">Visitas</div>
                                        </div>
                                        <div className="rounded-md bg-muted/50 p-2">
                                            <div className="font-semibold">{campaign.addToCart.toLocaleString("es-CO")}</div>
                                            <div className="text-muted-foreground">Carritos</div>
                                        </div>
                                        <div className="rounded-md bg-muted/50 p-2">
                                            <div className="font-semibold">{campaign.purchases.toLocaleString("es-CO")}</div>
                                            <div className="text-muted-foreground">Compras</div>
                                        </div>
                                    </div>

                                    <div className="text-xs text-muted-foreground">
                                        Carrito → Checkout: {checkoutRate.toFixed(1)}% · Checkout → Compra: {purchaseRate.toFixed(1)}%
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
