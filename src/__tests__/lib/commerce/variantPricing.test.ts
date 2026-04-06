/**
 * Tests del resolver variant-centric — Commerce Core Reset (Fase 1)
 *
 * Cubre la matriz mínima de 8 casos del RFC §8:
 *   1. Producto simple sin oferta
 *   2. Producto simple con compare-at
 *   3. Producto simple con promoción
 *   4. Producto simple con quantity pricing
 *   5. Producto con variantes sin selección (rango)
 *   6. Producto con variante seleccionada
 *   7. Producto con variante + promoción
 *   8. Quantity pricing: solo variante default
 *
 * Tests adicionales:
 *   - Promociones con fechas
 *   - Promociones por categoría
 *   - Promociones por variante
 *   - Edge cases (precio 0, compare_at <= price, sin variantes activas)
 */

import { describe, it, expect } from "vitest"
import {
  resolveVariantPricing,
  getVariantPriceRange,
  findApplicableTier,
  doesPromotionApply,
} from "@/lib/commerce/variantPricing"
import type {
  ProductVariantRow,
  NormalizedPromotion,
  PriceTier,
} from "@/types/product"

// ============================================================================
// Helpers
// ============================================================================

function makeVariant(
  overrides: Partial<ProductVariantRow> = {},
): Pick<ProductVariantRow, 'id' | 'product_id' | 'price' | 'compare_at_price'> {
  return {
    id: overrides.id ?? 'variant-1',
    product_id: overrides.product_id ?? 'product-1',
    price: overrides.price ?? 48000,
    compare_at_price: overrides.compare_at_price ?? null,
  }
}

function makePromotion(
  overrides: Partial<NormalizedPromotion> = {},
): NormalizedPromotion {
  return {
    id: overrides.id ?? 'promo-1',
    applies_to: overrides.applies_to ?? 'all',
    target_ids: overrides.target_ids ?? [],
    type: overrides.type ?? 'percentage',
    value: overrides.value ?? 10,
    is_active: overrides.is_active ?? true,
    start_date: overrides.start_date ?? null,
    end_date: overrides.end_date ?? null,
  }
}

const tiers: PriceTier[] = [
  { min_quantity: 1, max_quantity: 11, unit_price: 48000, label: 'Unidad' },
  { min_quantity: 12, max_quantity: 49, unit_price: 42000, label: 'Docena' },
  { min_quantity: 50, unit_price: 38000, label: 'Mayoreo' },
]

// ============================================================================
// RFC §8 — Matriz mínima de 8 casos
// ============================================================================

describe('resolveVariantPricing — Matriz RFC §8', () => {

  // Caso 1: Producto simple sin oferta
  it('caso 1: producto simple sin oferta → mostrar price', () => {
    const variant = makeVariant({ price: 48000 })
    const result = resolveVariantPricing(variant)

    expect(result.final_price).toBe(48000)
    expect(result.compare_at_to_show).toBeNull()
    expect(result.source).toBe('catalog')
    expect(result.active_promotion).toBeNull()
    expect(result.tier_price).toBeNull()
    expect(result.promotion_price).toBeNull()
  })

  // Caso 2: Producto simple con compare-at
  it('caso 2: producto simple con compare-at → mostrar price + tachado', () => {
    const variant = makeVariant({ price: 40000, compare_at_price: 48000 })
    const result = resolveVariantPricing(variant)

    expect(result.final_price).toBe(40000)
    expect(result.price).toBe(40000)
    expect(result.compare_at_price).toBe(48000)
    expect(result.compare_at_to_show).toBe(48000)
    expect(result.source).toBe('catalog')
  })

  // Caso 3: Producto simple con promoción
  it('caso 3: producto simple con promoción → mostrar final_price + tachado sobre catalog', () => {
    const variant = makeVariant({ price: 48000 })
    const promo = makePromotion({ type: 'percentage', value: 20 })
    const result = resolveVariantPricing(variant, { promotions: [promo] })

    expect(result.final_price).toBe(38400)
    expect(result.promotion_price).toBe(38400)
    expect(result.compare_at_to_show).toBe(48000)
    expect(result.source).toBe('promotion')
    expect(result.active_promotion).toBe(promo)
  })

  // Caso 4: Producto simple con quantity pricing
  it('caso 4: producto simple con quantity pricing → mostrar precio por tier', () => {
    const variant = makeVariant({ price: 48000 })
    const result = resolveVariantPricing(variant, {
      has_quantity_pricing: true,
      price_tiers: tiers,
      quantity: 12,
    })

    expect(result.final_price).toBe(42000)
    expect(result.tier_price).toBe(42000)
    expect(result.compare_at_to_show).toBe(48000)
    expect(result.source).toBe('tier')
  })

  // Caso 5: Producto con variantes sin selección → rango
  it('caso 5: producto con variantes sin selección → rango', () => {
    const variants = [
      { id: 'v1', product_id: 'p1', price: 40000, compare_at_price: null, is_active: true },
      { id: 'v2', product_id: 'p1', price: 55000, compare_at_price: null, is_active: true },
      { id: 'v3', product_id: 'p1', price: 48000, compare_at_price: null, is_active: true },
    ]
    const range = getVariantPriceRange(variants)

    expect(range.has_range).toBe(true)
    expect(range.min_price).toBe(40000)
    expect(range.max_price).toBe(55000)
  })

  // Caso 6: Producto con variante seleccionada → precio de esa variante
  it('caso 6: variante seleccionada → precio directo sin rango', () => {
    const variant = makeVariant({ id: 'v-rojo-xl', price: 55000, compare_at_price: 65000 })
    const result = resolveVariantPricing(variant)

    expect(result.final_price).toBe(55000)
    expect(result.compare_at_to_show).toBe(65000)
    expect(result.source).toBe('catalog')
  })

  // Caso 7: Producto con variante + promoción
  it('caso 7: variante seleccionada + promoción → final_price de esa variante', () => {
    const variant = makeVariant({ id: 'v-rojo', price: 55000 })
    const promo = makePromotion({ type: 'fixed', value: 5000 })
    const result = resolveVariantPricing(variant, { promotions: [promo] })

    expect(result.final_price).toBe(50000)
    expect(result.promotion_price).toBe(50000)
    expect(result.compare_at_to_show).toBe(55000)
    expect(result.source).toBe('promotion')
  })

  // Caso 8: Quantity pricing solo aplica a variante default
  it('caso 8: quantity pricing solo funciona si has_quantity_pricing está habilitado', () => {
    const variant = makeVariant({ price: 48000 })

    // Sin has_quantity_pricing: no aplica tiers
    const withoutFlag = resolveVariantPricing(variant, {
      price_tiers: tiers,
      quantity: 50,
    })
    expect(withoutFlag.tier_price).toBeNull()
    expect(withoutFlag.final_price).toBe(48000)

    // Con has_quantity_pricing: aplica tiers
    const withFlag = resolveVariantPricing(variant, {
      has_quantity_pricing: true,
      price_tiers: tiers,
      quantity: 50,
    })
    expect(withFlag.tier_price).toBe(38000)
    expect(withFlag.final_price).toBe(38000)
    expect(withFlag.source).toBe('tier')
  })
})

