import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { getMyStoreAffiliates, getMyStoreCommissions } from "./actions"
import { StoreAffiliatesManager } from "./store-affiliates-manager"
import { StoreCommissionsTable } from "./store-commissions-table"

export const dynamic = "force-dynamic"

export default async function StoreAffiliatesPage() {
    const [affResult, commResult] = await Promise.all([getMyStoreAffiliates(), getMyStoreCommissions()])
    const affiliates = affResult.success ? affResult.data : []
    const commissions = commResult.success ? commResult.data : []

    return (
        <DashboardLayout>
            <div className="space-y-8">
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold tracking-tight">Programa de afiliados</h2>
                    <p className="text-muted-foreground">
                        Crea afiliados para tu tienda. Cada uno recibe un link; cuando un cliente compra a través de él,
                        el afiliado gana comisión sobre los productos del pedido.
                    </p>
                </div>

                <StoreAffiliatesManager initial={affiliates} />

                <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Comisiones</h3>
                    <StoreCommissionsTable initial={commissions} />
                </div>
            </div>
        </DashboardLayout>
    )
}
