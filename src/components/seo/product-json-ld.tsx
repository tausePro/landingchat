import { stripHtml } from "@/lib/utils/stripHtml"
import type { ProductReview, ProductReviewSummary, ProductVariantRow, ProductWithVariantsReadModel } from "@/types/product"

/**
 * JSON-LD Schema.org para productos
 * Mejora SEO y permite que motores de búsqueda e IA entiendan el catálogo
 * Incluye aggregateRating y review[] cuando hay reseñas publicadas para mostrar estrellas en Google
 */

interface ProductJsonLdProps {
    product: {
        id: string
        name: string
        description?: string | null
        price: number
        sale_price?: number | null
        image_url?: string | null
        images?: string[]
        sku?: string | null
        stock: number
        brand?: string | null
        categories?: string[]
        meta_title?: string | null
        meta_description?: string | null
        faq?: { question: string; answer: string }[] | null
        specifications?: { label: string; value: string }[] | null
    }
    organization: {
        name: string
        slug: string
        logo_url?: string | null
        custom_domain?: string | null
    }
    url: string
    productWithVariants?: ProductWithVariantsReadModel | null
    reviews?: ProductReview[] | null
    reviewSummary?: ProductReviewSummary | null
}

function buildSellerSchema(organization: ProductJsonLdProps["organization"]) {
    return {
        "@type": "Organization",
        name: organization.name
    }
}

function buildAvailability(stock: number) {
    return stock > 0
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock"
}

function buildVariantName(productName: string, variantTitle: string) {
    const normalizedTitle = variantTitle.trim()
    if (!normalizedTitle || normalizedTitle.toLowerCase() === "default") {
        return productName
    }

    return `${productName} - ${normalizedTitle}`
}

function buildVariantImages(product: ProductJsonLdProps["product"], variant: ProductVariantRow) {
    if (variant.image_url) {
        return [variant.image_url]
    }

    if (product.images?.length) {
        return product.images
    }

    return product.image_url ? [product.image_url] : []
}

function buildVariesBy(productWithVariants?: ProductWithVariantsReadModel | null) {
    const optionNames = productWithVariants?.variants
        .filter(variant => variant.is_active)
        .flatMap(variant => variant.option_values.map(optionValue => optionValue.option_name.trim()).filter(Boolean)) ?? []

    return Array.from(new Set(optionNames))
}

function buildVariantSchemas({
    product,
    organization,
    url,
    productWithVariants,
}: ProductJsonLdProps) {
    const activeVariants = productWithVariants?.variants.filter(variant => variant.is_active) ?? []
    if (activeVariants.length < 2) return undefined

    const seller = buildSellerSchema(organization)

    return activeVariants.map(variant => ({
        "@type": "Product",
        "@id": `${url}#variant-${variant.id}`,
        name: buildVariantName(product.name, variant.title),
        productID: variant.id,
        sku: variant.sku || undefined,
        image: buildVariantImages(product, variant),
        isVariantOf: {
            "@type": "ProductGroup",
            "@id": `${url}#product-group`,
            productGroupID: product.id,
            name: product.name,
        },
        offers: {
            "@type": "Offer",
            url,
            priceCurrency: "COP",
            price: variant.price,
            availability: buildAvailability(variant.stock_quantity),
            seller,
        },
        ...(variant.option_values.length > 0 && {
            additionalProperty: variant.option_values.map(optionValue => ({
                "@type": "PropertyValue",
                name: optionValue.option_name,
                value: optionValue.value,
            })),
        }),
    }))
}

function buildOffersSchema({
    product,
    organization,
    url,
    productWithVariants,
}: ProductJsonLdProps) {
    const seller = buildSellerSchema(organization)

    if (productWithVariants?.price_range.has_range) {
        const activeVariants = productWithVariants.variants.filter(variant => variant.is_active)
        const hasAvailableStock = activeVariants.some(variant => variant.stock_quantity > 0)

        return {
            "@type": "AggregateOffer",
            url,
            priceCurrency: "COP",
            lowPrice: productWithVariants.price_range.min_price,
            highPrice: productWithVariants.price_range.max_price,
            offerCount: activeVariants.length || productWithVariants.variants.length,
            availability: buildAvailability(hasAvailableStock ? 1 : 0),
            seller
        }
    }

    const defaultVariant = productWithVariants?.default_variant
    const resolvedPrice = defaultVariant?.price ?? (product.sale_price || product.price)
    const resolvedStock = defaultVariant?.stock_quantity ?? product.stock

    return {
        "@type": "Offer",
        url,
        priceCurrency: "COP",
        price: resolvedPrice,
        priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        availability: buildAvailability(resolvedStock),
        seller
    }
}

