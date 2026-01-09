/**
 * JSON-LD Schema.org para productos
 * Mejora SEO y permite que motores de búsqueda e IA entiendan el catálogo
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
}

export function ProductJsonLd({ product, organization, url }: ProductJsonLdProps) {
    const images = product.images?.length 
        ? product.images 
        : product.image_url 
            ? [product.image_url] 
            : []

    const productSchema = {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description: product.meta_description || product.description || `${product.name} - Disponible en ${organization.name}`,
        image: images,
        sku: product.sku || product.id,
        brand: product.brand ? {
            "@type": "Brand",
            name: product.brand
        } : {
            "@type": "Brand",
            name: organization.name
        },
        offers: {
            "@type": "Offer",
            url: url,
            priceCurrency: "COP",
            price: product.sale_price || product.price,
            priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            availability: product.stock > 0 
                ? "https://schema.org/InStock" 
                : "https://schema.org/OutOfStock",
            seller: {
                "@type": "Organization",
                name: organization.name
            }
        },
        ...(product.categories?.length && {
            category: product.categories.join(" > ")
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
