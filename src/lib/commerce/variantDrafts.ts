import type { ProductVariant, VariantOptionValue } from "@/types/product"

export interface ExpandLegacyVariantsInput {
  productName?: string | null
  basePrice?: number | null
  baseCompareAtPrice?: number | null
  baseStock?: number | null
  baseSku?: string | null
  baseImageUrl?: string | null
  baseIsActive?: boolean | null
  legacyVariants: ProductVariant[]
}

export interface ProductVariantDraft {
  title: string
  sku: string | null
  position: number
  is_default: boolean
  is_active: boolean
  price: number
  compare_at_price: number | null
  stock_quantity: number
  image_url: string | null
  option_values: VariantOptionValue[]
}

interface NormalizedLegacyVariant {
  type: string
  values: string[]
  priceAdjustments: Record<string, number>
  stockByVariant: Record<string, number>
  images: Record<string, string | string[]>
  hasStockByVariant: boolean
  hasImageMapping: boolean
}

function normalizeNonNegativeNumber(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null
  }

  return value
}

function normalizeFiniteNumber(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null
  }

  return value
}

function normalizeOptionValues(values: string[]): string[] {
  const seen = new Set<string>()
  const normalized: string[] = []

  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed || seen.has(trimmed)) {
      continue
    }

    seen.add(trimmed)
    normalized.push(trimmed)
  }

  return normalized
}

function normalizeLegacyVariant(variant: ProductVariant): NormalizedLegacyVariant | null {
  const type = variant.type.trim()
  const values = normalizeOptionValues(variant.values)

  if (!type || values.length === 0) {
    return null
  }

  return {
    type,
    values,
    priceAdjustments: variant.priceAdjustments ?? {},
    stockByVariant: variant.stockByVariant ?? {},
    images: variant.images ?? {},
    hasStockByVariant: variant.hasStockByVariant ?? false,
    hasImageMapping: variant.hasImageMapping ?? false,
  }
}

function buildCombinations(
  variants: NormalizedLegacyVariant[],
): VariantOptionValue[][] {
  return variants.reduce<VariantOptionValue[][]>(
    (combinations, variant) => combinations.flatMap((combination) => (
      variant.values.map((value) => [
        ...combination,
        { option_name: variant.type, value },
      ])
    )),
    [[]],
  )
}

function resolvePrice(
  basePrice: number,
  variants: NormalizedLegacyVariant[],
  optionValues: VariantOptionValue[],
): number {
  const adjustment = optionValues.reduce((total, optionValue) => {
    const variant = variants.find((candidate) => candidate.type === optionValue.option_name)
    const valueAdjustment = variant?.priceAdjustments[optionValue.value]
    return total + (normalizeFiniteNumber(valueAdjustment) ?? 0)
  }, 0)

  return Math.max(0, basePrice + adjustment)
}

function resolveCompareAtPrice(
  baseCompareAtPrice: number | null,
  price: number,
  variants: NormalizedLegacyVariant[],
  optionValues: VariantOptionValue[],
): number | null {
  if (baseCompareAtPrice === null) {
    return null
  }

  const adjustment = optionValues.reduce((total, optionValue) => {
    const variant = variants.find((candidate) => candidate.type === optionValue.option_name)
    const valueAdjustment = variant?.priceAdjustments[optionValue.value]
    return total + (normalizeFiniteNumber(valueAdjustment) ?? 0)
  }, 0)
  const compareAtPrice = baseCompareAtPrice + adjustment

  return compareAtPrice > price ? compareAtPrice : null
}

function resolveStock(
  baseStock: number,
  variants: NormalizedLegacyVariant[],
  optionValues: VariantOptionValue[],
): number {
  const explicitStocks = optionValues.flatMap((optionValue) => {
    const variant = variants.find((candidate) => candidate.type === optionValue.option_name)
    const stock = variant?.hasStockByVariant ? variant.stockByVariant[optionValue.value] : undefined
    const normalizedStock = normalizeNonNegativeNumber(stock)
    return normalizedStock === null ? [] : [Math.floor(normalizedStock)]
  })

  if (explicitStocks.length === 0) {
    return Math.floor(baseStock)
  }

  return Math.min(...explicitStocks)
}

function resolveImageUrl(
  baseImageUrl: string | null,
  variants: NormalizedLegacyVariant[],
  optionValues: VariantOptionValue[],
): string | null {
  for (const optionValue of optionValues) {
    const variant = variants.find((candidate) => candidate.type === optionValue.option_name)
    const imageValue = variant?.hasImageMapping ? variant.images[optionValue.value] : undefined

    if (Array.isArray(imageValue) && imageValue[0]) {
      return imageValue[0]
    }

    if (typeof imageValue === "string" && imageValue) {
      return imageValue
    }
  }

  return baseImageUrl
}

export function expandLegacyVariantsToVariantDrafts(
  input: ExpandLegacyVariantsInput,
): ProductVariantDraft[] {
  const basePrice = normalizeNonNegativeNumber(input.basePrice) ?? 0
  const normalizedCompareAtPrice = normalizeNonNegativeNumber(input.baseCompareAtPrice)
  const baseCompareAtPrice = normalizedCompareAtPrice !== null && normalizedCompareAtPrice > basePrice
    ? normalizedCompareAtPrice
    : null
  const baseStock = Math.floor(normalizeNonNegativeNumber(input.baseStock) ?? 0)
  const baseTitle = input.productName?.trim() || "Default"
  const baseImageUrl = input.baseImageUrl?.trim() || null
  const baseIsActive = input.baseIsActive ?? true
  const normalizedVariants = input.legacyVariants
    .map((variant) => normalizeLegacyVariant(variant))
    .filter((variant): variant is NormalizedLegacyVariant => variant !== null)

  if (normalizedVariants.length === 0) {
    return [{
      title: baseTitle,
      sku: input.baseSku?.trim() || null,
      position: 0,
      is_default: true,
      is_active: baseIsActive,
      price: basePrice,
      compare_at_price: baseCompareAtPrice,
      stock_quantity: baseStock,
      image_url: baseImageUrl,
      option_values: [],
    }]
  }

  return buildCombinations(normalizedVariants).map((optionValues, position) => {
    const price = resolvePrice(basePrice, normalizedVariants, optionValues)

    return {
      title: optionValues.map((optionValue) => optionValue.value).join(" / "),
      sku: position === 0 ? input.baseSku?.trim() || null : null,
      position,
      is_default: position === 0,
      is_active: baseIsActive,
      price,
      compare_at_price: resolveCompareAtPrice(baseCompareAtPrice, price, normalizedVariants, optionValues),
      stock_quantity: resolveStock(baseStock, normalizedVariants, optionValues),
      image_url: resolveImageUrl(baseImageUrl, normalizedVariants, optionValues),
      option_values: optionValues,
    }
  })
}
