import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { getLeads } from "./actions"
import { LeadsContent } from "./leads-content"

export const dynamic = "force-dynamic"

interface LeadsPageProps {
    searchParams: Promise<{
        search?: string
        status?: string
    }>
}

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
    const params = await searchParams
    const { leads, stats } = await getLeads({
        search: params.search,
        status: params.status,
    })

    return (
        <DashboardLayout>
            <LeadsContent leads={leads} stats={stats} />
        </DashboardLayout>
    )
}
