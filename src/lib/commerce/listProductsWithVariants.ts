import { buildProductWithVariants } from "@/lib/commerce/productWithVariants"
import {
  PRODUCT_WITH_VARIANTS_PRODUCT_SELECT,
  PRODUCT_WITH_VARIANTS_VARIANT_SELECT,
  normalizeProductSource,
  normalizeVariantRow,
  type ProductWithVariantsClient,
} from "@/lib/commerce/getProductWithVariants"
import { createClient } from "@/lib/supabase/server"
import type { ProductWithVariantsListItem } from "@/types/product"

const MAX_PRODUCTS_LIMIT = 100

export const LIST_PRODUCTS_WITH_VARIANTS_PRODUCT_SELECT = [
  PRODUCT_WITH_VARIANTS_PRODUCT_SELECT,
  "price",
  "sale_price",
  "stock",
  "badge_id",
  "display_order",
  "created_at",
].join(", ")

export type ProductListOrderBy = "recent" | "custom" | "price_asc" | "price_desc"

export interface ListProductsWithVariantsParams {
  organizationId: string
  client?: ProductWithVariantsClient
  search?: string | null
  limit?: number
  activeOnly?: boolean
  orderBy?: ProductListOrderBy
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

function sanitizeLimit(limit?: number): number {
  if (!limit || !Number.isFinite(limit) || limit < 1) {
    return 20
  }

  return Math.min(Math.trunc(limit), MAX_PRODUCTS_LIMIT)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function getProductId(product: unknown): string | null {
  const record = asRecord(product)

  if (!record) {
    return null
  }

  return typeof record.id === "string" ? record.id : null
}

function getLegacyPrice(product: unknown): number | null {
  const record = asRecord(product)

  if (!record) {
    return null
  }

  return parseLegacyNumber(record.price)
}

function getLegacySalePrice(product: unknown): number | null {
  const record = asRecord(product)

  if (!record) {
    return null
  }

  return parseLegacyNumber(record.sale_price)
}

function getLegacyStock(product: unknown): number | null {
  const record = asRecord(product)

  if (!record) {
    return null
  }

  return parseLegacyNumber(record.stock)
}

function getBadgeId(product: unknown): string | null {
  const record = asRecord(product)

  if (!record) {
    return null
  }

  return typeof record.badge_id === "string" ? record.badge_id : null
}

export async function listProductsWithVariants({
  organizationId,
  client,
  search,
  limit,
  activeOnly = true,
  orderBy = "recent",
}: ListProductsWithVariantsParams): Promise<ProductWithVariantsListItem[]> {
  const supabase = client ?? await createClient()
  const sanitizedLimit = sanitizeLimit(limit)
  const trimmedSearch = search?.trim()

  let query = supabase
    .from("products")
    .select(LIST_PRODUCTS_WITH_VARIANTS_PRODUCT_SELECT)
    .eq("organization_id", organizationId)

  if (activeOnly) {
    query = query.neq("is_active", false)
  }

  if (trimmedSearch) {
    query = query.or(`name.ilike.%${trimmedSearch}%,description.ilike.%${trimmedSearch}%`)
  }

  if (orderBy === "custom") {
    query = query.order("display_order", { ascending: true }).order("created_at", { ascending: false })
  } else if (orderBy === "price_asc") {
    query = query.order("price", { ascending: true })
  } else if (orderBy === "price_desc") {
    query = query.order("price", { ascending: false })
  } else {
    query = query.order("created_at", { ascending: false })
  }

  const { data: products, error: productsError } = await query
    .limit(sanitizedLimit)

  if (productsError) {
    throw new Error(`Error fetching products for organization ${organizationId}: ${productsError.message}`)
  }

  if (!products?.length) {
    return []
  }

  const productIds = products
    .map((product) => getProductId(product))
    .filter((productId): productId is string => productId != null)

  if (productIds.length === 0) {
    return []
  }

  const { data: variants, error: variantsError } = await supabase
    .from("product_variants")
    .select(PRODUCT_WITH_VARIANTS_VARIANT_SELECT)
    .eq("organization_id", organizationId)
    .in("product_id", productIds)

  if (variantsError) {
    throw new Error(`Error fetching product variants for organization ${organizationId}: ${variantsError.message}`)
  }

  const variantsByProductId = new Map<string, ReturnType<typeof normalizeVariantRow>[]>()

  for (const variant of variants ?? []) {
    const normalizedVariant = normalizeVariantRow(variant)
    const existing = variantsByProductId.get(normalizedVariant.product_id)

    if (existing) {
      existing.push(normalizedVariant)
    } else {
      variantsByProductId.set(normalizedVariant.product_id, [normalizedVariant])
    }
  }

  return products.map((product) => {
    const normalizedProduct = normalizeProductSource(product)
    const productWithVariants = buildProductWithVariants(
      normalizedProduct,
      variantsByProductId.get(normalizedProduct.id) ?? [],
    )

    return {
      ...productWithVariants,
      legacy_price: getLegacyPrice(product),
      legacy_sale_price: getLegacySalePrice(product),
      legacy_stock: getLegacyStock(product),
      badge_id: getBadgeId(product),
    }
  })
}
