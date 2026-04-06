/**
 * Resolver variant-centric de pricing — Commerce Core Reset (Fase 1)
 *
 * Ref: docs-private/RFC_PRICING_VARIANTS_PROMOTIONS.md §7
 *
 * Este resolver opera exclusivamente sobre variantes vendibles reales.
 * NO usa offsets, NO hereda sale_price globales, NO inventa reglas implícitas.
 *
 * Algoritmo (RFC §7.1):
 *   1. Tomar variant.price como precio de catálogo
 *   2. Tomar variant.compare_at_price solo si > price
 *   3. Evaluar quantity tiers si aplican (solo variante default en v1)
 *   4. Evaluar promociones elegibles
 *   5. Elegir la mejor promoción
 *   6. Calcular final_price y compare_at_to_show
 *
 * Restricciones v1 (RFC §7.2):
 *   - Quantity pricing solo para variantes default (producto simple)
 *   - No stacking de promociones
 *   - No herencia de descuentos globales a variantes por offset
 */

import type {
  NormalizedPromotion,
  ProductVariantRow,
  VariantResolvedPricing,
  VariantPriceRange,
} from "@/types/product"

// Re-exportar PriceTier del módulo legacy para reutilizar el tipo existente
import type { PriceTier } from "@/types/product"

// ============================================================================
// Utilidades internas
// ============================================================================

