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
            organizationName: "Mi Tienda",
            industry: "ecommerce",
            revenue: { total: 0, today: 0, growth: 0, history: [], weeklyHistory: [] },
            orders: { total: 0, growth: 0 },
            chats: { conversionRate: 0, growth: 0, total: 0, byChannel: [] },
            agents: { active: 0, responseTime: "N/A" },
            insights: {
                averageOrderValue: 0,
                pendingOrders: 0,
                newCustomers: 0,
                repeatPurchaseRate: 0,
            },
            recentActivity: [],
            siteStatus: { name: "Mi Tienda", url: "", isLive: false, revenue: 0, visits: 0 },
            agentStatus: { name: "Agente IA", isActive: false, resolutionRate: 0 },
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

    // Hora del día para saludo
    const hour = new Date().getHours()
    const greeting = hour < 12 ? "Buenos días" : hour < 18 ? "Buenas tardes" : "Buenas noches"

    // Formato de trend badge
    const TrendBadge = ({ value, suffix = "%" }: { value: number; suffix?: string }) => (
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${value >= 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
            {value >= 0 ? '+' : ''}{value}{suffix}
        </span>
    )

    // Icono por tipo de actividad
    const activityIcons: Record<string, { icon: string; color: string; bg: string }> = {
        sale: { icon: 'shopping_bag', color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
        conversation: { icon: 'chat', color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30' },
        stock_alert: { icon: 'warning', color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30' },
        payment: { icon: 'payments', color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900/30' },
        escalation: { icon: 'support_agent', color: 'text-slate-600', bg: 'bg-slate-100 dark:bg-slate-800' },
    }

    const weeklyRevenueTotal = stats.revenue.weeklyHistory.reduce((sum, day) => sum + day.value, 0)
    const maxWeeklyRevenueValue = Math.max(...stats.revenue.weeklyHistory.map((day) => day.value), 1)
    const displaySiteUrl = stats.siteStatus.url || (stats.organizationSlug ? `${stats.organizationSlug}.landingchat.co` : "Sin dominio configurado")

    const ecommerceQuickActions = [
        {
            href: "/dashboard/products",
            label: "Gestionar Productos",
            icon: "inventory_2",
            iconBg: "bg-blue-100 dark:bg-blue-900/30",
            iconColor: "text-blue-600 dark:text-blue-400",
        },
        {
            href: "/dashboard/orders",
            label: "Ver Órdenes",
            icon: "receipt_long",
            iconBg: "bg-indigo-100 dark:bg-indigo-900/30",
            iconColor: "text-indigo-600 dark:text-indigo-400",
        },
        {
            href: "/dashboard/agents",
            label: "Configurar Agente",
            icon: "smart_toy",
            iconBg: "bg-purple-100 dark:bg-purple-900/30",
            iconColor: "text-purple-600 dark:text-purple-400",
        },
        {
            href: "/dashboard/marketing",
            label: "Crear Promoción",
            icon: "campaign",
            iconBg: "bg-pink-100 dark:bg-pink-900/30",
            iconColor: "text-pink-600 dark:text-pink-400",
        },
    ]

    return (
        <DashboardLayout>
            <div className="space-y-6">
                {/* Header operativo */}
                {isRealEstate ? (
                    <div>
                        <h1 className="text-2xl font-bold text-text-light-primary dark:text-text-dark-primary">
                            {greeting}, {stats.userName} ✦
                        </h1>
                        <p className="text-text-light-secondary dark:text-text-dark-secondary mt-1">
                            {stats.revenue.today > 0
                                ? `Tu tienda generó ${formatCurrency(stats.revenue.today)} hoy.`
                                : "Aquí tienes un resumen de tu negocio."
                            }
                            {stats.agentStatus.isActive && ` El agente resolvió ${stats.agentStatus.resolutionRate}% de consultas solo.`}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold tracking-tight text-text-light-primary dark:text-text-dark-primary">
                            {greeting}, {stats.userName} ✦
                        </h1>
                        <p className="max-w-3xl text-sm leading-6 text-text-light-secondary dark:text-text-dark-secondary sm:text-base">
                            {stats.revenue.today > 0 ? (
                                <>
                                    Tu tienda generó{" "}
                                    <span className="font-semibold text-primary">
                                        {formatCurrency(stats.revenue.today)}
                                    </span>{" "}
                                    hoy.
                                </>
                            ) : (
                                <>Aquí tienes un resumen operativo de tu negocio.</>
                            )}
                            {stats.agentStatus.isActive && (
                                <>
                                    {" "}El agente resolvió{" "}
                                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                        {stats.agentStatus.resolutionRate}%
                                    </span>{" "}
                                    de consultas solo.
                                </>
                            )}
                        </p>
                    </div>
                )}

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
                            <Card className="overflow-hidden border-border-light/80 shadow-sm dark:border-border-dark/80">
                                <CardContent className="flex h-full flex-col justify-between p-5">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-lg">payments</span>
                                        </div>
                                        <TrendBadge value={stats.revenue.growth} />
                                    </div>
                                    <div className="mt-6 space-y-1">
                                        <p className="text-2xl font-bold tracking-tight text-text-light-primary dark:text-text-dark-primary">
                                            {formatCurrency(stats.revenue.today)}
                                        </p>
                                        <p className="text-xs font-medium text-text-light-secondary dark:text-text-dark-secondary">
                                            Revenue Today
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            <VisitorsCard organizationSlug={stats.organizationSlug} />

                            <Card className="overflow-hidden border-border-light/80 shadow-sm dark:border-border-dark/80">
                                <CardContent className="flex h-full flex-col justify-between p-5">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-lg">chat</span>
                                        </div>
                                        <TrendBadge value={stats.chats.growth} />
                                    </div>
                                    <div className="mt-6 space-y-1">
                                        <p className="text-2xl font-bold tracking-tight text-text-light-primary dark:text-text-dark-primary">
                                            {stats.chats.total}
                                        </p>
                                        <p className="text-xs font-medium text-text-light-secondary dark:text-text-dark-secondary">
                                            Conversaciones
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="overflow-hidden border-border-light/80 shadow-sm dark:border-border-dark/80">
                                <CardContent className="flex h-full flex-col justify-between p-5">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-indigo-600 dark:text-indigo-400 text-lg">trending_up</span>
                                        </div>
                                        <TrendBadge value={stats.chats.conversionRate} />
                                    </div>
                                    <div className="mt-6 space-y-1">
                                        <p className="text-2xl font-bold tracking-tight text-text-light-primary dark:text-text-dark-primary">
                                            {stats.chats.conversionRate}%
                                        </p>
                                        <p className="text-xs font-medium text-text-light-secondary dark:text-text-dark-secondary">
                                            Conv. Rate
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    )}
                </div>

                {/* Insight Widgets */}
                {isRealEstate && re && (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                    </div>
                )}

                {/* Charts + Activity Section */}
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
                    <div className="grid gap-6 lg:grid-cols-5">
                        {/* Ingresos esta semana — 3 columnas */}
                        <Card className="overflow-hidden border-border-light/80 shadow-sm dark:border-border-dark/80 lg:col-span-3">
                            <CardHeader className="flex flex-col gap-4 pb-0 md:flex-row md:items-start md:justify-between">
                                <div>
                                    <CardTitle className="text-base font-semibold">Ingresos esta semana</CardTitle>
                                    <p className="text-xs font-medium text-text-light-secondary dark:text-text-dark-secondary">Todos los canales</p>
                                </div>
                                <div className="flex items-center gap-3 self-start">
                                    <span className="text-xl font-bold tracking-tight">
                                        {formatCurrency(weeklyRevenueTotal)}
                                    </span>
                                    <TrendBadge value={stats.revenue.growth} />
                                </div>
                            </CardHeader>
                            <CardContent className="pt-5">
                                {stats.revenue.weeklyHistory.length > 0 ? (
                                    <div className="flex h-44 items-end gap-3">
                                        {stats.revenue.weeklyHistory.map((day, i) => {
                                            const height = day.value > 0
                                                ? Math.max((day.value / maxWeeklyRevenueValue) * 100, 14)
                                                : 8

                                            return (
                                                <div key={i} className="flex flex-1 flex-col items-center gap-3">
                                                    <div className="flex h-36 w-full max-w-[64px] items-end rounded-2xl bg-background-light px-1.5 pb-1.5 dark:bg-background-dark">
                                                        <div
                                                            className="w-full rounded-xl bg-primary/85"
                                                            style={{ height: `${height}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[10px] font-medium text-text-light-secondary dark:text-text-dark-secondary">
                                                        {day.day}
                                                    </span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <div className="flex h-44 items-center justify-center rounded-2xl bg-background-light text-sm text-text-light-secondary dark:bg-background-dark dark:text-text-dark-secondary">
                                        Sin ingresos registrados esta semana
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Actividad Reciente — 2 columnas */}
                        <Card className="overflow-hidden border-border-light/80 shadow-sm dark:border-border-dark/80 lg:col-span-2">
                            <CardHeader className="flex flex-row items-center justify-between pb-1">
                                <CardTitle className="text-base font-semibold">Actividad Reciente</CardTitle>
                                <Link href="/dashboard/orders" className="text-xs font-medium text-text-light-secondary transition-colors hover:text-primary dark:text-text-dark-secondary">
                                    Ver todo
                                </Link>
                            </CardHeader>
                            <CardContent className="pt-4">
                                <div className="space-y-2">
                                    {stats.recentActivity.length > 0 ? stats.recentActivity.map((activity, i) => {
                                        const iconData = activityIcons[activity.type] || activityIcons.sale
                                        const activityAmount = typeof activity.amount === "number" ? activity.amount : null
                                        const amountClassName = activity.type === 'sale' || activity.type === 'payment'
                                            ? 'text-emerald-600 dark:text-emerald-400'
                                            : 'text-text-light-primary dark:text-text-dark-primary'

                                        return (
                                            <div
                                                key={i}
                                                className="flex items-center gap-3 rounded-2xl border border-transparent px-1 py-2 transition-colors hover:border-border-light hover:bg-background-light/60 dark:hover:border-border-dark dark:hover:bg-background-dark/60"
                                            >
                                                <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${iconData.bg}`}>
                                                    <span className={`material-symbols-outlined text-sm ${iconData.color}`}>{iconData.icon}</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="truncate text-sm font-medium text-text-light-primary dark:text-text-dark-primary">
                                                        {activity.title}
                                                    </p>
                                                    <p className="truncate text-xs text-text-light-secondary dark:text-text-dark-secondary">
                                                        {activity.description} · {activity.timeAgo}
                                                    </p>
                                                </div>
                                                {activityAmount !== null ? (
                                                    <span className={`flex-shrink-0 text-sm font-bold ${amountClassName}`}>
                                                        {activityAmount > 0 ? '+' : ''}{formatCurrency(activityAmount)}
                                                    </span>
                                                ) : (
                                                    <span className="material-symbols-outlined text-base text-text-light-secondary dark:text-text-dark-secondary">
                                                        chevron_right
                                                    </span>
                                                )}
                                            </div>
                                        )
                                    }) : (
                                        <div className="flex h-44 items-center justify-center rounded-2xl bg-background-light text-sm text-text-light-secondary dark:bg-background-dark dark:text-text-dark-secondary">
                                            Sin actividad reciente
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Tu Sitio */}
                {!isRealEstate && (
                    <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
                        <Card className="overflow-hidden border-border-light/80 shadow-sm dark:border-border-dark/80">
                            <CardHeader className="flex flex-col gap-3 pb-0 sm:flex-row sm:items-center sm:justify-between">
                                <CardTitle className="text-base font-semibold">Tu Sitio</CardTitle>
                                <Link href="/dashboard/storefront" className="inline-flex items-center gap-1 text-sm font-medium text-text-light-secondary transition-colors hover:text-primary dark:text-text-dark-secondary">
                                    Gestionar
                                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                                </Link>
                            </CardHeader>
                            <CardContent className="pt-5">
                                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                                            <span className="material-symbols-outlined text-primary">storefront</span>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="font-semibold text-text-light-primary dark:text-text-dark-primary">
                                                    {stats.siteStatus.name}
                                                </p>
                                                {stats.siteStatus.isLive && (
                                                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                        Live
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary">
                                                {displaySiteUrl}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="rounded-2xl bg-background-light px-4 py-3 dark:bg-background-dark">
                                        <p className="text-xs font-medium text-text-light-secondary dark:text-text-dark-secondary">
                                            Revenue total
                                        </p>
                                        <p className="mt-1 text-lg font-bold tracking-tight text-text-light-primary dark:text-text-dark-primary">
                                            {formatCurrency(stats.siteStatus.revenue)}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl bg-background-light px-4 py-3 dark:bg-background-dark">
                                        <p className="text-xs font-medium text-text-light-secondary dark:text-text-dark-secondary">
                                            Visitas
                                        </p>
                                        <p className="mt-1 text-lg font-bold tracking-tight text-text-light-primary dark:text-text-dark-primary">
                                            {stats.siteStatus.visits}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {!isRealEstate && (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                    </div>
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
                                {ecommerceQuickActions.map((action) => (
                                    <Link key={action.href} href={action.href} className="block group">
                                        <Card className="h-full border border-border-light shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md dark:border-border-dark">
                                            <CardContent className="flex items-center justify-between gap-4 p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`flex size-11 items-center justify-center rounded-xl ${action.iconBg} ${action.iconColor}`}>
                                                        <span className="material-symbols-outlined text-xl">{action.icon}</span>
                                                    </div>
                                                    <h3 className="text-sm font-semibold text-text-light-primary dark:text-text-dark-primary">
                                                        {action.label}
                                                    </h3>
                                                </div>
                                                <span className="material-symbols-outlined text-lg text-text-light-secondary transition-transform group-hover:translate-x-0.5 dark:text-text-dark-secondary">
                                                    arrow_forward
                                                </span>
                                            </CardContent>
                                        </Card>
                                    </Link>
                                ))}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}
