"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency as formatTenantCurrency } from "@/lib/utils"
import { useTenantCurrency, useTenantLocale } from "@/lib/i18n/use-tenant-strings"

interface ProductStat {
    productId: string
    productName: string
    totalRevenue: number
    totalUnits: number
    imageUrl?: string | null
}

interface TopProductsCardProps {
    topProducts: ProductStat[]
    lowStockProducts: Array<{
        id: string
        name: string
        stock: number
        imageUrl?: string | null
    }>
}

export function TopProductsCard({ topProducts, lowStockProducts }: TopProductsCardProps) {
    const currency = useTenantCurrency()
    const locale = useTenantLocale()
    const formatCurrency = (amount: number) => formatTenantCurrency(amount, { currency, locale })

    const maxRevenue = topProducts.length > 0 ? topProducts[0].totalRevenue : 1

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-500">star</span>
                    Productos Estrella
                </CardTitle>
                <CardDescription>Top productos por ingresos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
                {topProducts.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                        <span className="material-symbols-outlined text-3xl mb-2 block">inventory_2</span>
                        <p className="text-sm">No hay datos de productos</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {topProducts.map((product, index) => (
                            <div key={product.productId} className="flex items-center gap-3">
                                <span className="text-lg font-bold text-muted-foreground w-6 text-right">
                                    {index + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{product.productName}</p>
                                    <div className="flex items-center gap-3 mt-1">
                                        <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-amber-500 rounded-full transition-all"
                                                style={{ width: `${(product.totalRevenue / maxRevenue) * 100}%` }}
                                            />
                                        </div>
                                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                                            {product.totalUnits} uds
                                        </span>
                                    </div>
                                </div>
                                <span className="text-sm font-semibold whitespace-nowrap">
                                    {formatCurrency(product.totalRevenue)}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {lowStockProducts.length > 0 && (
                    <div className="pt-4 border-t">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-red-500 text-base">warning</span>
                            <span className="text-sm font-medium text-red-600 dark:text-red-400">
                                Stock bajo ({lowStockProducts.length})
                            </span>
                        </div>
                        <div className="space-y-2">
                            {lowStockProducts.slice(0, 5).map((product) => (
                                <div key={product.id} className="flex items-center justify-between text-sm">
                                    <span className="truncate text-muted-foreground">{product.name}</span>
                                    <span className={`font-medium px-2 py-0.5 rounded-full text-xs ${
                                        product.stock === 0
                                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                            : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                                    }`}>
                                        {product.stock === 0 ? "Agotado" : `${product.stock} uds`}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
