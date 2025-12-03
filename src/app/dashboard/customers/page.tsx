import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { CustomerList } from "./components/customer-list"
import { CustomerFilters } from "./components/customer-filters"
import { getCustomers } from "./actions"
import { Suspense } from "react"

export const dynamic = 'force-dynamic'

interface CustomersPageProps {
    searchParams: {
        page?: string
        search?: string
        category?: string
        channel?: string
        zone?: string
    }
}

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
    const page = Number(searchParams.page) || 1
    const search = searchParams.search
    const category = searchParams.category
    const channel = searchParams.channel
    const zone = searchParams.zone

    const { customers, total, totalPages } = await getCustomers({
        page,
        limit: 25,
        search,
        category,
        channel,
        zone
    })

    return (
        <DashboardLayout>
            <div className="flex flex-col gap-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Clientes ({total})</h1>
                    <p className="text-muted-foreground">
                        Gestiona tu base de clientes, segmenta y realiza acciones de marketing.
                    </p>
                </div>

                <CustomerFilters />

                <Suspense fallback={<div>Cargando lista de clientes...</div>}>
                    <CustomerList customers={customers} />
                </Suspense>

                {/* Pagination (Simple implementation for now) */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-4">
                        <span className="text-sm text-muted-foreground">
                            Página {page} de {totalPages}
                        </span>
                    </div>
                )}
            </div>
        </DashboardLayout>
    )
}
