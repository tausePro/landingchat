import { StatWidget } from "@/app/dashboard/components/stat-widget"

interface CustomerKPIsProps {
    totalLeadsThisMonth: number
    leadsGrowthPercent: number
    activeConversations: number
    avgResponseTime: string
}

export function CustomerKPIs({
    totalLeadsThisMonth,
    leadsGrowthPercent,
    activeConversations,
    avgResponseTime,
}: CustomerKPIsProps) {
    return (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            <StatWidget
                title="Total Leads (Este Mes)"
                value={totalLeadsThisMonth.toLocaleString("es-CO")}
                helper="vs mes anterior"
                icon="group_add"
                trendLabel={`${leadsGrowthPercent >= 0 ? "+" : ""}${leadsGrowthPercent}%`}
                trendDirection={leadsGrowthPercent >= 0 ? "up" : "down"}
            />
            <StatWidget
                title="Conversaciones Activas"
                value={activeConversations.toLocaleString("es-CO")}
                helper={`Tiempo resp. promedio: ${avgResponseTime}`}
                icon="forum"
            />
        </div>
    )
}
