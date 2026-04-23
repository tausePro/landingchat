import { notFound } from "next/navigation"
import { Metadata } from "next"
import { StoreLayoutClient } from "../../store-layout-client"
import { getProductDetails, getShippingConfig } from "../../actions"
import { ProductDetailClient } from "./product-detail-client"
import { ProductJsonLd } from "@/components/seo/product-json-ld"
import { headers } from "next/headers"
import { isSubdomain } from "@/lib/utils/store-urls"
import { createServiceClient } from "@/lib/supabase/server"
import type { ProductReview, ProductReviewSummary } from "@/types/product"

interface ProductDetailPageProps {
    params: Promise<{ slug: string; slugOrId: string }>
}

// Genera metadata dinámica para SEO
export async function generateMetadata({ params }: ProductDetailPageProps): Promise<Metadata> {
    const { slug, slugOrId } = await params
    const data = await getProductDetails(slug, slugOrId)

    if (!data) {
        return {
            title: "Producto no encontrado",
            description: "El producto que buscas no existe."
        }
    }

    const { product, organization } = data
    const title = product.meta_title || `${product.name} | ${organization.name}`
    const description = product.meta_description || product.description || `Compra ${product.name} en ${organization.name}. Precio: $${product.price.toLocaleString('es-CO')} COP`
    const images = product.images?.length ? product.images : product.image_url ? [product.image_url] : []

    // Construir URL canónica del producto
    const baseUrl = organization.custom_domain
        ? `https://${organization.custom_domain}`
        : `https://${organization.slug}.landingchat.co`
    const productUrl = `${baseUrl}/producto/${product.slug || slugOrId}`

    return {
        title,
        description,
        keywords: product.keywords?.join(", ") || product.categories?.join(", "),
        openGraph: {
            title,
            description,
            url: productUrl,
            images: images.map((img: string) => ({
                url: img,
                width: 1200,
                height: 630,
            })),
            type: "website",
            siteName: organization.name,
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
            images,
        },
        robots: {
            index: true,
            follow: true,
        }
    }
}

async function getPublishedProductReviews(productId: string): Promise<{
    reviews: ProductReview[]
    summary: ProductReviewSummary | null
}> {
    try {
        const supabase = createServiceClient()
        const { data, error } = await supabase
            .from("product_reviews")
            .select("id, product_id, organization_id, customer_id, order_id, author_name, author_role, title, content, rating, verified_purchase, is_published, published_at, created_at, updated_at")
            .eq("product_id", productId)
            .eq("is_published", true)
            .order("created_at", { ascending: false })

        if (error || !data) {
            return { reviews: [], summary: null }
        }

        const reviews = data as ProductReview[]
        if (reviews.length === 0) {
            return { reviews, summary: null }
        }

        const summary: ProductReviewSummary = {
            averageRating: Number(
                (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
            ),
            reviewCount: reviews.length,
            verifiedReviewCount: reviews.filter((r) => r.verified_purchase).length,
        }

        return { reviews, summary }
    } catch {
        return { reviews: [], summary: null }
    }
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
    const { slug, slugOrId } = await params

    const headersList = await headers()
    const host = headersList.get("host") || ""
    const protocol = host.includes("localhost") ? "http" : "https"
    const initialIsSubdomain = isSubdomain(host)

    const data = await getProductDetails(slug, slugOrId)

    if (!data) notFound()

    const { organization, product, productWithVariants, badges, promotions, relatedProducts } = data

    // Cargar reseñas publicadas del producto en paralelo (no bloquea si falla)
    const [{ reviews, summary: reviewSummary }, shippingConfig] = await Promise.all([
        getPublishedProductReviews(product.id),
        getShippingConfig(organization.slug),
    ])

    // Construir URL canónica del producto
    const productUrl = organization.custom_domain
        ? `https://${organization.custom_domain}/producto/${product.slug || product.id}`
        : `${protocol}://${host}/producto/${product.slug || product.id}`

    return (
        <>
            <ProductJsonLd
                product={product}
                organization={organization}
                url={productUrl}
                productWithVariants={productWithVariants}
                reviews={reviews}
                reviewSummary={reviewSummary}
            />
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
                    relatedProducts={relatedProducts}
                    slug={organization.slug}
                    initialIsSubdomain={initialIsSubdomain}
                    reviews={reviews}
                    reviewSummary={reviewSummary}
                    shippingConfig={shippingConfig}
                />
            </StoreLayoutClient>
        </>
    )
}
