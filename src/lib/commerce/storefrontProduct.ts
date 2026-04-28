import { resolveLegacyVariantPriceRange } from "@/lib/commerce/legacyVariantPriceRange"
import type { ProductWithVariantsListItem, VariantPriceRange } from "@/types/product"

export interface StorefrontProduct extends Record<string, unknown> {
  id: string
  slug: string
  name: string
  description: string | null
  image_url: string
  images: string[]
  categories: string[]
  price: number
  sale_price: number | null
  price_range: VariantPriceRange
  stock: number
  badge_id: string | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function parseLegacyNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === "string")
}

function emptyPriceRange(price = 0): VariantPriceRange {
  return {
    has_range: false,
    min_price: price,
    max_price: price,
    min_compare_at: null,
    max_compare_at: null,
  }
}

export function mapLegacyProductRowToStorefrontProduct(product: unknown): StorefrontProduct | null {
  const record = asRecord(product)

  if (!record) {
    return null
  }

  const id = typeof record.id === "string" ? record.id : null
  const name = typeof record.name === "string" ? record.name : null

  if (!id || !name) {
    return null
  }

  const images = parseStringArray(record.images)
  const basePrice = parseLegacyNumber(record.price)
  const salePrice = parseLegacyNumber(record.sale_price)

  let price = 0
  let normalizedSalePrice: number | null = null

  if (basePrice != null && salePrice != null && salePrice < basePrice) {
    price = basePrice
    normalizedSalePrice = salePrice
  } else if (basePrice != null) {
    price = basePrice
  } else if (salePrice != null) {
    price = salePrice
  }

  return {
    id,
    slug: typeof record.slug === "string" && record.slug.length > 0 ? record.slug : id,
    name,
    description: typeof record.description === "string" ? record.description : null,
    image_url: typeof record.image_url === "string" ? record.image_url : images[0] ?? "",
    images,
    categories: parseStringArray(record.categories),
    price,
    sale_price: normalizedSalePrice,
    price_range: emptyPriceRange(normalizedSalePrice ?? price),
    stock: Math.max(0, Math.trunc(parseLegacyNumber(record.stock) ?? 0)),
    badge_id: typeof record.badge_id === "string" ? record.badge_id : null,
  }
}

export function resolveStorefrontProductPricing(product: ProductWithVariantsListItem): {
  price: number
  sale_price: number | null
} {
  const defaultVariant = product.default_variant

  if (
    defaultVariant?.compare_at_price != null
    && defaultVariant.compare_at_price > defaultVariant.price
  ) {
    return {
      price: defaultVariant.compare_at_price,
      sale_price: defaultVariant.price,
    }
  }

  if (
    defaultVariant
    && product.legacy_price != null
    && product.legacy_sale_price != null
    && product.legacy_sale_price < product.legacy_price
    && defaultVariant.price === product.legacy_sale_price
  ) {
    return {
      price: product.legacy_price,
      sale_price: defaultVariant.price,
    }
  }

  if (defaultVariant) {
    return {
      price: defaultVariant.price,
      sale_price: null,
    }
  }

  if (
    product.legacy_price != null
    && product.legacy_sale_price != null
    && product.legacy_sale_price < product.legacy_price
  ) {
    return {
      price: product.legacy_price,
      sale_price: product.legacy_sale_price,
    }
  }

  if (product.price_range.min_price > 0) {
    return {
      price: product.price_range.min_price,
      sale_price: null,
    }
  }

  if (product.legacy_price != null) {
    return {
      price: product.legacy_price,
      sale_price: null,
    }
  }

  if (product.legacy_sale_price != null) {
    return {
      price: product.legacy_sale_price,
      sale_price: null,
    }
  }

  return {
    price: 0,
    sale_price: null,
  }
}

function resolveStorefrontProductImage(product: ProductWithVariantsListItem): string {
  return product.default_variant?.image_url
    ?? product.image_url
    ?? product.images[0]
    ?? ""
}

function resolveStorefrontProductStock(product: ProductWithVariantsListItem): number {
  const activeVariants = product.variants.filter((variant) => variant.is_active)

  if (activeVariants.length > 0) {
    return activeVariants.reduce((total, variant) => total + Math.max(0, variant.stock_quantity), 0)
  }

  return Math.max(0, Math.trunc(product.legacy_stock ?? 0))
}

function resolveStorefrontProductPriceRange(product: ProductWithVariantsListItem, salePrice: number | null): VariantPriceRange {
  const basePrice = salePrice ?? product.legacy_sale_price ?? product.legacy_price ?? 0
  const legacyVariantPriceRange = resolveLegacyVariantPriceRange({
    variants: product.legacy_variants,
    basePrice,
  })

  if (product.price_range.has_range) {
    return product.price_range
  }

  if (legacyVariantPriceRange?.has_range) {
    return legacyVariantPriceRange
  }

  if (product.variants.length > 0 || product.default_variant) {
    return product.price_range
  }

  return legacyVariantPriceRange ?? emptyPriceRange(basePrice)
}

export function mapProductListItemToStorefrontProduct(
  product: ProductWithVariantsListItem,
): StorefrontProduct {
  const pricing = resolveStorefrontProductPricing(product)
  const priceRange = resolveStorefrontProductPriceRange(product, pricing.sale_price)

  return {
    id: product.id,
    slug: product.slug ?? product.id,
    name: product.name,
    description: product.description,
    image_url: resolveStorefrontProductImage(product),
    images: product.images,
    categories: product.categories,
    price: pricing.price,
    sale_price: pricing.sale_price,
    price_range: priceRange,
    stock: resolveStorefrontProductStock(product),
    badge_id: product.badge_id,
  }
}