// ============================================================================
// Promociones
// ============================================================================

describe('doesPromotionApply', () => {

  it('promoción "all" aplica a cualquier variante', () => {
    const promo = makePromotion({ applies_to: 'all' })
    expect(doesPromotionApply(promo, {
      product_id: 'p1', variant_id: 'v1',
    })).toBe(true)
  })

  it('promoción "product" aplica solo al producto target', () => {
    const promo = makePromotion({ applies_to: 'product', target_ids: ['p1'] })
    expect(doesPromotionApply(promo, { product_id: 'p1', variant_id: 'v1' })).toBe(true)
    expect(doesPromotionApply(promo, { product_id: 'p2', variant_id: 'v2' })).toBe(false)
  })

  it('promoción "variant" aplica solo a la variante target', () => {
    const promo = makePromotion({ applies_to: 'variant', target_ids: ['v1'] })
    expect(doesPromotionApply(promo, { product_id: 'p1', variant_id: 'v1' })).toBe(true)
    expect(doesPromotionApply(promo, { product_id: 'p1', variant_id: 'v2' })).toBe(false)
  })

  it('promoción "category" aplica si el producto tiene la categoría', () => {
    const promo = makePromotion({ applies_to: 'category', target_ids: ['cat-a'] })
    expect(doesPromotionApply(promo, {
      product_id: 'p1', variant_id: 'v1', category_ids: ['cat-a', 'cat-b'],
    })).toBe(true)
    expect(doesPromotionApply(promo, {
      product_id: 'p1', variant_id: 'v1', category_ids: ['cat-c'],
    })).toBe(false)
  })

  it('promoción inactiva no aplica', () => {
    const promo = makePromotion({ is_active: false })
    expect(doesPromotionApply(promo, { product_id: 'p1', variant_id: 'v1' })).toBe(false)
  })

  it('promoción fuera de vigencia temporal no aplica', () => {
    const futurePromo = makePromotion({
      start_date: '2099-01-01T00:00:00Z',
    })
    expect(doesPromotionApply(futurePromo, { product_id: 'p1', variant_id: 'v1' })).toBe(false)

    const expiredPromo = makePromotion({
      end_date: '2020-01-01T00:00:00Z',
    })
    expect(doesPromotionApply(expiredPromo, { product_id: 'p1', variant_id: 'v1' })).toBe(false)
  })
})

// ============================================================================
// Quantity tiers
// ============================================================================

describe('findApplicableTier', () => {

  it('devuelve null si no hay tiers', () => {
    expect(findApplicableTier(null, 10)).toBeNull()
    expect(findApplicableTier([], 10)).toBeNull()
  })

  it('devuelve el tier correcto para la cantidad', () => {
    expect(findApplicableTier(tiers, 1)?.label).toBe('Unidad')
    expect(findApplicableTier(tiers, 12)?.label).toBe('Docena')
    expect(findApplicableTier(tiers, 100)?.label).toBe('Mayoreo')
  })

  it('devuelve null si la cantidad es menor a 1', () => {
    expect(findApplicableTier(tiers, 0)).toBeNull()
  })
})

