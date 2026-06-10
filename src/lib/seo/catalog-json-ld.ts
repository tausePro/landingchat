/**
 * ItemList JSON-LD para la página de catálogo (/productos).
 *
 * Le da a buscadores y AI engines la estructura del catálogo del tenant
 * con las URLs canónicas de cada producto (AEO/GEO). Builder puro,
 * testeable sin Next.
 */

import { buildStoreCanonicalUrl } from "./site-discovery"

export interface CatalogJsonLdProduct {
    id: string
    slug?: string | null
    name: string
}

export function buildCatalogItemListJsonLd(
    organization: { slug: string; custom_domain?: string | null },
    products: CatalogJsonLdProduct[]
) {
    return {
        "@context": "https://schema.org",
        "@type": "ItemList",
        numberOfItems: products.length,
        itemListElement: products.map((product, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: product.name,
            url: buildStoreCanonicalUrl(organization, `/producto/${product.slug || product.id}`),
        })),
    }
}
