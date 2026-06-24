import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { getMyAffiliate } from "./actions"
import { AffiliatePanel } from "./affiliate-panel"

export const dynamic = "force-dynamic"

export default async function AffiliatesPage() {
    const result = await getMyAffiliate()
    const affiliate = result.success ? result.data : null

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
            </div>
        </DashboardLayout>
    )
}
