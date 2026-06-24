import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { getMyAffiliate, getMyAffiliateStats } from "./actions"
import { AffiliatePanel } from "./affiliate-panel"
import type { AffiliateStats } from "@/lib/affiliates/stats"

export const dynamic = "force-dynamic"

const formatCOP = (amount: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(amount)

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
    return (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-gray-900/50 p-5">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
            {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
    )
}

export default async function AffiliatesPage() {
    const [affResult, statsResult] = await Promise.all([getMyAffiliate(), getMyAffiliateStats()])
    const affiliate = affResult.success ? affResult.data : null
    const stats: AffiliateStats | null = statsResult.success ? statsResult.data : null

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold tracking-tight">Programa de Afiliados</h2>
                    <p className="text-muted-foreground">
                        Refiere nuevos negocios a LandingChat y gana comisión recurrente por cada uno que se suscriba.
                    </p>
                </div>

                <AffiliatePanel initialAffiliate={affiliate} />

                {affiliate && stats && (
                    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                        <StatCard label="Referidos" value={`${stats.referralsTotal}`} hint={`${stats.referralsConverted} convertidos`} />
                        <StatCard label="Comisión pendiente" value={formatCOP(stats.pendingAmount)} hint={`${stats.pendingCount} comisiones`} />
                        <StatCard label="Aprobada" value={formatCOP(stats.approvedAmount)} hint="por pagar" />
                        <StatCard label="Pagada" value={formatCOP(stats.paidAmount)} hint="recibida" />
                    </div>
                )}
            </div>
        </DashboardLayout>
    )
}
