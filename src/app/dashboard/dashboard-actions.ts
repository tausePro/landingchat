"use server"

import { createClient } from "@/lib/supabase/server"
import { getBogotaDayRange, getBogotaRecentDayRanges } from "@/lib/utils/date"

export interface RealEstateStats {
    activeProperties: number
    newLeads: number
    appointmentsScheduled: number
    appointmentsPending: number
    appointmentsCompleted: number
    chatToLeadRate: number
    chatToAppointmentRate: number
    leadsByChannel: { name: string; value: number; color: string }[]
    topZones: { zone: string; count: number }[]
}

export interface RecentActivity {
    type: 'sale' | 'conversation' | 'stock_alert' | 'payment' | 'escalation'
    title: string
    description: string
    amount?: number
    timeAgo: string
}

export interface SiteStatus {
    name: string
    url: string
    isLive: boolean
    revenue: number
    visits: number
}

export interface AgentStatus {
    name: string
    isActive: boolean
    resolutionRate: number
}

export interface DashboardStats {
    userName: string
    organizationId: string
    organizationSlug: string
    organizationName: string
    industry: string
    revenue: {
        total: number
        today: number
        growth: number // vs last month
        history: { date: string; value: number }[]
        weeklyHistory: { day: string; value: number }[]
    }
    orders: {
        total: number
        growth: number
    }
    chats: {
        conversionRate: number
        growth: number
        total: number
        byChannel: { name: string; value: number; color: string }[]
    }
    agents: {
        active: number
        responseTime: string
    }
    insights: {
        averageOrderValue: number
        pendingOrders: number
        pendingOrderId: string | null
        newCustomers: number
        repeatPurchaseRate: number
    }
    recentActivity: RecentActivity[]
    siteStatus: SiteStatus
    agentStatus: AgentStatus
    realEstate?: RealEstateStats
}

