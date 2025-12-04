import { notFound } from "next/navigation"
import { StoreLayoutClient } from "../../store-layout-client"
import { getProductDetails } from "../../actions"
import { ProductDetailClient } from "./product-detail-client"

interface ProductDetailPageProps {
    params: Promise<{ slug: string; slugOrId: string }>
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
    const { slug, slugOrId } = await params
    console.log('ProductDetailPage Server Debug:', { slug, slugOrId })

    const data = await getProductDetails(slug, slugOrId)

    if (!data) notFound()

    const { organization, product, badges, promotions } = data

    return (
        <StoreLayoutClient slug={organization.slug} organization={organization} products={[]} hideNavigation={false} hideHeaderOnMobile={true}>
            <ProductDetailClient
                product={product}
                organization={organization}
                badges={badges}
                promotions={promotions}
                slug={organization.slug}
            />
        </StoreLayoutClient>
    )
}
