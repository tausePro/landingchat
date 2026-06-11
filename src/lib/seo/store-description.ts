/**
 * Meta description de fallback para storefronts sin `seo_description`.
 *
 * Caso real (Goldcaps, 2026-06-11): con el fallback genérico "Bienvenido a
 * la tienda de X." Google lo descartó por pobre y rellenó el Knowledge
 * Panel con copy ajeno (el de la plataforma). Este fallback se construye
 * con DATOS REALES del catálogo (categorías más frecuentes) — nunca
 * inventa claims (envíos, descuentos, ubicación).
 *
 * El fix de fondo sigue siendo que el merchant configure su
 * `seo_description` en Dashboard → Configuración → Organización.
 */

import type { SupportedLocale } from "@/types/organization"

interface ProductWithCategories {
    categories?: string[] | null
}

/** Top N categorías por frecuencia real en el catálogo. */
export function deriveTopCategories(products: ProductWithCategories[], limit = 3): string[] {
    const counts = new Map<string, number>()
    for (const product of products) {
        for (const category of product.categories ?? []) {
            const normalized = category.trim()
            if (!normalized) continue
            counts.set(normalized, (counts.get(normalized) ?? 0) + 1)
        }
    }
    return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([name]) => name)
}

export function buildStoreFallbackDescription(
    storeName: string,
    products: ProductWithCategories[],
    locale: SupportedLocale = "es-CO"
): string {
    const categories = deriveTopCategories(products)
    const isEnglish = locale === "en-US"

    if (categories.length === 0) {
        return isEnglish
            ? `${storeName} online store. Shop with chat support and secure checkout.`
            : `Tienda en línea de ${storeName}. Compra con atención por chat y pago seguro.`
    }

    const categoryList = categories.join(", ")
    return isEnglish
        ? `${storeName} online store: ${categoryList} and more. Shop with chat support and secure checkout.`
        : `Tienda en línea de ${storeName}: ${categoryList} y más. Compra con atención por chat y pago seguro.`
}
