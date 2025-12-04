import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { ProductForm } from "../components/product-form"
import { getProductById } from "../actions"
import { notFound } from "next/navigation"

interface EditProductPageProps {
    params: Promise<{ id: string }>
}

export default async function EditProductPage({ params }: EditProductPageProps) {
    const { id } = await params

    const result = await getProductById(id)

    if (!result.success || !result.data) {
        notFound()
    }

    const product = result.data

    return (
        <DashboardLayout>
            <ProductForm
                organizationId={product.organization_id}
                initialData={product}
                isEditing
            />
        </DashboardLayout>
    )
}