export async function getDashboardStats(): Promise<DashboardStats> {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError) {
            console.error("[getDashboardStats] Auth error:", authError.message)
            throw new Error("Error de autenticación. Por favor, recarga la página.")
        }

        if (!user) throw new Error("Unauthorized")

        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("organization_id")
            .eq("id", user.id)
            .single()

        if (profileError) {
            console.error("[getDashboardStats] Profile error:", profileError.message)
            throw new Error("Error al cargar perfil. Por favor, recarga la página.")
        }

        if (!profile?.organization_id) throw new Error("No organization found")
        const orgId = profile.organization_id

    // Helper for date ranges
    const now = new Date()
    const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30)).toISOString()

    // 1. REVENUE & ORDERS
    // Get all orders to calculate total and history
    // Ideally we should aggregate in SQL but for MVP we fetch and process
    const { data: orders } = await supabase
        .from("orders")
        .select("id, order_number, total, created_at, status, customer_id, chat_id")
        .eq("organization_id", orgId)
        .in("status", ["pending", "confirmed", "processing", "shipped", "delivered", "completed"])
        .order("created_at", { ascending: true })

    const validOrders = orders || []

    // Total Revenue
    const totalRevenue = validOrders.reduce((sum, order) => sum + (order.total || 0), 0)
    const totalOrders = validOrders.length
    const pendingStatuses = new Set(["pending", "processing"])
    const pendingOrdersList = validOrders.filter(order => pendingStatuses.has(order.status || ""))
    const pendingOrders = pendingOrdersList.length
    // Si hay exactamente 1 pendiente, la card linkea directo a esa orden
    const pendingOrderId = pendingOrders === 1 ? pendingOrdersList[0].id : null

    // Serie diaria de ingresos (últimos 30 días, rellena con 0) para el gráfico.
    // Usa rangos en hora Colombia (America/Bogota): sin timezone explícita las
    // ventas de 19:00–23:59 local se corrían al día UTC siguiente. Etiqueta d/m.
    const history = getBogotaRecentDayRanges(30).map(({ start, end }) => {
        const d = new Date(start)
        const dayRevenue = validOrders
            .filter(o => o.created_at >= start && o.created_at < end)
            .reduce((sum, order) => sum + (order.total || 0), 0)
        return { date: `${d.getUTCDate()}/${d.getUTCMonth() + 1}`, value: dayRevenue }
    })

    // 2. CHATS & CONVERSION (FIXED: Better filtering and calculation)
    const { data: chats } = await supabase
        .from("chats")
        .select("id, channel, created_at, organization_id")
        .eq("organization_id", orgId)

    const totalChats = chats?.length || 0
    const whatsappChats = chats?.filter(c => c.channel === 'whatsapp').length || 0
    const webChats = chats?.filter(c => c.channel === 'web').length || 0

    // Conversión real: % de conversaciones que terminaron en una orden.
    // (totalOrders / totalChats podía superar 100% porque hay órdenes que NO
    //  vienen de un chat — WhatsApp directo, link de pago, etc. Atribuimos por
    //  chat_id y acotamos a 100% para no mentirle al merchant.)
    const convertingChatIds = new Set(
        validOrders.map(o => o.chat_id).filter((id): id is string => Boolean(id))
    )
    const conversionRate = totalChats > 0
        ? Math.min(100, (convertingChatIds.size / totalChats) * 100)
        : 0

    console.log(`[Dashboard] Org ${orgId}: ${totalChats} chats, ${totalOrders} orders, ${convertingChatIds.size} converting chats, ${conversionRate.toFixed(1)}% conversion`)

    // 3. CUSTOMERS INSIGHTS
    const { count: newCustomersCount } = await supabase
        .from("customers")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .gte("created_at", thirtyDaysAgo)

    const customerOrderCounts = new Map<string, number>()
    validOrders.forEach(order => {
        const customerId = order.customer_id
        if (customerId) {
            customerOrderCounts.set(customerId, (customerOrderCounts.get(customerId) || 0) + 1)
        }
    })

    const totalCustomersWithOrders = customerOrderCounts.size
    const repeatCustomers = Array.from(customerOrderCounts.values()).filter(count => count > 1).length
    const repeatPurchaseRate = totalCustomersWithOrders > 0 ? (repeatCustomers / totalCustomersWithOrders) * 100 : 0

    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

    // 3. AGENTS & RESPONSE TIME
    const { count: activeAgents } = await supabase
        .from("agents")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("status", "available")

    // Calculate real response time from recent messages
    const { data: recentMessages } = await supabase
        .from("messages")
        .select("metadata, sender_type")
        .eq("sender_type", "bot")
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24h
        .not("metadata", "is", null)
        .limit(50)

    // Calculate average response time
    let avgResponseTime = "1m 45s" // fallback
    if (recentMessages && recentMessages.length > 0) {
        const latencies = recentMessages
            .map(m => m.metadata?.latency_ms)
            .filter(l => l && !isNaN(parseInt(l)))
            .map(l => parseInt(l))

        if (latencies.length > 0) {
            const avgMs = latencies.reduce((sum, l) => sum + l, 0) / latencies.length
            const seconds = Math.round(avgMs / 1000)
            const minutes = Math.floor(seconds / 60)
            const remainingSeconds = seconds % 60
            
            if (minutes > 0) {
                avgResponseTime = `${minutes}m ${remainingSeconds}s`
            } else {
                avgResponseTime = `${remainingSeconds}s`
            }
        }
    }

    const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || "Usuario"

    // Get Organization data
    const { data: org } = await supabase
        .from("organizations")
        .select("slug, name, industry, enabled_modules, custom_domain")
        .eq("id", orgId)
        .single()

    const organizationSlug = org?.slug || ""
    const organizationName = org?.name || "Mi Tienda"
    const industry = org?.industry || "ecommerce"
    const enabledModules = org?.enabled_modules || []
    const isRealEstate = industry === "real_estate" || enabledModules.includes("properties")

    // Revenue Today
    const todayRange = getBogotaDayRange()
    const revenueToday = validOrders
        .filter(o => o.created_at >= todayRange.start && o.created_at < todayRange.end)
        .reduce((sum, o) => sum + (o.total || 0), 0)

    // Weekly Revenue History (L M X J V S D)
    const weeklyHistory = getBogotaRecentDayRanges(7).map(({ label, start, end }) => {
        const dayRevenue = validOrders
            .filter(o => o.created_at >= start && o.created_at < end)
            .reduce((sum, o) => sum + (o.total || 0), 0)
        return { day: label, value: dayRevenue }
    })

    // Recent Activity (últimos 5 eventos)
    const recentActivity: RecentActivity[] = []
    const recentOrders = validOrders
        .filter(o => o.created_at >= thirtyDaysAgo)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)

    for (const order of recentOrders) {
        const minutesAgo = Math.round((Date.now() - new Date(order.created_at).getTime()) / 60000)
        const timeAgo = minutesAgo < 60 ? `hace ${minutesAgo} min` : minutesAgo < 1440 ? `hace ${Math.round(minutesAgo / 60)} h` : `hace ${Math.round(minutesAgo / 1440)} días`

        if (order.status === 'completed' || order.status === 'confirmed' || order.status === 'delivered') {
            recentActivity.push({
                type: 'sale',
                title: `Nueva venta`,
                description: `Orden #${order.order_number || order.id.slice(0, 8)}`,
                amount: order.total,
                timeAgo,
            })
        } else if (order.status === 'pending') {
            recentActivity.push({
                type: 'payment',
                title: `Pago pendiente`,
                description: `Orden #${order.order_number || order.id.slice(0, 8)}`,
                amount: order.total,
                timeAgo,
            })
        }
    }

    // Agent Status
    const { data: defaultAgent } = await supabase
        .from("agents")
        .select("name, status")
        .eq("organization_id", orgId)
        .limit(1)
        .single()

    const totalBotMessages = recentMessages?.filter(m => m.sender_type === 'bot').length || 0
    const totalUserMessages = recentMessages?.filter(m => m.sender_type === 'user').length || 0
    const resolutionRate = totalUserMessages > 0 ? Math.round((totalBotMessages / totalUserMessages) * 100) : 0

    // Site Status
    const siteUrl = org?.custom_domain
        ? `https://${org.custom_domain}`
        : organizationSlug ? `${organizationSlug}.landingchat.co` : ""

    const siteStatus: SiteStatus = {
        name: organizationName,
        url: siteUrl,
        isLive: true,
        revenue: totalRevenue,
        visits: totalChats,
    }

    const agentStatus: AgentStatus = {
        name: defaultAgent?.name || "Agente IA",
        isActive: (defaultAgent?.status === "available"),
        resolutionRate: Math.min(resolutionRate, 100),
    }

    // Real Estate KPIs
    let realEstateStats: RealEstateStats | undefined
    if (isRealEstate) {
        const [propertiesResult, leadsResult, appointmentsResult] = await Promise.all([
            supabase
                .from("properties")
                .select("id, city, neighborhood", { count: "exact", head: false })
                .eq("organization_id", orgId)
                .eq("status", "active"),
            supabase
                .from("customers")
                .select("id, channel", { count: "exact", head: false })
                .eq("organization_id", orgId)
                .gte("created_at", thirtyDaysAgo),
            supabase
                .from("appointments")
                .select("id, status")
                .eq("organization_id", orgId)
                .gte("created_at", thirtyDaysAgo),
        ])

        const activeProperties = propertiesResult.count || 0
        const newLeads = leadsResult.count || 0
        const appointments = appointmentsResult.data || []
        const appointmentsScheduled = appointments.length
        const appointmentsPending = appointments.filter(a => a.status === "pending" || a.status === "confirmed").length
        const appointmentsCompleted = appointments.filter(a => a.status === "completed").length

        // Conversión chat → lead
        const chatToLeadRate = totalChats > 0 ? (newLeads / totalChats) * 100 : 0
        // Conversión chat → cita
        const chatToAppointmentRate = totalChats > 0 ? (appointmentsScheduled / totalChats) * 100 : 0

        // Leads por canal
        const leads = leadsResult.data || []
        const leadChannels: Record<string, number> = {}
        leads.forEach((l: { channel?: string }) => {
            const ch = l.channel || "web"
            leadChannels[ch] = (leadChannels[ch] || 0) + 1
        })

        // Zonas más buscadas (propiedades activas por barrio)
        const properties = propertiesResult.data || []
        const zoneCounts: Record<string, number> = {}
        properties.forEach((p: { neighborhood?: string; city?: string }) => {
            const zone = p.neighborhood || p.city || "Sin zona"
            zoneCounts[zone] = (zoneCounts[zone] || 0) + 1
        })
        const topZones = Object.entries(zoneCounts)
            .map(([zone, count]) => ({ zone, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)

        realEstateStats = {
            activeProperties,
            newLeads,
            appointmentsScheduled,
            appointmentsPending,
            appointmentsCompleted,
            chatToLeadRate: parseFloat(chatToLeadRate.toFixed(1)),
            chatToAppointmentRate: parseFloat(chatToAppointmentRate.toFixed(1)),
            leadsByChannel: [
                { name: "WhatsApp", value: leadChannels["whatsapp"] || 0, color: "#22c55e" },
                { name: "Web", value: leadChannels["web"] || 0, color: "#3b82f6" },
                { name: "Instagram", value: leadChannels["instagram"] || 0, color: "#e11d48" },
            ],
            topZones,
        }
    }

        return {
            userName,
            organizationId: orgId,
            organizationSlug,
            organizationName,
            industry,
            realEstate: realEstateStats,
            revenue: {
                total: totalRevenue,
                today: revenueToday,
                growth: 12.5, // Dummy growth for now
                history,
                weeklyHistory,
            },
            orders: {
                total: totalOrders,
                growth: 8
            },
            chats: {
                conversionRate: parseFloat(conversionRate.toFixed(1)),
                growth: -0.5,
                total: totalChats,
                byChannel: [
                    { name: 'Web', value: webChats, color: '#3b82f6' },
                    { name: 'WhatsApp', value: whatsappChats, color: '#22c55e' }
                ]
            },
            agents: {
                active: activeAgents || 1,
                responseTime: avgResponseTime
            },
            insights: {
                averageOrderValue,
                pendingOrders,
                pendingOrderId,
                newCustomers: newCustomersCount || 0,
                repeatPurchaseRate: parseFloat(repeatPurchaseRate.toFixed(1)),
            },
            recentActivity,
            siteStatus,
            agentStatus,
        }
    } catch (error) {
        console.error("[getDashboardStats] Error:", error)
        // Retornar datos por defecto en caso de error para evitar crash
        if (error instanceof Error && error.message.includes("Unauthorized")) {
            throw error // Re-throw auth errors
        }
        // Para otros errores, retornar datos vacíos
        return {
            userName: "Usuario",
            organizationId: "",
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
                pendingOrderId: null,
                newCustomers: 0,
                repeatPurchaseRate: 0,
            },
            recentActivity: [],
            siteStatus: { name: "Mi Tienda", url: "", isLive: false, revenue: 0, visits: 0 },
            agentStatus: { name: "Agente IA", isActive: false, resolutionRate: 0 },
        }
    }
}
