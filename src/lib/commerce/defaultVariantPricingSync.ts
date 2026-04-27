export interface LegacyDefaultVariantPricingInput {
  price?: number | null
  sale_price?: number | null
}

export interface DefaultVariantPricingSyncResult {
  price: number
  compare_at_price: number | null
}

function normalizePrice(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null
  }

  return value
}

export function resolveDefaultVariantPricingSync(
  input: LegacyDefaultVariantPricingInput,
): DefaultVariantPricingSyncResult {
  const legacyPrice = normalizePrice(input.price) ?? 0
  const legacySalePrice = normalizePrice(input.sale_price)
  const hasValidSalePrice = legacySalePrice !== null && legacySalePrice > 0 && legacySalePrice < legacyPrice

  return {
    price: hasValidSalePrice ? legacySalePrice : legacyPrice,
    compare_at_price: hasValidSalePrice ? legacyPrice : null,
  }
}
