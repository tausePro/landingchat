import { notFound } from "next/navigation"
import { Metadata } from "next"
import { StoreLayoutClient } from "../../store-layout-client"
import { getProductDetails, getShippingConfig } from "../../actions"
import { ProductDetailClient } from "./product-detail-client"
import { ProductJsonLd } from "@/components/seo/product-json-ld"
import { headers } from "next/headers"
import { isSubdomain } from "@/lib/utils/store-urls"
import { createServiceClient } from "@/lib/supabase/server"
import { ProductUrgencyBanner } from "@/components/store/product-urgency-banner"
import { resolveProductDetailCROConfig, type ProductDetailCROSearchParams } from "@/lib/storefront/product-detail-cro"
import type { ProductReview, ProductReviewSummary } from "@/types/product"
import { formatCurrency } from "@/lib/utils"
import { getTenantLocale } from "@/lib/i18n/tenant-locale"
import { t } from "@/lib/i18n/storefront-strings"

interface ProductDetailPageProps {
    params: Promise<{ slug: string; slugOrId: string }>
    searchParams?: Promise<ProductDetailCROSearchParams>
}

// Genera metadata dinámica para SEO
export async function generateMetadata({ params }: ProductDetailPageProps): Promise<Metadata> {
    const { slug, slugOrId } = await params
    const data = await getProductDetails(slug, slugOrId)

    if (!data) {
        // Sin organización todavía: no podemos derivar locale del tenant.
        // Caemos al default seguro (es-CO) que es OK porque la pagina ya
        // termina en notFound() y solo importa para el <title> del 404.
        return {
            title: t("store.product_detail.metadata_not_found_title"),
            description: t("store.product_detail.metadata_not_found_description"),
        }
    }

    const { product, organization, productWithVariants } = data
    const defaultVariant = productWithVariants?.default_variant
    const priceRange = productWithVariants?.price_range

    // Locale + currency del tenant para formatear el priceLabel del SEO meta.
    // Tantor's House (en-US/USD) ve "$24.99" en sus meta tags vs "$ 24.000"
    // de un tenant COP. Crucial para previsualización de OG y Twitter cards.
    const tenantLocale = getTenantLocale(organization)
    const { locale, currency } = tenantLocale

    const priceLabel = priceRange?.has_range
        ? `${formatCurrency(priceRange.min_price, { locale, currency })} - ${formatCurrency(priceRange.max_price, { locale, currency })}`
        : formatCurrency(defaultVariant?.price ?? (product.sale_price || product.price), { locale, currency })
    const title = product.meta_title || `${product.name} | ${organization.name}`
    const description = product.meta_description || product.description || t("store.product_detail.metadata_default_description", locale, {
        productName: product.name,
        orgName: organization.name,
        price: priceLabel,
    })
    const images = product.images?.length
        ? product.images
        : defaultVariant?.image_url
            ? [defaultVariant.image_url]
            : product.image_url
                ? [product.image_url]
                : []

    // Construir URL canónica del producto
    const baseUrl = organization.custom_domain
        ? `https://${organization.custom_domain}`
        : `https://${organization.slug}.landingchat.co`
    const productUrl = `${baseUrl}/producto/${product.slug || slugOrId}`

    return {
        title: { absolute: title },
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
        },
        alternates: {
            canonical: productUrl,
        },
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
            .select("id, product_id, organization_id, customer_id, order_id, author_name, author_role, author_image_url, title, content, rating, verified_purchase, is_published, published_at, created_at, updated_at")
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

export default async function ProductDetailPage({ params, searchParams }: ProductDetailPageProps) {
    const { slug, slugOrId } = await params
    const resolvedSearchParams = searchParams ? await searchParams : undefined

    const headersList = await headers()
    const host = headersList.get("host") || ""
    const protocol = host.includes("localhost") ? "http" : "https"
    const initialIsSubdomain = isSubdomain(host)

    const data = await getProductDetails(slug, slugOrId)

    if (!data) notFound()

    const { organization, product, productWithVariants, viewModel, badges, promotions, relatedProducts, proactiveCouponOffer } = data
    const generatedAt = new Date().toISOString()
    const productDetailCRO = resolveProductDetailCROConfig({
        settings: organization.settings,
        product: {
            id: product.id,
            slug: product.slug,
            categories: product.categories,
        },
        searchParams: resolvedSearchParams,
        now: new Date(generatedAt),
    })

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
            {productDetailCRO?.urgencyBanner && (
                <ProductUrgencyBanner
                    desktopText={productDetailCRO.urgencyBanner.desktopText}
                    mobileText={productDetailCRO.urgencyBanner.mobileText}
                    countdownEndsAt={productDetailCRO.urgencyBanner.countdownEndsAt}
                    backgroundColor={productDetailCRO.urgencyBanner.backgroundColor}
                    textColor={productDetailCRO.urgencyBanner.textColor}
                    generatedAt={generatedAt}
                />
            )}
            <StoreLayoutClient
                slug={organization.slug}
                organization={organization}
                products={[]}
                hideNavigation={false}
                hideHeaderOnMobile={false}
                initialIsSubdomain={initialIsSubdomain}
                defaultChatProductId={product.id}
                defaultChatProductName={product.name}
                proactiveCouponOffer={proactiveCouponOffer}
                productDetailCRO={productDetailCRO}
            >
                <ProductDetailClient
                    product={product}
                    productWithVariants={productWithVariants}
                    viewModel={viewModel}
                    organization={organization}
                    badges={badges}
                    promotions={promotions}
                    relatedProducts={relatedProducts}
                    slug={organization.slug}
                    initialIsSubdomain={initialIsSubdomain}
                    reviews={reviews}
                    reviewSummary={reviewSummary}
                    shippingConfig={shippingConfig}
                    productDetailCRO={productDetailCRO}
                />
            </StoreLayoutClient>
        </>
    )
}
