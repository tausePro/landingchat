import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { CustomerList } from "./components/customer-list"
import { CustomerSegments } from "./components/customer-segments"
import { CustomerKPIs } from "./components/customer-kpis"
import { CustomerHeaderActions } from "./components/customer-header-actions"
import { CustomerPagination } from "./components/customer-pagination"
import { getCustomers, getCustomerStats } from "./actions"
import { Suspense } from "react"
import type { CustomerSegment, IntentScoreFilter } from "@/types/customer"

export const dynamic = 'force-dynamic'

interface CustomersPageProps {
    searchParams: Promise<{
        page?: string
        search?: string
        category?: string
        channel?: string
        zone?: string
        segment?: string
        intentScores?: string
    }>
}

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
    const params = await searchParams
    const page = Number(params.page) || 1
    const search = params.search
    const category = params.category
    const channel = params.channel
    const zone = params.zone
    const segment = (params.segment as CustomerSegment) || "all"
    const intentScores = params.intentScores
        ? (params.intentScores.split(",") as IntentScoreFilter[])
        : undefined

    // Fetch en paralelo
    const [customersResult, statsResult] = await Promise.all([
        getCustomers({
            page,
            limit: 25,
            search,
            category,
            channel,
            zone,
            segment,
            intentScores,
        }),
        getCustomerStats(),
    ])

    // Fallback stats en caso de error
    const defaultStats = {
        totalLeadsThisMonth: 0,
        leadsGrowthPercent: 0,
        activeConversations: 0,
        avgResponseTime: "-",
        segments: { all: 0, whatsappLeads: 0, recurringBuyers: 0, pendingFollowUp: 0 },
        intentScoreCounts: { alta: 0, media: 0, baja: 0, riesgo: 0 },
    }

    const stats = statsResult.success ? statsResult.data : defaultStats

    // Handle error en customers
    if (!customersResult.success) {
        return (
            <DashboardLayout>
                <div className="flex flex-col gap-6">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Gestión de Clientes y Leads</h1>
                        <p className="text-destructive mt-1">Error: {customersResult.error}</p>
                    </div>
                </div>
            </DashboardLayout>
        )
    }

    const { customers, total, totalPages } = customersResult.data

    return (
        <DashboardLayout>
            <div className="flex flex-col gap-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-text-light-primary dark:text-text-dark-primary text-3xl font-bold tracking-tight">
                            Gestión de Clientes y Leads
                        </h1>
                        <p className="text-text-light-secondary dark:text-text-dark-secondary text-base font-normal leading-normal mt-1">
                            Administra tus relaciones y oportunidades de venta
                        </p>
                    </div>
                    <CustomerHeaderActions />
                </div>

                {/* Layout principal: Sidebar + Content */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Sidebar */}
                    <div className="lg:col-span-1">
                        <CustomerSegments
                            segments={stats.segments}
                            intentScoreCounts={stats.intentScoreCounts}
                            activeSegment={segment}
                            activeIntentScores={intentScores}
                        />
                    </div>

                    {/* Área principal */}
                    <div className="lg:col-span-3 flex flex-col gap-6">
                        {/* KPIs */}
                        <CustomerKPIs
                            totalLeadsThisMonth={stats.totalLeadsThisMonth}
                            leadsGrowthPercent={stats.leadsGrowthPercent}
                            activeConversations={stats.activeConversations}
                            avgResponseTime={stats.avgResponseTime}
                        />

                        {/* Tabla de clientes */}
                        <Suspense fallback={<div className="p-8 text-center text-text-light-secondary">Cargando lista de clientes...</div>}>
                            <CustomerList customers={customers} />
                        </Suspense>

                        {/* Paginación */}
                        {totalPages > 1 && (
                            <CustomerPagination
                                currentPage={page}
                                totalPages={totalPages}
                                total={total}
                                pageSize={25}
                            />
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}
