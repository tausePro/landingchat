import { getOrganizationCategories } from "../products/actions"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { CategoriesManager } from "./components/categories-manager"

export const dynamic = "force-dynamic"

export default async function CategoriesPage() {
    const result = await getOrganizationCategories()
    const categories = result.success ? result.data : []

    return (
        <DashboardLayout>
            <div className="p-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex min-w-72 flex-col">
                        <h1 className="text-text-light-primary dark:text-text-dark-primary text-3xl font-bold tracking-tight">
                            Categorías
                        </h1>
                        <p className="text-text-light-secondary dark:text-text-dark-secondary text-base font-normal leading-normal mt-1">
                            Gestiona las categorías de tus productos
                        </p>
                    </div>
                </div>
                <div className="mt-8">
                    <CategoriesManager initialCategories={categories} />
                </div>
            </div>
        </DashboardLayout>
    )
}
