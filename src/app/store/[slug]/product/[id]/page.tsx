import { notFound } from "next/navigation"
import { StoreLayoutClient } from "../../store-layout-client"
import { getProductDetails } from "../../actions"
import { ProductDetailClient } from "./product-detail-client"

interface ProductDetailPageProps {
    params: Promise<{ slug: string; id: string }>
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
    const { slug, id } = await params

    const data = await getProductDetails(slug, id)

    if (!data) notFound()

    const { organization, product, badges, promotions } = data

    return (
        <StoreLayoutClient slug={slug} organization={organization} products={[]} hideNavigation={false} hideHeaderOnMobile={true}>
            <ProductDetailClient
                product={product}
                organization={organization}
                badges={badges}
                promotions={promotions}
                slug={slug}
            />
        </StoreLayoutClient>
    )
}
