import { selectDefaultVariant } from "@/lib/commerce/productWithVariants"
import { resolveVariantPricing } from "@/lib/commerce/variantPricing"
import type { ProductVariantRow } from "@/types/product"

/**
 * Subconjunto de columnas del producto base que necesita la tarjeta de
 * contexto del chat. El producto se carga con `select("*")` en chat-agent,
 * así que solo tipamos lo que consumimos aquí.
 */
export interface ContextProductRow {
    id: string
    name: string
    description?: string | null
    price: number
    sale_price?: number | null
    image_url?: string | null
    images?: string[] | null
    stock?: number | null
    categories?: string[] | null
}

/**
 * Shape que espera `ChatProductCard` en el frontend para la acción
 * `show_product`. `price` es el precio regular (tachable) y `sale_price` el
 * precio final cuando hay descuento real; si no hay descuento, `sale_price`
 * es null y `price` ya es el precio que paga el cliente.
 */
export interface ContextProductCardData {
    id: string
    name: string
    description: string
    price: number
    sale_price: number | null
    image_url: string
    stock: number
    categories: string[]
}

/**
 * Construye los datos de la tarjeta de producto en contexto resolviendo el
 * precio desde la variante vendible default (fuente de verdad variant-centric,
 * RFC §7). Antes el chat usaba `product.price` (precio base, a veces
 * desactualizado) lo que generaba inconsistencia con el carrito, que sí usa el
 * precio de la variante.
 */
export function buildContextProductCardData(
    product: ContextProductRow,
    variants: ProductVariantRow[],
): ContextProductCardData {
    const defaultVariant = selectDefaultVariant(variants)

    let price: number
    let salePrice: number | null

    if (defaultVariant) {
        const pricing = resolveVariantPricing(defaultVariant)

        if (pricing.compare_at_to_show != null && pricing.compare_at_to_show > pricing.final_price) {
            // Descuento real: mostrar precio regular tachado + precio final.
            price = pricing.compare_at_to_show
            salePrice = pricing.final_price
        } else {
            // Sin descuento: el precio final ya es el precio a mostrar.
            price = pricing.final_price
            salePrice = null
        }
    } else if (product.sale_price != null && product.sale_price < product.price) {
        // Fallback legacy (producto sin variantes vendibles) con sale_price.
        price = product.price
        salePrice = product.sale_price
    } else {
        price = product.sale_price ?? product.price
        salePrice = null
    }

    const resolvedStock = variants.length > 0
        ? variants.reduce((sum, variant) => sum + Math.max(0, variant.stock_quantity), 0)
        : product.stock ?? 0

    return {
        id: product.id,
        name: product.name,
        description: product.description ?? "",
        price,
        sale_price: salePrice,
        image_url: defaultVariant?.image_url || product.image_url || product.images?.[0] || "",
        stock: resolvedStock,
        categories: product.categories ?? [],
    }
}
