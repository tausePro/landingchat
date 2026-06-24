import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { getMyStoreAffiliates } from "./actions"
import { StoreAffiliatesManager } from "./store-affiliates-manager"

export const dynamic = "force-dynamic"

export default async function StoreAffiliatesPage() {
    const result = await getMyStoreAffiliates()
    const affiliates = result.success ? result.data : []

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold tracking-tight">Programa de afiliados</h2>
                    <p className="text-muted-foreground">
                        Crea afiliados para tu tienda. Cada uno recibe un link; cuando un cliente compra a través de él,
                        el afiliado gana comisión sobre los productos del pedido.
                    </p>
                </div>
                <StoreAffiliatesManager initial={affiliates} />
            </div>
        </DashboardLayout>
    )
}
