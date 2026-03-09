import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getDashboardStats } from "./dashboard-actions"
import Link from "next/link"
import { redirect } from "next/navigation"
import { DashboardCharts } from "./components/dashboard-charts"
import { VisitorsCard } from "./components/visitors-card"
import { StatWidget } from "./components/stat-widget"

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
    let stats
    try {
        stats = await getDashboardStats()
    } catch (error) {
        console.error("[DashboardPage] Error loading stats:", error)
        // Si es error de autenticación, redirigir a login
        if (error instanceof Error && (error.message.includes("Unauthorized") || error.message.includes("autenticación"))) {
            redirect("/login")
        }
        // Para otros errores, usar datos por defecto
        stats = {
            userName: "Usuario",
            organizationSlug: "",
            industry: "ecommerce",
            revenue: { total: 0, growth: 0, history: [] },
            orders: { total: 0, growth: 0 },
            chats: { conversionRate: 0, growth: 0, total: 0, byChannel: [] },
            agents: { active: 0, responseTime: "N/A" },
            insights: {
                averageOrderValue: 0,
                pendingOrders: 0,
                newCustomers: 0,
                repeatPurchaseRate: 0,
            },
        }
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount)
    }

    const isRealEstate = stats.industry === "real_estate" && !!stats.realEstate
    const re = stats.realEstate

    return (
        <DashboardLayout>
            <div className="space-y-8">
                <div>
                    <h1 className="text-3xl font-bold text-text-light-primary dark:text-text-dark-primary">
                        Dashboard
                    </h1>
                    <p className="text-text-light-secondary dark:text-text-dark-secondary mt-2">
                        Bienvenido, {stats.userName}. {isRealEstate ? "Aquí tienes un resumen de tu operación inmobiliaria." : "Aquí tienes un resumen del rendimiento de tu tienda."}
                    </p>
                </div>

                {/* KPI Cards */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {isRealEstate && re ? (
                        <>
                            {/* Propiedades Activas */}
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium text-text-light-secondary dark:text-text-dark-secondary">Propiedades Activas</CardTitle>
                                    <span className="material-symbols-outlined text-text-light-secondary dark:text-text-dark-secondary">apartment</span>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{re.activeProperties}</div>
                                    <p className="text-xs text-blue-500 mt-1">Publicadas en tu catálogo</p>
                                </CardContent>
                            </Card>

                            {/* Leads Nuevos */}
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium text-text-light-secondary dark:text-text-dark-secondary">Leads Nuevos</CardTitle>
                                    <span className="material-symbols-outlined text-green-500">person_add</span>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{re.newLeads}</div>
                                    <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary mt-1">Últimos 30 días</p>
                                </CardContent>
                            </Card>

                            {/* Citas Agendadas */}
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium text-text-light-secondary dark:text-text-dark-secondary">Citas Agendadas</CardTitle>
                                    <span className="material-symbols-outlined text-purple-500">calendar_month</span>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{re.appointmentsScheduled}</div>
                                    <div className="flex items-center gap-2 text-xs mt-1">
                                        <span className="text-amber-500">{re.appointmentsPending} pendientes</span>
                                        <span className="text-green-500">{re.appointmentsCompleted} completadas</span>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Rendimiento Agente */}
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium text-text-light-secondary dark:text-text-dark-secondary">Rendimiento Agente</CardTitle>
                                    <span className="material-symbols-outlined text-text-light-secondary dark:text-text-dark-secondary">support_agent</span>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{stats.agents.responseTime}</div>
                                    <p className="text-xs text-blue-500 mt-1">Tiempo de respuesta prom.</p>
                                </CardContent>
                            </Card>
                        </>
                    ) : (
                        <>
                            {/* Revenue */}
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium text-text-light-secondary dark:text-text-dark-secondary">Ingresos Totales</CardTitle>
                                    <span className="material-symbols-outlined text-text-light-secondary dark:text-text-dark-secondary">payments</span>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{formatCurrency(stats.revenue.total)}</div>
                                    <div className="flex items-center text-xs mt-1">
                                        <span className={`${stats.revenue.growth >= 0 ? 'text-green-500' : 'text-red-500'} font-medium flex items-center`}>
                                            <span className="material-symbols-outlined text-[16px] mr-1">{stats.revenue.growth >= 0 ? 'trending_up' : 'trending_down'}</span>
                                            {stats.revenue.growth >= 0 ? '+' : ''}{stats.revenue.growth}%
                                        </span>
                                        <span className="text-text-light-secondary dark:text-text-dark-secondary ml-2">vs mes anterior</span>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Visitors */}
                            <VisitorsCard organizationSlug={stats.organizationSlug} />

                            {/* Conversion */}
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium text-text-light-secondary dark:text-text-dark-secondary">Conversiones del Chat</CardTitle>
                                    <span className="material-symbols-outlined text-text-light-secondary dark:text-text-dark-secondary">swap_horiz</span>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{stats.chats.conversionRate}%</div>
                                    <div className="flex items-center text-xs mt-1">
                                        <span className={`${stats.chats.growth >= 0 ? 'text-green-500' : 'text-red-500'} font-medium flex items-center`}>
                                            <span className="material-symbols-outlined text-[16px] mr-1">{stats.chats.growth >= 0 ? 'trending_up' : 'trending_down'}</span>
                                            {stats.chats.growth >= 0 ? '+' : ''}{stats.chats.growth}%
                                        </span>
                                        <span className="text-text-light-secondary dark:text-text-dark-secondary ml-2">vs semana anterior</span>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Agents */}
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium text-text-light-secondary dark:text-text-dark-secondary">Rendimiento Agente</CardTitle>
                                    <span className="material-symbols-outlined text-text-light-secondary dark:text-text-dark-secondary">support_agent</span>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{stats.agents.responseTime}</div>
                                    <p className="text-xs text-blue-500 mt-1">Tiempo de respuesta prom.</p>
                                </CardContent>
                            </Card>
                        </>
                    )}
                </div>

                {/* Insight Widgets */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {isRealEstate && re ? (
                        <>
                            <StatWidget
                                title="Conversión Chat → Lead"
                                value={`${re.chatToLeadRate}%`}
                                helper="Chats que generaron un lead"
                                icon="person_search"
                                trendDirection={re.chatToLeadRate >= 20 ? "up" : "neutral"}
                                trendLabel={re.chatToLeadRate >= 20 ? "Buen ritmo" : "Oportunidad"}
                            />
                            <StatWidget
                                title="Conversión Chat → Cita"
                                value={`${re.chatToAppointmentRate}%`}
                                helper="Chats que agendaron visita"
                                icon="event_available"
                                trendDirection={re.chatToAppointmentRate >= 10 ? "up" : "neutral"}
                                trendLabel={re.chatToAppointmentRate >= 10 ? "Buen ritmo" : "Oportunidad"}
                            />
                            <StatWidget
                                title="Conversaciones"
                                value={stats.chats.total.toString()}
                                helper="Chats totales últimos 30 días"
                                icon="chat"
                                trendDirection="neutral"
                            />
                            <StatWidget
                                title="Citas Pendientes"
                                value={re.appointmentsPending.toString()}
                                helper="Por confirmar o realizar"
                                icon="pending_actions"
                                accentColor="text-amber-500"
                            />
                        </>
                    ) : (
                        <>
                            <StatWidget
                                title="Ticket Promedio"
                                value={formatCurrency(stats.insights.averageOrderValue)}
                                helper="Promedio de orden en los últimos 30 días"
                                icon="shoppingmode"
                                trendLabel={stats.revenue.growth ? `${stats.revenue.growth}%` : undefined}
                                trendDirection={stats.revenue.growth >= 0 ? "up" : "down"}
                            />
                            <StatWidget
                                title="Órdenes pendientes"
                                value={stats.insights.pendingOrders.toString()}
                                helper="Pendientes por gestión"
                                icon="pending_actions"
                                accentColor="text-amber-500"
                            />
                            <StatWidget
                                title="Clientes nuevos"
                                value={stats.insights.newCustomers.toString()}
                                helper="En los últimos 30 días"
                                icon="group_add"
                                trendLabel="Nuevas cuentas"
                                trendDirection="neutral"
                            />
                            <StatWidget
                                title="Repeat Purchase"
                                value={`${stats.insights.repeatPurchaseRate}%`}
                                helper="Clientes que compraron 2+ veces"
                                icon="loyalty"
                                trendDirection={stats.insights.repeatPurchaseRate >= 30 ? "up" : "neutral"}
                                trendLabel={stats.insights.repeatPurchaseRate >= 30 ? "Saludable" : "Oportunidad"}
                            />
                        </>
                    )}
                </div>

                {/* Charts Section */}
                {isRealEstate && re ? (
                    <div className="grid gap-6 lg:grid-cols-2">
                        {/* Leads por Canal */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Leads por Canal</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {re.leadsByChannel.map(ch => (
                                        <div key={ch.name} className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ch.color }} />
                                                <span className="text-sm font-medium">{ch.name}</span>
                                            </div>
                                            <span className="text-sm font-bold">{ch.value}</span>
                                        </div>
                                    ))}
                                    {re.leadsByChannel.every(ch => ch.value === 0) && (
                                        <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary text-center py-4">Sin leads este mes</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Zonas más buscadas */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Zonas con más propiedades</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {re.topZones.map((z, i) => (
                                        <div key={z.zone} className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-text-light-secondary dark:text-text-dark-secondary w-5">{i + 1}.</span>
                                                <span className="text-sm">{z.zone}</span>
                                            </div>
                                            <span className="text-sm font-bold">{z.count}</span>
                                        </div>
                                    ))}
                                    {re.topZones.length === 0 && (
                                        <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary text-center py-4">Sin datos de zonas</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                ) : (
                    <DashboardCharts
                        revenueHistory={stats.revenue.history}
                        chatChannels={stats.chats.byChannel}
                        totalChats={stats.chats.total}
                    />
                )}

                {/* Quick Actions */}
                <div>
                    <h2 className="text-lg font-semibold text-text-light-primary dark:text-text-dark-primary mb-4">
                        Acciones Rápidas
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {isRealEstate ? (
                            <>
                                <Link href="/dashboard/properties" className="block group">
                                    <Card className="h-full border border-border-light dark:border-border-dark hover:border-primary/50 transition-colors">
                                        <CardContent className="flex flex-col items-center justify-center p-6 text-center h-full">
                                            <div className="size-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                                <span className="material-symbols-outlined text-2xl">apartment</span>
                                            </div>
                                            <h3 className="font-semibold text-text-light-primary dark:text-text-dark-primary">Ver Propiedades</h3>
                                        </CardContent>
                                    </Card>
                                </Link>

                                <Link href="/dashboard/leads" className="block group">
                                    <Card className="h-full border border-border-light dark:border-border-dark hover:border-primary/50 transition-colors">
                                        <CardContent className="flex flex-col items-center justify-center p-6 text-center h-full">
                                            <div className="size-12 rounded-xl bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                                <span className="material-symbols-outlined text-2xl">person_add</span>
                                            </div>
                                            <h3 className="font-semibold text-text-light-primary dark:text-text-dark-primary">Gestionar Leads</h3>
                                        </CardContent>
                                    </Card>
                                </Link>

                                <Link href="/dashboard/appointments" className="block group">
                                    <Card className="h-full border border-border-light dark:border-border-dark hover:border-primary/50 transition-colors">
                                        <CardContent className="flex flex-col items-center justify-center p-6 text-center h-full">
                                            <div className="size-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                                <span className="material-symbols-outlined text-2xl">calendar_month</span>
                                            </div>
                                            <h3 className="font-semibold text-text-light-primary dark:text-text-dark-primary">Ver Citas</h3>
                                        </CardContent>
                                    </Card>
                                </Link>

                                <Link href="/dashboard/agents" className="block group">
                                    <Card className="h-full border border-border-light dark:border-border-dark hover:border-primary/50 transition-colors">
                                        <CardContent className="flex flex-col items-center justify-center p-6 text-center h-full">
                                            <div className="size-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                                <span className="material-symbols-outlined text-2xl">smart_toy</span>
                                            </div>
                                            <h3 className="font-semibold text-text-light-primary dark:text-text-dark-primary">Configurar Agente</h3>
                                        </CardContent>
                                    </Card>
                                </Link>
                            </>
                        ) : (
                            <>
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
                            </>
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}
