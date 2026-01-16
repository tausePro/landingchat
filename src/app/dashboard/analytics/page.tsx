import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { AnalyticsCharts } from "./components/analytics-charts"
import { TrafficSources } from "./components/traffic-sources"
import { ConversionFunnel } from "./components/conversion-funnel"
import { SalesSources } from "./components/sales-sources"
import { MetaAdsCard } from "./components/meta-ads-card"

export const dynamic = 'force-dynamic'

async function getAnalyticsData() {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
        redirect("/login")
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) {
        redirect("/onboarding")
    }

    const orgId = profile.organization_id

    // Get orders data for conversion metrics
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Filtrar por status válidos (mismo criterio que dashboard-actions.ts)
    const validStatuses = ["pending", "confirmed", "processing", "shipped", "delivered", "completed"]

    // Fetch org, orders, and chats in parallel (async-parallel optimization)
    const [orgResult, ordersResult, chatsResult] = await Promise.all([
        supabase
            .from("organizations")
            .select("id, name, slug, tracking_config")
            .eq("id", orgId)
            .single(),
        supabase
            .from("orders")
            .select("id, total, created_at, status, payment_status, source_channel, chat_id, utm_data")
            .eq("organization_id", orgId)
            .in("status", validStatuses)
            .gte("created_at", thirtyDaysAgo.toISOString())
            .order("created_at", { ascending: true }),
        supabase
            .from("chats")
            .select("id, created_at, channel")
            .eq("organization_id", orgId)
            .gte("created_at", thirtyDaysAgo.toISOString())
    ])

    const org = orgResult.data
    const orders = ordersResult.data
    const chats = chatsResult.data

    if (!org) {
        redirect("/onboarding")
    }

    // Calculate metrics (misma lógica que dashboard-actions.ts)
    const totalOrders = orders?.length || 0
    const totalRevenue = orders?.reduce((sum, o) => sum + (o.total || 0), 0) || 0
    const totalChats = chats?.length || 0
    // Conversión = órdenes / chats (no solo pagadas, igual que dashboard)
    const conversionRate = totalChats > 0 ? ((totalOrders / totalChats) * 100).toFixed(1) : "0"

    // Group orders by day for chart
    const ordersByDay = orders?.reduce((acc, order) => {
        const date = new Date(order.created_at).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })
        acc[date] = (acc[date] || 0) + 1
        return acc
    }, {} as Record<string, number>) || {}

    const revenueByDay = orders?.reduce((acc, order) => {
        const date = new Date(order.created_at).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })
        acc[date] = (acc[date] || 0) + (order.total || 0)
        return acc
    }, {} as Record<string, number>) || {}

    // Chat channels breakdown
    const chatsByChannel = chats?.reduce((acc, chat) => {
        const channel = chat.channel || 'web'
        acc[channel] = (acc[channel] || 0) + 1
        return acc
    }, {} as Record<string, number>) || {}

    // Origen de ventas real (basado en source_channel y utm_data)
    const ordersBySource = orders?.reduce((acc, order) => {
        let source = 'direct' // Por defecto: venta directa

        if (order.source_channel === 'chat' || order.chat_id) {
            source = 'chat'
        } else if (order.utm_data && typeof order.utm_data === 'object') {
            const utmData = order.utm_data as Record<string, unknown>
            const utmSource = (utmData.utm_source as string)?.toLowerCase() || ''
            if (utmSource.includes('facebook') || utmSource.includes('instagram') || utmSource.includes('meta') || utmSource.includes('fb') || utmSource.includes('ig')) {
                source = 'meta_ads'
            } else if (utmSource.includes('google')) {
                source = 'google_ads'
            } else if (utmSource) {
                source = 'campaign'
            }
        } else if (order.source_channel === 'whatsapp') {
            source = 'whatsapp'
        }

        acc[source] = (acc[source] || 0) + 1
        return acc
    }, {} as Record<string, number>) || {}

    // Órdenes que realmente vinieron del chat
    const ordersFromChat = orders?.filter(o => o.source_channel === 'chat' || o.chat_id)?.length || 0

    // Conversión real del chat (solo órdenes que vinieron del chat / total chats)
    const chatConversionRate = totalChats > 0 ? ((ordersFromChat / totalChats) * 100).toFixed(1) : "0"

    return {
        organization: org,
        metrics: {
            totalOrders,
            totalRevenue,
            totalChats,
            conversionRate,
            averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
            ordersFromChat,
            chatConversionRate,
        },
        charts: {
            ordersByDay: Object.entries(ordersByDay).map(([date, count]) => ({ date, orders: count })),
            revenueByDay: Object.entries(revenueByDay).map(([date, revenue]) => ({ date, revenue })),
        },
        chatsByChannel,
        ordersBySource,
        trackingEnabled: {
            posthog: Boolean(org.tracking_config?.posthog_enabled),
            metaPixel: Boolean(org.tracking_config?.meta_pixel_id),
            metaCapi: Boolean(org.tracking_config?.meta_access_token),
        }
    }
}

