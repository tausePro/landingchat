import { getProducts } from "./actions"
import { ProductList } from "./components/product-list"
import { DashboardLayout } from "@/components/layout/dashboard-layout"

export const dynamic = 'force-dynamic'

export default async function ProductsPage() {
    const products = await getProducts()

    return (
        <DashboardLayout>
            <div className="container mx-auto py-6">
                <ProductList products={products} />
            </div>
        </DashboardLayout>
    )
}
