import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { getCategories } from "./actions"
import { CategoriesManager } from "./components/categories-manager"

export const dynamic = "force-dynamic"

export default async function CategoriesPage() {
    const categories = await getCategories()

    return (
        <DashboardLayout>
            <div className="p-8">
                <CategoriesManager initialCategories={categories} />
            </div>
        </DashboardLayout>
    )
}
