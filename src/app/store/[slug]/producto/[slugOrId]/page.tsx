import { notFound } from "next/navigation"
import { StoreLayoutClient } from "../../store-layout-client"
import { getProductDetails } from "../../actions"
import { ProductDetailClient } from "./product-detail-client"
import { headers } from "next/headers"
import { isSubdomain } from "@/lib/utils/store-urls"

interface ProductDetailPageProps {
    params: Promise<{ slug: string; slugOrId: string }>
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
    const { slug, slugOrId } = await params
    console.log('ProductDetailPage Server Debug:', { slug, slugOrId })

    const headersList = await headers()
    const host = headersList.get("host") || ""
    const initialIsSubdomain = isSubdomain(host)
    console.log('ProductDetailPage Server Subdomain Debug:', { host, initialIsSubdomain })

    const data = await getProductDetails(slug, slugOrId)

    if (!data) notFound()

    const { organization, product, badges, promotions } = data

    return (
        <StoreLayoutClient
            slug={organization.slug}
            organization={organization}
            products={[]}
            hideNavigation={false}
            hideHeaderOnMobile={false}
            initialIsSubdomain={initialIsSubdomain}
        >
            <ProductDetailClient
                product={product}
                organization={organization}
                badges={badges}
                promotions={promotions}
                slug={organization.slug}
                initialIsSubdomain={initialIsSubdomain}
            />
        </StoreLayoutClient>
    )
}