export default async function AnalyticsPage() {
    const data = await getAnalyticsData()

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
        }).format(amount)
    }

    return (
        <DashboardLayout>
            <div className="space-y-8">
                <div>
                    <h1 className="text-3xl font-bold text-text-light-primary dark:text-text-dark-primary">
                        Analytics
                    </h1>
                    <p className="text-text-light-secondary dark:text-text-dark-secondary mt-2">
                        Métricas de rendimiento de tu tienda en los últimos 30 días
                    </p>
                </div>

                {/* Tracking Status */}
                <div className="flex gap-2 flex-wrap">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${data.trackingEnabled.posthog
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        }`}>
                        <span className={`w-2 h-2 rounded-full mr-2 ${data.trackingEnabled.posthog ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                        PostHog {data.trackingEnabled.posthog ? 'Activo' : 'Inactivo'}
                    </span>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${data.trackingEnabled.metaPixel
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        }`}>
                        <span className={`w-2 h-2 rounded-full mr-2 ${data.trackingEnabled.metaPixel ? 'bg-blue-500' : 'bg-gray-400'}`}></span>
                        Meta Pixel {data.trackingEnabled.metaPixel ? 'Activo' : 'Inactivo'}
                    </span>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${data.trackingEnabled.metaCapi
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        }`}>
                        <span className={`w-2 h-2 rounded-full mr-2 ${data.trackingEnabled.metaCapi ? 'bg-purple-500' : 'bg-gray-400'}`}></span>
                        Meta CAPI {data.trackingEnabled.metaCapi ? 'Activo' : 'Inactivo'}
                    </span>
                </div>

                {/* KPI Cards */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Ingresos (30d)</CardTitle>
                            <span className="material-symbols-outlined text-green-500">payments</span>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(data.metrics.totalRevenue)}</div>
                            <p className="text-xs text-muted-foreground">
                                {data.metrics.totalOrders} órdenes
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Conversaciones</CardTitle>
                            <span className="material-symbols-outlined text-blue-500">chat</span>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{data.metrics.totalChats}</div>
                            <p className="text-xs text-muted-foreground">
                                Chats iniciados
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Tasa de Conversión</CardTitle>
                            <span className="material-symbols-outlined text-purple-500">trending_up</span>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{data.metrics.conversionRate}%</div>
                            <p className="text-xs text-muted-foreground">
                                Chat → Compra
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Ticket Promedio</CardTitle>
                            <span className="material-symbols-outlined text-orange-500">shopping_cart</span>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(data.metrics.averageOrderValue)}</div>
                            <p className="text-xs text-muted-foreground">
                                Por orden
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Charts */}
                <div className="grid gap-6 lg:grid-cols-2">
                    <AnalyticsCharts
                        ordersByDay={data.charts.ordersByDay}
                        revenueByDay={data.charts.revenueByDay}
                    />
                    <TrafficSources chatsByChannel={data.chatsByChannel} />
                </div>

                {/* Conversion Funnel + Sales Sources */}
                <div className="grid gap-6 lg:grid-cols-2">
                    <ConversionFunnel
                        totalChats={data.metrics.totalChats}
                        ordersFromChat={data.metrics.ordersFromChat}
                        chatConversionRate={data.metrics.chatConversionRate}
                    />
                    <SalesSources
                        ordersBySource={data.ordersBySource}
                        totalOrders={data.metrics.totalOrders}
                    />
                </div>

                {/* Meta Ads */}
                <MetaAdsCard />
            </div>
        </DashboardLayout>
    )
}
