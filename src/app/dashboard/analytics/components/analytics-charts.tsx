"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface AnalyticsChartsProps {
    ordersByDay: Array<{ date: string; orders: number }>
    revenueByDay: Array<{ date: string; revenue: number }>
}

export function AnalyticsCharts({ ordersByDay, revenueByDay }: AnalyticsChartsProps) {
    const maxOrders = Math.max(...ordersByDay.map(d => d.orders), 1)
    const maxRevenue = Math.max(...revenueByDay.map(d => d.revenue), 1)

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            notation: 'compact',
        }).format(amount)
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Tendencias</CardTitle>
                <CardDescription>Órdenes e ingresos en los últimos 30 días</CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="orders">
                    <TabsList className="mb-4">
                        <TabsTrigger value="orders">Órdenes</TabsTrigger>
                        <TabsTrigger value="revenue">Ingresos</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="orders">
                        {ordersByDay.length === 0 ? (
                            <div className="h-48 flex items-center justify-center text-muted-foreground">
                                No hay datos de órdenes
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {ordersByDay.slice(-10).map((day) => (
                                    <div key={day.date} className="flex items-center gap-3">
                                        <span className="text-xs text-muted-foreground w-16">{day.date}</span>
                                        <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-blue-500 rounded-full transition-all"
                                                style={{ width: `${(day.orders / maxOrders) * 100}%` }}
                                            />
                                        </div>
                                        <span className="text-sm font-medium w-8 text-right">{day.orders}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </TabsContent>
                    
                    <TabsContent value="revenue">
                        {revenueByDay.length === 0 ? (
                            <div className="h-48 flex items-center justify-center text-muted-foreground">
                                No hay datos de ingresos
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {revenueByDay.slice(-10).map((day) => (
                                    <div key={day.date} className="flex items-center gap-3">
                                        <span className="text-xs text-muted-foreground w-16">{day.date}</span>
                                        <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-green-500 rounded-full transition-all"
                                                style={{ width: `${(day.revenue / maxRevenue) * 100}%` }}
                                            />
                                        </div>
                                        <span className="text-sm font-medium w-20 text-right">{formatCurrency(day.revenue)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    )
}
