import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getDashboardStats } from "./dashboard-actions"
import Link from "next/link"
import { DashboardCharts } from "./components/dashboard-charts"

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
    const stats = await getDashboardStats()

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(amount)
    }

    return (
        <DashboardLayout>
            <div className="space-y-8">
                <div>
                    <h1 className="text-3xl font-bold text-text-light-primary dark:text-text-dark-primary">
                        Dashboard
                    </h1>
                    <p className="text-text-light-secondary dark:text-text-dark-secondary mt-2">
                        Bienvenido, aquí tienes un resumen del rendimiento de tu tienda.
                    </p>
                </div>

                {/* KPI Cards */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {/* Revenue */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-text-light-secondary dark:text-text-dark-secondary">
                                Ingresos Totales
                            </CardTitle>
                            <span className="material-symbols-outlined text-text-light-secondary dark:text-text-dark-secondary">
                                payments
                            </span>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(stats.revenue.total)}</div>
                            <div className="flex items-center text-xs mt-1">
                                <span className="text-green-500 font-medium flex items-center">
                                    <span className="material-symbols-outlined text-[16px] mr-1">trending_up</span>
                                    +{stats.revenue.growth}%
                                </span>
                                <span className="text-text-light-secondary dark:text-text-dark-secondary ml-2">
                                    vs mes anterior
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Orders */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-text-light-secondary dark:text-text-dark-secondary">
                                Nuevos Pedidos
                            </CardTitle>
                            <span className="material-symbols-outlined text-text-light-secondary dark:text-text-dark-secondary">
                                shopping_bag
                            </span>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.orders.total}</div>
                            <div className="flex items-center text-xs mt-1">
                                <span className="text-green-500 font-medium flex items-center">
                                    <span className="material-symbols-outlined text--[16px] mr-1">chat</span>
                                    +{stats.orders.growth}%
                                </span>
                                <span className="text-text-light-secondary dark:text-text-dark-secondary ml-2">
                                    crecimiento
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Conversion */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-text-light-secondary dark:text-text-dark-secondary">
                                Conversiones del Chat
                            </CardTitle>
                            <span className="material-symbols-outlined text-text-light-secondary dark:text-text-dark-secondary">
                                swap_horiz
                            </span>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.chats.conversionRate}%</div>
                            <div className="flex items-center text-xs mt-1">
                                <span className="text-red-500 font-medium flex items-center">
                                    <span className="material-symbols-outlined text-[16px] mr-1">trending_down</span>
                                    {stats.chats.growth}%
                                </span>
                                <span className="text-text-light-secondary dark:text-text-dark-secondary ml-2">
                                    vs semana anterior
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Agents */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-text-light-secondary dark:text-text-dark-secondary">
                                Rendimiento Agente
                            </CardTitle>
                            <span className="material-symbols-outlined text-text-light-secondary dark:text-text-dark-secondary">
                                support_agent
                            </span>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.agents.responseTime}</div>
                            <p className="text-xs text-blue-500 mt-1">
                                Tiempo de respuesta prom.
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Charts Section */}
                <DashboardCharts
                    revenueHistory={stats.revenue.history}
                    chatChannels={stats.chats.byChannel}
                    totalChats={stats.chats.total}
                />

                {/* Quick Actions */}
                <div>
                    <h2 className="text-lg font-semibold text-text-light-primary dark:text-text-dark-primary mb-4">
                        Acciones Rápidas
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Link href="/dashboard/products" className="block group">
                            <Card className="h-full border border-border-light dark:border-border-dark hover:border-primary/50 transition-colors">
                                <CardContent className="flex flex-col items-center justify-center p-6 text-center h-full">
                                    <div className="size-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <span className="material-symbols-outlined text-2xl">inventory_2</span>
                                    </div>
                                    <h3 className="font-semibold text-text-light-primary dark:text-text-dark-primary">Gestionar Productos</h3>
                                </CardContent>
                            </Card>
                        </Link>

                        <Link href="/dashboard/orders?status=pending" className="block group">
                            <Card className="h-full border border-border-light dark:border-border-dark hover:border-primary/50 transition-colors">
                                <CardContent className="flex flex-col items-center justify-center p-6 text-center h-full">
                                    <div className="size-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <span className="material-symbols-outlined text-2xl">remove_shopping_cart</span>
                                    </div>
                                    <h3 className="font-semibold text-text-light-primary dark:text-text-dark-primary">Revisar Carritos<br />Abandonados</h3>
                                </CardContent>
                            </Card>
                        </Link>

                        <Link href="/dashboard/agents" className="block group">
                            <Card className="h-full border border-border-light dark:border-border-dark hover:border-primary/50 transition-colors">
                                <CardContent className="flex flex-col items-center justify-center p-6 text-center h-full">
                                    <div className="size-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <span className="material-symbols-outlined text-2xl">smart_toy</span>
                                    </div>
                                    <h3 className="font-semibold text-text-light-primary dark:text-text-dark-primary">Configurar Agentes</h3>
                                </CardContent>
                            </Card>
                        </Link>

                        <Link href="/dashboard/marketing" className="block group">
                            <Card className="h-full border border-border-light dark:border-border-dark hover:border-primary/50 transition-colors">
                                <CardContent className="flex flex-col items-center justify-center p-6 text-center h-full">
                                    <div className="size-12 rounded-xl bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <span className="material-symbols-outlined text-2xl">campaign</span>
                                    </div>
                                    <h3 className="font-semibold text-text-light-primary dark:text-text-dark-primary">Crear Nueva<br />Promoción</h3>
                                </CardContent>
                            </Card>
                        </Link>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}
