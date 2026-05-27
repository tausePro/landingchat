import { buildProductWithVariants } from "@/lib/commerce/productWithVariants"
import {
  PRODUCT_WITH_VARIANTS_PRODUCT_SELECT,
  PRODUCT_WITH_VARIANTS_VARIANT_SELECT,
  normalizeProductSource,
  normalizeVariantRow,
} from "@/lib/commerce/getProductWithVariants"
import { createClient } from "@/lib/supabase/server"
import { variantSchema, type ProductVariant, type ProductWithVariantsListItem } from "@/types/product"

const MAX_PRODUCTS_LIMIT = 100

export const LIST_PRODUCTS_WITH_VARIANTS_PRODUCT_SELECT = [
  PRODUCT_WITH_VARIANTS_PRODUCT_SELECT,
  "price",
  "sale_price",
  "stock",
  "variants",
  "badge_id",
  "display_order",
  "created_at",
].join(", ")

// v1.14.5: la búsqueda FTS + filtros via RPC `search_products` requiere
// acceso a `.rpc()` en el cliente Supabase. Antes era suficiente `.from`.
// Se mantiene el alias local para no afectar a `getProductWithVariants` ni a
// otros call sites que solo lean del catálogo sin search.
export type ProductListClient = Pick<
  Awaited<ReturnType<typeof createClient>>,
  "from" | "rpc"
>

export type ProductListOrderBy = "recent" | "custom" | "price_asc" | "price_desc"

export interface ListProductsWithVariantsParams {
  organizationId: string
  client?: ProductListClient
  search?: string | null
  limit?: number
  activeOnly?: boolean
  orderBy?: ProductListOrderBy
  /** Precio mínimo inclusivo (compara contra products.price). */
  minPrice?: number | null
  /** Precio máximo inclusivo (compara contra products.price). */
  maxPrice?: number | null
  /**
   * Categorías a filtrar. El operador usado es OR (productos cuyo arreglo
   * categories se solapa con la lista pasada).
   */
  categories?: string[] | null
}

interface SearchProductsRpcRow {
  product_id: string
  rank: number
  similarity: number
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

function getLegacyVariants(product: unknown): ProductVariant[] | null {
  const record = asRecord(product)

  if (!record) {
    return null
  }

  const parsed = variantSchema.array().safeParse(record.variants)
  return parsed.success ? parsed.data : null
}

function getBadgeId(product: unknown): string | null {
  const record = asRecord(product)

  if (!record) {
    return null
  }

  return typeof record.badge_id === "string" ? record.badge_id : null
}

function sanitizePriceFilter(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  if (!Number.isFinite(value) || value < 0) return null
  return value
}

function sanitizeCategoriesFilter(value: string[] | null | undefined): string[] | null {
  if (!Array.isArray(value)) return null
  const cleaned = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0)
  return cleaned.length > 0 ? cleaned : null
}

export async function listProductsWithVariants({
  organizationId,
  client,
  search,
  limit,
  activeOnly = true,
  orderBy = "recent",
  minPrice,
  maxPrice,
  categories,
}: ListProductsWithVariantsParams): Promise<ProductWithVariantsListItem[]> {
  const supabase = client ?? await createClient()
  const sanitizedLimit = sanitizeLimit(limit)
  const trimmedSearch = search?.trim()
  const sanitizedMinPrice = sanitizePriceFilter(minPrice)
  const sanitizedMaxPrice = sanitizePriceFilter(maxPrice)
  const sanitizedCategories = sanitizeCategoriesFilter(categories)

  // ===========================================================================
  // Path A: búsqueda con texto (FTS + filtros via RPC search_products)
  // ===========================================================================
  // La RPC aplica FTS español con ts_rank, fallback fuzzy pg_trgm, y los
  // filtros opcionales (precio + categorías). Devuelve IDs ordenados por
  // relevancia. Después hacemos un SELECT regular para hidratar los datos
  // completos preservando el orden de la RPC.
  if (trimmedSearch) {
    return await listProductsBySearch({
      supabase,
      organizationId,
      search: trimmedSearch,
      limit: sanitizedLimit,
      minPrice: sanitizedMinPrice,
      maxPrice: sanitizedMaxPrice,
      categories: sanitizedCategories,
    })
  }

  // ===========================================================================
  // Path B: catálogo sin search (con o sin filtros adicionales)
  // ===========================================================================
  let query = supabase
    .from("products")
    .select(LIST_PRODUCTS_WITH_VARIANTS_PRODUCT_SELECT)
    .eq("organization_id", organizationId)

  if (activeOnly) {
    query = query.neq("is_active", false)
  }

  if (sanitizedMinPrice !== null) {
    query = query.gte("price", sanitizedMinPrice)
  }

  if (sanitizedMaxPrice !== null) {
    query = query.lte("price", sanitizedMaxPrice)
  }

  if (sanitizedCategories) {
    // overlaps() traduce al operador `&&` de Postgres en columnas array.
    query = query.overlaps("categories", sanitizedCategories)
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

  return await hydrateProductsWithVariants({
    supabase,
    organizationId,
    products,
  })
}

/**
 * Path de búsqueda con texto. Llama la RPC `search_products` y luego hace un
 * SELECT regular por IDs preservando el orden de relevancia.
 */
async function listProductsBySearch(params: {
  supabase: ProductListClient
  organizationId: string
  search: string
  limit: number
  minPrice: number | null
  maxPrice: number | null
  categories: string[] | null
}): Promise<ProductWithVariantsListItem[]> {
  const { supabase, organizationId, search, limit, minPrice, maxPrice, categories } = params

  const { data: rpcData, error: rpcError } = await supabase.rpc("search_products", {
    p_organization_id: organizationId,
    p_query: search,
    p_min_price: minPrice,
    p_max_price: maxPrice,
    p_categories: categories,
    p_limit: limit,
  })

  if (rpcError) {
    throw new Error(
      `Error searching products for organization ${organizationId}: ${rpcError.message}`,
    )
  }

  const rpcRows = Array.isArray(rpcData) ? (rpcData as SearchProductsRpcRow[]) : []

  if (rpcRows.length === 0) {
    return []
  }

  const orderedIds = rpcRows
    .map((row) => (typeof row.product_id === "string" ? row.product_id : null))
    .filter((id): id is string => id !== null)

  if (orderedIds.length === 0) {
    return []
  }

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select(LIST_PRODUCTS_WITH_VARIANTS_PRODUCT_SELECT)
    .eq("organization_id", organizationId)
    .in("id", orderedIds)

  if (productsError) {
    throw new Error(
      `Error fetching products for organization ${organizationId}: ${productsError.message}`,
    )
  }

  if (!products?.length) {
    return []
  }

  // Preservar el orden de relevancia devuelto por la RPC
  const productsById = new Map<string, unknown>()
  for (const product of products) {
    const id = getProductId(product)
    if (id) productsById.set(id, product)
  }

  const orderedProducts: unknown[] = []
  for (const id of orderedIds) {
    const product = productsById.get(id)
    if (product) orderedProducts.push(product)
  }

  return await hydrateProductsWithVariants({
    supabase,
    organizationId,
    products: orderedProducts,
  })
}

/**
 * Carga variantes y construye los objetos finales `ProductWithVariantsListItem`
 * para una lista ya ordenada de productos.
 */
async function hydrateProductsWithVariants(params: {
  supabase: ProductListClient
  organizationId: string
  products: unknown[]
}): Promise<ProductWithVariantsListItem[]> {
  const { supabase, organizationId, products } = params

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
      legacy_variants: getLegacyVariants(product),
      badge_id: getBadgeId(product),
    }
  })
}
