"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Package, Bot, MessageSquare, MessageCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface UsageData {
    products: { current: number; limit: number; percentage: number }
    agents: { current: number; limit: number; percentage: number }
    conversations: { current: number; limit: number; percentage: number }
    whatsapp: { current: number; limit: number; percentage: number }
    planName: string
}

export function PlanUsageCard() {
    const [usage, setUsage] = useState<UsageData | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchUsage = async () => {
            const supabase = createClient()

            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: profile } = await supabase
                .from("profiles")
                .select("organization_id")
                .eq("id", user.id)
                .single()

            if (!profile?.organization_id) return

            const orgId = profile.organization_id

            // Obtener suscripción con plan
            const { data: subscription } = await supabase
                .from("subscriptions")
                .select(`
                    max_products,
                    max_agents,
                    max_monthly_conversations,
                    plan:plans(name, max_products, max_agents, max_monthly_conversations, max_whatsapp_conversations)
                `)
                .eq("organization_id", orgId)
                .eq("status", "active")
                .single()

            // Defaults para plan gratuito
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const planData = subscription?.plan as any
            const limits = {
                max_products: subscription?.max_products || planData?.max_products || 10,
                max_agents: subscription?.max_agents || planData?.max_agents || 1,
                max_monthly_conversations: subscription?.max_monthly_conversations || planData?.max_monthly_conversations || 100,
                max_whatsapp_conversations: planData?.max_whatsapp_conversations || 10, // Plan gratuito incluye 10 conversaciones WhatsApp
            }
            const planName = planData?.name || "Gratis"

            // Contar uso actual
            const { count: productsCount } = await supabase
                .from("products")
                .select("*", { count: "exact", head: true })
                .eq("organization_id", orgId)

            const { count: agentsCount } = await supabase
                .from("agents")
                .select("*", { count: "exact", head: true })
                .eq("organization_id", orgId)

            // Conversaciones del mes actual
            const startOfMonth = new Date()
            startOfMonth.setDate(1)
            startOfMonth.setHours(0, 0, 0, 0)

            const { count: conversationsCount } = await supabase
                .from("chats")
                .select("*", { count: "exact", head: true })
                .eq("organization_id", orgId)
                .gte("created_at", startOfMonth.toISOString())

            const products = productsCount || 0
            const agents = agentsCount || 0
            const conversations = conversationsCount || 0

            // Obtener uso de WhatsApp
            const { data: orgData } = await supabase
                .from("organizations")
                .select("whatsapp_conversations_used")
                .eq("id", orgId)
                .single()

            const whatsappUsed = orgData?.whatsapp_conversations_used || 0

            setUsage({
                products: {
                    current: products,
                    limit: limits.max_products,
                    percentage: Math.min((products / limits.max_products) * 100, 100),
                },
                agents: {
                    current: agents,
                    limit: limits.max_agents,
                    percentage: Math.min((agents / limits.max_agents) * 100, 100),
                },
                conversations: {
                    current: conversations,
                    limit: limits.max_monthly_conversations,
                    percentage: Math.min((conversations / limits.max_monthly_conversations) * 100, 100),
                },
                whatsapp: {
                    current: whatsappUsed,
                    limit: limits.max_whatsapp_conversations,
                    percentage: limits.max_whatsapp_conversations > 0 
                        ? Math.min((whatsappUsed / limits.max_whatsapp_conversations) * 100, 100)
                        : 0,
                },
                planName,
            })
            setLoading(false)
        }

        fetchUsage()
    }, [])

    const getProgressColor = (percentage: number) => {
        if (percentage >= 90) return "bg-red-500"
        if (percentage >= 80) return "bg-yellow-500"
        return "bg-primary"
    }

    const showAlert = (percentage: number) => percentage >= 80

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-medium">Uso del Plan</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="animate-pulse space-y-4">
                        <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                        <div className="h-2 bg-slate-200 rounded"></div>
                        <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                        <div className="h-2 bg-slate-200 rounded"></div>
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (!usage) return null

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Uso del Plan</CardTitle>
                <Badge variant="outline">{usage.planName}</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Productos */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <span>Productos</span>
                            {showAlert(usage.products.percentage) && (
                                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                            )}
                        </div>
                        <span className="text-muted-foreground">
                            {usage.products.current} / {usage.products.limit}
                        </span>
                    </div>
                    <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden dark:bg-slate-700">
                        <div
                            className={`h-full rounded-full transition-all ${getProgressColor(usage.products.percentage)}`}
                            style={{ width: `${usage.products.percentage}%` }}
                        />
                    </div>
                </div>

                {/* Agentes */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4 text-muted-foreground" />
                            <span>Agentes</span>
                            {showAlert(usage.agents.percentage) && (
                                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                            )}
                        </div>
                        <span className="text-muted-foreground">
                            {usage.agents.current} / {usage.agents.limit}
                        </span>
                    </div>
                    <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden dark:bg-slate-700">
                        <div
                            className={`h-full rounded-full transition-all ${getProgressColor(usage.agents.percentage)}`}
                            style={{ width: `${usage.agents.percentage}%` }}
                        />
                    </div>
                </div>

                {/* Conversaciones */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-muted-foreground" />
                            <span>Conversaciones/mes</span>
                            {showAlert(usage.conversations.percentage) && (
                                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                            )}
                        </div>
                        <span className="text-muted-foreground">
                            {usage.conversations.current} / {usage.conversations.limit}
                        </span>
                    </div>
                    <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden dark:bg-slate-700">
                        <div
                            className={`h-full rounded-full transition-all ${getProgressColor(usage.conversations.percentage)}`}
                            style={{ width: `${usage.conversations.percentage}%` }}
                        />
                    </div>
                </div>

                {/* WhatsApp - Solo mostrar si el plan incluye WhatsApp */}
                {usage.whatsapp.limit > 0 && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                                <MessageCircle className="h-4 w-4 text-muted-foreground" />
                                <span>WhatsApp/mes</span>
                                {showAlert(usage.whatsapp.percentage) && (
                                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                )}
                            </div>
                            <span className="text-muted-foreground">
                                {usage.whatsapp.current} / {usage.whatsapp.limit}
                            </span>
                        </div>
                        <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden dark:bg-slate-700">
                            <div
                                className={`h-full rounded-full transition-all ${getProgressColor(usage.whatsapp.percentage)}`}
                                style={{ width: `${usage.whatsapp.percentage}%` }}
                            />
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