function roundPrice(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

// ============================================================================
// Quantity tiers
// ============================================================================

/**
 * Encuentra el tier de precio aplicable para una cantidad dada.
 * Reutiliza la lógica existente pero como función pura sin dependencias legacy.
 */
export function findApplicableTier(
  tiers: PriceTier[] | null | undefined,
  quantity: number,
): PriceTier | null {
  if (!tiers?.length || quantity < 1) return null

  const sorted = [...tiers].sort((a, b) => b.min_quantity - a.min_quantity)
  return sorted.find((tier) => {
    const withinMin = quantity >= tier.min_quantity
    const withinMax = tier.max_quantity == null || quantity <= tier.max_quantity
    return withinMin && withinMax
  }) ?? null
}

// ============================================================================
// Promociones
// ============================================================================

/**
 * Determina si una promoción aplica a una variante/producto dado.
 * Usa scopes canónicos del RFC §6.3: 'all' | 'product' | 'variant' | 'category'
 */
export function doesPromotionApply(
  promotion: NormalizedPromotion,
  context: {
    product_id: string
    variant_id: string
    category_ids?: string[]
  },
): boolean {
  if (!promotion.is_active) return false

  // Validar vigencia temporal si hay fechas
  if (promotion.start_date || promotion.end_date) {
    const now = new Date()
    if (promotion.start_date && now < new Date(promotion.start_date)) return false
    if (promotion.end_date && now > new Date(promotion.end_date)) return false
  }

  switch (promotion.applies_to) {
    case 'all':
      return true
    case 'product':
      return promotion.target_ids.includes(context.product_id)
    case 'variant':
      return promotion.target_ids.includes(context.variant_id)
    case 'category':
      return context.category_ids?.some((catId) => promotion.target_ids.includes(catId)) ?? false
    default:
      return false
  }
}

/**
 * Calcula el precio descontado por una promoción.
 */
function applyPromotionDiscount(basePrice: number, promotion: NormalizedPromotion): number {
  if (promotion.type === 'percentage') {
    return roundPrice(basePrice * (1 - promotion.value / 100))
  }
  if (promotion.type === 'fixed') {
    return roundPrice(Math.max(0, basePrice - promotion.value))
  }
  return basePrice
}

// ============================================================================
// Resolver principal
// ============================================================================

export interface ResolveVariantPricingOptions {
  /** Promociones activas candidatas */
  promotions?: NormalizedPromotion[]
  /** Cantidad para evaluar quantity tiers */
  quantity?: number
  /** IDs de categorías del producto (para promociones por categoría) */
  category_ids?: string[]
  /** Price tiers (solo aplicables a variante default en v1) */
  price_tiers?: PriceTier[] | null
  /** Si el producto tiene quantity pricing habilitado */
  has_quantity_pricing?: boolean
}

/**
 * Resuelve el precio final de una variante vendible.
 *
 * No usa offsets. No hereda sale_price. No inventa reglas.
 * Opera exclusivamente con datos explícitos de la variante.
 */
export function resolveVariantPricing(
  variant: Pick<ProductVariantRow, 'id' | 'product_id' | 'price' | 'compare_at_price'>,
  options?: ResolveVariantPricingOptions,
): VariantResolvedPricing {
  const quantity = options?.quantity ?? 1
  const promotions = options?.promotions ?? []
  const categoryIds = options?.category_ids ?? []
  const priceTiers = options?.price_tiers
  const hasQuantityPricing = options?.has_quantity_pricing ?? false

  // 1. Precio de catálogo de la variante
  const catalogPrice = roundPrice(variant.price)

  // 2. Compare-at solo si es mayor que price
  const compareAtPrice =
    variant.compare_at_price != null && variant.compare_at_price > catalogPrice
      ? roundPrice(variant.compare_at_price)
      : null

  // 3. Evaluar quantity tier (solo para variantes default en v1)
  let tierPrice: number | null = null
  if (hasQuantityPricing && priceTiers?.length) {
    const tier = findApplicableTier(priceTiers, quantity)
    if (tier) {
      tierPrice = roundPrice(tier.unit_price)
    }
  }

  // Precio base antes de promociones: tier > catalog
  const priceBeforePromotion = tierPrice ?? catalogPrice

  // 4-5. Evaluar promociones elegibles y elegir la mejor
  let bestPromotion: NormalizedPromotion | null = null
  let promotionPrice: number | null = null

  for (const promotion of promotions) {
    if (!doesPromotionApply(promotion, {
      product_id: variant.product_id,
      variant_id: variant.id,
      category_ids: categoryIds,
    })) {
      continue
    }

    const discounted = applyPromotionDiscount(priceBeforePromotion, promotion)

    if (discounted < priceBeforePromotion && (promotionPrice === null || discounted < promotionPrice)) {
      promotionPrice = discounted
      bestPromotion = promotion
    }
  }

  // 6. Calcular final_price y compare_at_to_show
  let finalPrice: number
  let source: VariantResolvedPricing['source']
  let compareAtToShow: number | null

  if (promotionPrice !== null && promotionPrice < priceBeforePromotion) {
    // Promoción activa: mostrar precio promocional, tachar precio antes de promoción
    finalPrice = promotionPrice
    source = 'promotion'
    compareAtToShow = roundPrice(priceBeforePromotion)
  } else if (tierPrice !== null && tierPrice < catalogPrice) {
    // Tier activo sin promoción: mostrar tier, tachar catálogo
    finalPrice = tierPrice
    source = 'tier'
    compareAtToShow = roundPrice(catalogPrice)
  } else {
    // Sin descuento: mostrar catálogo, tachar compare_at si existe
    finalPrice = catalogPrice
    source = 'catalog'
    compareAtToShow = compareAtPrice
  }

  return {
    variant_id: variant.id,
    price: catalogPrice,
    compare_at_price: compareAtPrice,
    promotion_price: promotionPrice,
    final_price: finalPrice,
    compare_at_to_show: compareAtToShow,
    tier_price: tierPrice,
    source,
    active_promotion: bestPromotion,
  }
}

// ============================================================================
// Rango de precios
// ============================================================================

/**
 * Calcula el rango de precios para un producto con múltiples variantes.
 * Ref: RFC §5.5 — Solo mostrar rango cuando no hay selección cerrada.
 */
export function getVariantPriceRange(
  variants: Pick<ProductVariantRow, 'id' | 'product_id' | 'price' | 'compare_at_price' | 'is_active'>[],
  options?: Omit<ResolveVariantPricingOptions, 'price_tiers' | 'has_quantity_pricing'>,
): VariantPriceRange {
  const activeVariants = variants.filter((v) => v.is_active)

  if (activeVariants.length === 0) {
    return {
      has_range: false,
      min_price: 0,
      max_price: 0,
      min_compare_at: null,
      max_compare_at: null,
    }
  }

  const resolvedPrices = activeVariants.map((v) =>
    resolveVariantPricing(v, {
      promotions: options?.promotions,
      quantity: options?.quantity,
      category_ids: options?.category_ids,
    }),
  )

  const finalPrices = resolvedPrices.map((r) => r.final_price)
  const compareAts = resolvedPrices
    .map((r) => r.compare_at_to_show)
    .filter((p): p is number => p != null)

  const minPrice = Math.min(...finalPrices)
  const maxPrice = Math.max(...finalPrices)

  return {
    has_range: minPrice !== maxPrice,
    min_price: minPrice,
    max_price: maxPrice,
    min_compare_at: compareAts.length > 0 ? Math.min(...compareAts) : null,
    max_compare_at: compareAts.length > 0 ? Math.max(...compareAts) : null,
  }
}
