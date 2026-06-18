import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { getLeadDetail, getOrgAdvisorsForSelect } from "./actions"
import { LeadDetailView } from "./lead-detail-view"
import { notFound } from "next/navigation"
import Link from "next/link"
import { getCurrentTenantLocale } from "@/lib/i18n/tenant-locale-server"

export const dynamic = "force-dynamic"

export default async function LeadDetailPage({
    params,
}: {
    params: Promise<{ phone: string }>
}) {
    const { phone } = await params
    const decodedPhone = decodeURIComponent(phone)

    const [lead, advisors] = await Promise.all([
        getLeadDetail(decodedPhone),
        getOrgAdvisorsForSelect(),
    ])

    if (!lead) return notFound()

    const tenantLocale = await getCurrentTenantLocale()

    return (
        <DashboardLayout>
            <div className="p-6">
                <div className="flex items-center gap-2 mb-6 text-sm text-gray-500">
                    <Link href="/dashboard/leads" className="hover:text-primary transition-colors">
                        Leads
                    </Link>
                    <span className="material-symbols-outlined text-xs">chevron_right</span>
                    <span className="text-gray-900 dark:text-white font-medium">{lead.name}</span>
                </div>

                <LeadDetailView lead={lead} advisors={advisors} tenantLocale={tenantLocale} />
            </div>
        </DashboardLayout>
    )
}
