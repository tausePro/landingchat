import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { ProductForm } from "../components/product-form"
import { ProductReviewsManager } from "../components/ProductReviewsManager"
import { getProductById } from "../actions"
import { createClient } from "@/lib/supabase/server"
import {
    getProductEngagementSummaryForDashboard,
    getProductReviewsForDashboard,
} from "../review-actions"
import { notFound } from "next/navigation"
import type { ProductEngagementSummary } from "@/types/product"

interface EditProductPageProps {
    params: Promise<{ id: string }>
}

const emptyEngagementSummary: ProductEngagementSummary = {
    pageViews: 0,
    addToCartCount: 0,
    uniqueVisitors: 0,
}

export default async function EditProductPage({ params }: EditProductPageProps) {
    const { id } = await params

    const result = await getProductById(id)

    if (!result.success || !result.data) {
        notFound()
    }

    const product = result.data
    const supabase = await createClient()

    const [reviewsResult, engagementResult, organizationResult] = await Promise.all([
        getProductReviewsForDashboard(id),
        getProductEngagementSummaryForDashboard(id),
        supabase
            .from("organizations")
            .select("slug")
            .eq("id", product.organization_id)
            .single(),
    ])

    const initialReviews = reviewsResult.success ? reviewsResult.data : []
    const initialEngagementSummary = engagementResult.success
        ? engagementResult.data
        : emptyEngagementSummary
    const initialError = !reviewsResult.success
        ? reviewsResult.error
        : !engagementResult.success
            ? engagementResult.error
            : undefined
    const storeSlug = organizationResult.data?.slug || ""

    return (
        <DashboardLayout>
            <ProductForm
                organizationId={product.organization_id}
                storeSlug={storeSlug}
                initialData={product}
                isEditing
            />
            <ProductReviewsManager
                organizationId={product.organization_id}
                productId={id}
                initialReviews={initialReviews}
                initialEngagementSummary={initialEngagementSummary}
                initialError={initialError}
            />
        </DashboardLayout>
    )
}
