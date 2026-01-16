import { notFound } from "next/navigation"
import { Metadata } from "next"
import { StoreLayoutClient } from "../../store-layout-client"
import { getProductDetails } from "../../actions"
import { ProductDetailClient } from "./product-detail-client"
import { ProductJsonLd } from "@/components/seo/product-json-ld"
import { headers } from "next/headers"
import { isSubdomain } from "@/lib/utils/store-urls"

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

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
    const { slug, slugOrId } = await params

    const headersList = await headers()
    const host = headersList.get("host") || ""
    const protocol = host.includes("localhost") ? "http" : "https"
    const initialIsSubdomain = isSubdomain(host)

    const data = await getProductDetails(slug, slugOrId)

    if (!data) notFound()

    const { organization, product, badges, promotions, relatedProducts } = data

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
                />
            </StoreLayoutClient>
        </>
    )
}
