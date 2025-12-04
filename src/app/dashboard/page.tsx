"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { PlanUsageCard } from "./components/plan-usage-card"

export default function DashboardPage() {
    const [stats, setStats] = useState({
        activeChats: 0,
        activeAgents: 0,
    })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchStats = async () => {
            const supabase = createClient()

            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: profile } = await supabase
                .from("profiles")
                .select("organization_id")
                .eq("id", user.id)
                .single()

            if (!profile?.organization_id) return

            // Fetch Active Chats
            const { count: chatsCount } = await supabase
                .from("chats")
                .select("*", { count: "exact", head: true })
                .eq("organization_id", profile.organization_id)
                .eq("status", "active")

            // Fetch Active Agents
            const { count: agentsCount } = await supabase
                .from("agents")
                .select("*", { count: "exact", head: true })
                .eq("organization_id", profile.organization_id)
                .eq("status", "available")

            setStats({
                activeChats: chatsCount || 0,
                activeAgents: agentsCount || 0,
            })
            setLoading(false)
        }

        fetchStats()
    }, [])

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <h1 className="text-3xl font-bold text-text-light-primary dark:text-text-dark-primary">
                    Dashboard
                </h1>

                {/* Metrics Grid */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Ventas Totales
                            </CardTitle>
                            <span className="material-symbols-outlined text-text-light-secondary dark:text-text-dark-secondary">
                                attach_money
                            </span>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">$0.00</div>
                            <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary">
                                Sin datos de ventas aún
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Chats Activos
                            </CardTitle>
                            <span className="material-symbols-outlined text-text-light-secondary dark:text-text-dark-secondary">
                                chat
                            </span>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {loading ? "..." : stats.activeChats}
                            </div>
                            <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary">
                                En tiempo real
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Tasa de Conversión
                            </CardTitle>
                            <span className="material-symbols-outlined text-text-light-secondary dark:text-text-dark-secondary">
                                trending_up
                            </span>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">0%</div>
                            <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary">
                                Necesita más datos
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Agentes Disponibles
                            </CardTitle>
                            <span className="material-symbols-outlined text-text-light-secondary dark:text-text-dark-secondary">
                                support_agent
                            </span>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {loading ? "..." : stats.activeAgents}
                            </div>
                            <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary">
                                Listos para atender
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Recent Activity & Charts Placeholder */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                    <Card className="col-span-4">
                        <CardHeader>
                            <CardTitle>Resumen de Ingresos</CardTitle>
                        </CardHeader>
                        <CardContent className="pl-2">
                            <div className="h-[200px] flex items-center justify-center text-text-light-secondary dark:text-text-dark-secondary bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                                Gráfico de Ingresos (Próximamente)
                            </div>
                        </CardContent>
                    </Card>
                    <div className="col-span-3 space-y-4">
                        <PlanUsageCard />
                        <Card>
                            <CardHeader>
                                <CardTitle>Chats Recientes</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary">
                                        Implementando lista de chats...
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}