// ============================================================================
// Rango de precios
// ============================================================================

describe('getVariantPriceRange', () => {

  it('sin variantes activas devuelve rango vacío', () => {
    const range = getVariantPriceRange([])
    expect(range.has_range).toBe(false)
    expect(range.min_price).toBe(0)
    expect(range.max_price).toBe(0)
  })

  it('una sola variante no tiene rango', () => {
    const range = getVariantPriceRange([
      { id: 'v1', product_id: 'p1', price: 40000, compare_at_price: null, is_active: true },
    ])
    expect(range.has_range).toBe(false)
    expect(range.min_price).toBe(40000)
    expect(range.max_price).toBe(40000)
  })

  it('filtra variantes inactivas', () => {
    const range = getVariantPriceRange([
      { id: 'v1', product_id: 'p1', price: 10000, compare_at_price: null, is_active: false },
      { id: 'v2', product_id: 'p1', price: 40000, compare_at_price: null, is_active: true },
    ])
    expect(range.has_range).toBe(false)
    expect(range.min_price).toBe(40000)
  })

  it('incluye compare_at en el rango', () => {
    const range = getVariantPriceRange([
      { id: 'v1', product_id: 'p1', price: 40000, compare_at_price: 50000, is_active: true },
      { id: 'v2', product_id: 'p1', price: 55000, compare_at_price: 70000, is_active: true },
    ])
    expect(range.min_compare_at).toBe(50000)
    expect(range.max_compare_at).toBe(70000)
  })

  it('aplica promociones al calcular rango', () => {
    const promo = makePromotion({ type: 'percentage', value: 50 })
    const range = getVariantPriceRange(
      [
        { id: 'v1', product_id: 'p1', price: 40000, compare_at_price: null, is_active: true },
        { id: 'v2', product_id: 'p1', price: 60000, compare_at_price: null, is_active: true },
      ],
      { promotions: [promo] },
    )
    expect(range.min_price).toBe(20000) // 40000 * 50%
    expect(range.max_price).toBe(30000) // 60000 * 50%
  })
})

// ============================================================================
// Edge cases
// ============================================================================

describe('resolveVariantPricing — Edge cases', () => {

  it('compare_at_price igual a price se ignora', () => {
    const variant = makeVariant({ price: 48000, compare_at_price: 48000 })
    const result = resolveVariantPricing(variant)

    expect(result.compare_at_price).toBeNull()
    expect(result.compare_at_to_show).toBeNull()
  })

  it('compare_at_price menor a price se ignora', () => {
    const variant = makeVariant({ price: 48000, compare_at_price: 30000 })
    const result = resolveVariantPricing(variant)

    expect(result.compare_at_price).toBeNull()
    expect(result.compare_at_to_show).toBeNull()
  })

  it('promoción que no reduce precio no se aplica', () => {
    const variant = makeVariant({ price: 48000 })
    const promo = makePromotion({ type: 'fixed', value: 0 })
    const result = resolveVariantPricing(variant, { promotions: [promo] })

    expect(result.active_promotion).toBeNull()
    expect(result.source).toBe('catalog')
  })

  it('se elige la mejor promoción entre varias', () => {
    const variant = makeVariant({ price: 100000 })
    const promos = [
      makePromotion({ id: 'p1', type: 'percentage', value: 10 }), // 90000
      makePromotion({ id: 'p2', type: 'percentage', value: 30 }), // 70000
      makePromotion({ id: 'p3', type: 'fixed', value: 20000 }),    // 80000
    ]
    const result = resolveVariantPricing(variant, { promotions: promos })

    expect(result.final_price).toBe(70000)
    expect(result.active_promotion?.id).toBe('p2')
  })

  it('promoción sobre tier: se aplica descuento al precio del tier', () => {
    const variant = makeVariant({ price: 48000 })
    const promo = makePromotion({ type: 'percentage', value: 10 })
    const result = resolveVariantPricing(variant, {
      has_quantity_pricing: true,
      price_tiers: tiers,
      quantity: 50, // Tier mayoreo: 38000
      promotions: [promo],
    })

    // 10% sobre 38000 = 34200
    expect(result.final_price).toBe(34200)
    expect(result.tier_price).toBe(38000)
    expect(result.promotion_price).toBe(34200)
    expect(result.compare_at_to_show).toBe(38000)
    expect(result.source).toBe('promotion')
  })

  it('variante con compare_at + promoción: compare_at_to_show muestra precio antes de promo', () => {
    const variant = makeVariant({ price: 40000, compare_at_price: 48000 })
    const promo = makePromotion({ type: 'percentage', value: 25 })
    const result = resolveVariantPricing(variant, { promotions: [promo] })

    // 25% de 40000 = 30000
    expect(result.final_price).toBe(30000)
    // compare_at_to_show muestra el precio antes de la promoción (catalog price)
    expect(result.compare_at_to_show).toBe(40000)
    expect(result.source).toBe('promotion')
  })
})
