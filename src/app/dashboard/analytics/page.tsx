import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { AnalyticsCharts } from "./components/analytics-charts"
import { TrafficSources } from "./components/traffic-sources"
import { ConversionFunnel } from "./components/conversion-funnel"
import { SalesSources } from "./components/sales-sources"
import { MetaAdsCard } from "./components/meta-ads-card"
import { TopProductsCard } from "./components/top-products-card"
import { RevenueByChannelCard } from "./components/revenue-by-channel-card"
import { AiPerformanceCard } from "./components/ai-performance-card"

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

    // Fetch org, orders, chats, and products in parallel
    // Messages se fetchean después en batches (necesitan chatIds primero)
    const [orgResult, ordersResult, chatsResult, productsResult] = await Promise.all([
        supabase
            .from("organizations")
            .select("id, name, slug, tracking_config")
            .eq("id", orgId)
            .single(),
        supabase
            .from("orders")
            .select("id, total, created_at, status, payment_status, source_channel, chat_id, utm_data, items")
            .eq("organization_id", orgId)
            .in("status", validStatuses)
            .gte("created_at", thirtyDaysAgo.toISOString())
            .order("created_at", { ascending: true }),
        supabase
            .from("chats")
            .select("id, created_at, channel")
            .eq("organization_id", orgId)
            .gte("created_at", thirtyDaysAgo.toISOString()),
        supabase
            .from("products")
            .select("id, name, stock, image_url, is_active")
            .eq("organization_id", orgId)
            .eq("is_active", true),
    ])

    const org = orgResult.data
    const orders = ordersResult.data
    const chats = chatsResult.data
    const products = productsResult.data

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

    // ============================================================
    // Top Products (de items JSONB en orders)
    // ============================================================
    const productStats: Record<string, { productName: string; totalRevenue: number; totalUnits: number }> = {}
    orders?.forEach(order => {
        const items = order.items as Array<{
            product_id?: string
            product_name?: string
            name?: string
            total_price?: number
            price?: number
            quantity?: number
        }> | null
        items?.forEach(item => {
            const pid = item.product_id || 'unknown'
            const name = item.product_name || item.name || 'Producto'
            const revenue = item.total_price || (item.price || 0) * (item.quantity || 1)
            if (!productStats[pid]) {
                productStats[pid] = { productName: name, totalRevenue: 0, totalUnits: 0 }
            }
            productStats[pid].totalRevenue += revenue
            productStats[pid].totalUnits += item.quantity || 1
        })
    })
    const topProducts = Object.entries(productStats)
        .map(([productId, stats]) => ({ productId, ...stats }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 5)

    // Productos con stock bajo (<=5 unidades)
    const lowStockProducts = (products || [])
        .filter(p => p.stock <= 5)
        .sort((a, b) => a.stock - b.stock)
        .map(p => ({ id: p.id, name: p.name, stock: p.stock, imageUrl: p.image_url }))

    // ============================================================
    // Revenue por canal (no solo conteo, sino $ por fuente)
    // ============================================================
    const revenueBySource: Record<string, { revenue: number; orders: number }> = {}
    orders?.forEach(order => {
        let source = 'direct'
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
        if (!revenueBySource[source]) {
            revenueBySource[source] = { revenue: 0, orders: 0 }
        }
        revenueBySource[source].revenue += order.total || 0
        revenueBySource[source].orders += 1
    })

    // ============================================================
    // AI Performance: mensajes por chat (query adicional)
    // ============================================================
    const chatIds = chats?.map(c => c.id) || []
    let messagesData: Array<{ chat_id: string; sender_type: string; metadata: Record<string, unknown> | null }> = []
    if (chatIds.length > 0) {
        // Fetch messages en batches si hay muchos chats
        const batchSize = 100
        for (let i = 0; i < chatIds.length; i += batchSize) {
            const batch = chatIds.slice(i, i + batchSize)
            const { data } = await supabase
                .from("messages")
                .select("chat_id, sender_type, metadata")
                .in("chat_id", batch)
            if (data) messagesData = messagesData.concat(data)
        }
    }

    const totalMessages = messagesData.length
    // sender_type reales: "user" (cliente), "bot" (agente AI), "agent" (humano desde dashboard)
    const messagesByType = {
        user: messagesData.filter(m => m.sender_type === 'user' || m.sender_type === 'customer').length,
        assistant: messagesData.filter(m => m.sender_type === 'bot' || m.sender_type === 'agent').length,
        tool: 0, // Se calcula abajo desde metadata.tools_used
    }
    const avgMessagesPerChat = totalChats > 0 ? Math.round(totalMessages / totalChats) : 0

    // Chats que generaron orden
    const chatIdsWithOrder = new Set(orders?.filter(o => o.chat_id).map(o => o.chat_id) || [])
    const chatsWithOrder = chatIdsWithOrder.size

    // Top herramientas usadas (extraer de metadata.tools_used en mensajes del bot)
    const toolCounts: Record<string, number> = {}
    let totalToolCalls = 0
    messagesData.forEach(m => {
        if (m.sender_type === 'bot' && m.metadata) {
            const toolsUsed = m.metadata.tools_used as string[] | undefined
            if (toolsUsed && Array.isArray(toolsUsed)) {
                toolsUsed.forEach(tool => {
                    toolCounts[tool] = (toolCounts[tool] || 0) + 1
                    totalToolCalls++
                })
            }
        }
    })
    messagesByType.tool = totalToolCalls
    const topTools = Object.entries(toolCounts)
        .map(([tool, count]) => ({ tool, count }))
        .sort((a, b) => b.count - a.count)

    // Conversión por canal
    const webChats = chats?.filter(c => !c.channel || c.channel === 'web') || []
    const waChats = chats?.filter(c => c.channel === 'whatsapp') || []
    const webChatIds = new Set(webChats.map(c => c.id))
    const waChatIds = new Set(waChats.map(c => c.id))
    const webOrders = orders?.filter(o => o.chat_id && webChatIds.has(o.chat_id)).length || 0
    const waOrders = orders?.filter(o => o.chat_id && waChatIds.has(o.chat_id)).length || 0

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
        },
        topProducts,
        lowStockProducts,
        revenueBySource,
        aiPerformance: {
            totalChats,
            chatsWithOrder,
            chatConversionRate,
            totalMessages,
            avgMessagesPerChat,
            messagesByType,
            topTools,
            channelBreakdown: {
                web: { chats: webChats.length, orders: webOrders },
                whatsapp: { chats: waChats.length, orders: waOrders },
            },
        },
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

                {/* Top Products + Revenue by Channel */}
                <div className="grid gap-6 lg:grid-cols-2">
                    <TopProductsCard
                        topProducts={data.topProducts}
                        lowStockProducts={data.lowStockProducts}
                    />
                    <RevenueByChannelCard
                        revenueBySource={data.revenueBySource}
                        totalRevenue={data.metrics.totalRevenue}
                    />
                </div>

                {/* AI Performance */}
                <AiPerformanceCard {...data.aiPerformance} />

                {/* Meta Ads */}
                <MetaAdsCard />
            </div>
        </DashboardLayout>
    )
}
