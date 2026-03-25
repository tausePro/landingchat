import { getProducts } from "./actions"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import Link from "next/link"
import { WooImportModal } from "./components/woo-import-modal"
import { ProductReorderToggle } from "./components/product-reorder-toggle"
import { ProductTable } from "./components/product-table"

export const dynamic = 'force-dynamic'

export default async function ProductsPage() {
    const result = await getProducts()
    const products = result.success ? result.data : []

    return (
        <DashboardLayout>
            <div className="p-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex min-w-72 flex-col">
                        <h1 className="text-text-light-primary dark:text-text-dark-primary text-3xl font-bold tracking-tight">Gestión de Productos</h1>
                        <p className="text-text-light-secondary dark:text-text-dark-secondary text-base font-normal leading-normal mt-1">Añade, edita y gestiona todos los productos de tu tienda.</p>
                    </div>
                    <div className="flex gap-3">
                        <ProductReorderToggle products={products} />
                        <WooImportModal />
                        <Link href="/dashboard/products/new" className="flex h-10 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg bg-primary px-4 text-white text-sm font-bold shadow-sm hover:bg-primary/90">
                            <span className="material-symbols-outlined text-lg">add_circle</span>
                            <span className="truncate">Añadir Nuevo Producto</span>
                        </Link>
                    </div>
                </div>

                <ProductTable products={products} />
            </div>
        </DashboardLayout>
    )
}