export function buildProductJsonLdData({ product, organization, url, productWithVariants, reviews, reviewSummary }: ProductJsonLdProps) {
    const defaultVariant = productWithVariants?.default_variant
    const variantSchemas = buildVariantSchemas({ product, organization, url, productWithVariants, reviews, reviewSummary })
    const variesBy = buildVariesBy(productWithVariants)
    const images = product.images?.length
        ? product.images
        : defaultVariant?.image_url
            ? [defaultVariant.image_url]
            : product.image_url
                ? [product.image_url]
                : []

    const cleanDescription = stripHtml(product.meta_description || product.description)

    // Estructurar reseñas para schema.org/Review (máximo 3 para no inflar el JSON)
    const structuredReviews = reviews
        ?.filter((review) => review.author_name?.trim() && review.content?.trim() && review.rating >= 1 && review.rating <= 5)
        .slice(0, 3)
        .map((review) => ({
            "@type": "Review",
            author: {
                "@type": "Person",
                name: review.author_name,
            },
            reviewRating: {
                "@type": "Rating",
                ratingValue: review.rating,
                bestRating: 5,
                worstRating: 1,
            },
            name: review.title || undefined,
            reviewBody: review.content,
            datePublished: (review.published_at || review.created_at)?.split("T")[0],
        }))

    const productSchema = {
        "@context": "https://schema.org",
        "@type": variantSchemas?.length ? "ProductGroup" : "Product",
        ...(variantSchemas?.length && {
            "@id": `${url}#product-group`,
            productGroupID: product.id,
            hasVariant: variantSchemas,
        }),
        ...(variantSchemas?.length && variesBy.length > 0 && {
            variesBy,
        }),
        name: product.name,
        description: cleanDescription || `${product.name} - Disponible en ${organization.name}`,
        image: images,
        sku: defaultVariant?.sku || product.sku || product.id,
        brand: product.brand ? {
            "@type": "Brand",
            name: product.brand
        } : {
            "@type": "Brand",
            name: organization.name
        },
        offers: buildOffersSchema({ product, organization, url, productWithVariants }),
        ...(product.categories?.length && {
            category: product.categories.join(" > ")
        }),
        ...(reviewSummary && reviewSummary.reviewCount > 0 && {
            aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: reviewSummary.averageRating,
                reviewCount: reviewSummary.reviewCount,
                bestRating: 5,
                worstRating: 1,
            }
        }),
        ...(structuredReviews && structuredReviews.length > 0 && {
            review: structuredReviews,
        }),
        ...(product.specifications?.length && {
            additionalProperty: product.specifications.map(spec => ({
                "@type": "PropertyValue",
                name: spec.label,
                value: spec.value
            }))
        })
    }

    // Schema FAQPage si el producto tiene FAQs
    const faqSchema = product.faq?.length ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: product.faq.map(item => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: {
                "@type": "Answer",
                text: item.answer
            }
        }))
    } : null

    // BreadcrumbList para navegación
    const breadcrumbSchema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            {
                "@type": "ListItem",
                position: 1,
                name: organization.name,
                item: url.split('/producto')[0] || url.split('/p/')[0]
            },
            ...(product.categories?.length ? [{
                "@type": "ListItem",
                position: 2,
                name: product.categories[0],
                item: `${url.split('/producto')[0] || url.split('/p/')[0]}/productos?categoria=${encodeURIComponent(product.categories[0])}`
            }] : []),
            {
                "@type": "ListItem",
                position: product.categories?.length ? 3 : 2,
                name: product.name,
                item: url
            }
        ]
    }

    return {
        productSchema,
        faqSchema,
        breadcrumbSchema,
    }
}

export function ProductJsonLd({ product, organization, url, productWithVariants, reviews, reviewSummary }: ProductJsonLdProps) {
    const { productSchema, faqSchema, breadcrumbSchema } = buildProductJsonLdData({
        product,
        organization,
        url,
        productWithVariants,
        reviews,
        reviewSummary,
    })

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
            />
            {faqSchema && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
                />
            )}
        </>
    )
}
