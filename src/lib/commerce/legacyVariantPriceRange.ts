import type { ProductVariant, VariantPriceRange } from "@/types/product"

function parseFiniteNonNegativeNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null
  }

  return value
}

function uniqueNumbers(values: number[]): number[] {
  return Array.from(new Set(values))
}

function buildRangeFromPrices(prices: number[]): VariantPriceRange | null {
  const normalizedPrices = uniqueNumbers(prices)

  if (normalizedPrices.length === 0) {
    return null
  }

  const minPrice = Math.min(...normalizedPrices)
  const maxPrice = Math.max(...normalizedPrices)

  return {
    has_range: minPrice !== maxPrice,
    min_price: minPrice,
    max_price: maxPrice,
    min_compare_at: null,
    max_compare_at: null,
  }
}

function collectAbsoluteVariantPrices(variants: ProductVariant[]): number[] {
  return variants.flatMap((variant) => {
    if (!variant.variantPrices) {
      return []
    }

    return Object.values(variant.variantPrices).flatMap((price) => {
      const normalizedPrice = parseFiniteNonNegativeNumber(price)
      return normalizedPrice == null ? [] : [normalizedPrice]
    })
  })
}

function collectLegacyAdjustedPrices(variants: ProductVariant[], basePrice: number): number[] {
  return variants.flatMap((variant) => {
    if (!variant.priceAdjustments) {
      return []
    }

    return Object.values(variant.priceAdjustments).flatMap((adjustment) => {
      if (typeof adjustment !== "number" || !Number.isFinite(adjustment)) {
        return []
      }

      const adjustedPrice = basePrice + adjustment
      return adjustedPrice >= 0 ? [adjustedPrice] : []
    })
  })
}

export function resolveLegacyVariantPriceRange({
  variants,
  basePrice,
}: {
  variants: ProductVariant[] | null | undefined
  basePrice: number
}): VariantPriceRange | null {
  if (!variants?.length) {
    return null
  }

  const absoluteRange = buildRangeFromPrices(collectAbsoluteVariantPrices(variants))

  if (absoluteRange) {
    return absoluteRange
  }

  return buildRangeFromPrices(collectLegacyAdjustedPrices(variants, basePrice))
}
