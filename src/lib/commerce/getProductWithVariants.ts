import { buildProductWithVariants } from "@/lib/commerce/productWithVariants"
import { createClient } from "@/lib/supabase/server"
import type {
  PriceTier,
  ProductVariantRow,
  ProductWithVariantsReadModel,
  VariantOptionValue,
} from "@/types/product"

export const PRODUCT_WITH_VARIANTS_PRODUCT_SELECT = [
  "id",
  "organization_id",
  "name",
  "description",
  "image_url",
  "images",
  "categories",
  "is_active",
  "has_quantity_pricing",
  "price_tiers",
].join(", ")

export const PRODUCT_WITH_VARIANTS_VARIANT_SELECT = [
  "id",
  "product_id",
  "organization_id",
  "title",
  "sku",
  "position",
  "is_default",
  "is_active",
  "price",
  "compare_at_price",
  "stock_quantity",
  "image_url",
  "option_values",
  "created_at",
  "updated_at",
].join(", ")

export type ProductWithVariantsClient = Pick<
  Awaited<ReturnType<typeof createClient>>,
  "from"
>

export interface GetProductWithVariantsParams {
  productId: string
  organizationId: string
  client?: ProductWithVariantsClient
}

function asRecord(value: unknown, entity: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid ${entity} row`)
  }

  return value as Record<string, unknown>
}

function readRequiredString(
  record: Record<string, unknown>,
  key: string,
  entity: string,
): string {
  const value = record[key]

  if (typeof value !== "string") {
    throw new Error(`Invalid ${entity}.${key}`)
  }

  return value
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === "string")
}

function normalizeOptionValues(value: unknown): VariantOptionValue[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return []
    }

    const optionName = "option_name" in item && typeof item.option_name === "string"
      ? item.option_name
      : null
    const optionValue = "value" in item && typeof item.value === "string"
      ? item.value
      : null

    if (!optionName || !optionValue) {
      return []
    }

    return [{ option_name: optionName, value: optionValue }]
  })
}

function normalizePriceTiers(value: unknown): PriceTier[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return []
    }

    const minQuantity = "min_quantity" in item ? parseNumber(item.min_quantity) : null
    const unitPrice = "unit_price" in item ? parseNumber(item.unit_price) : null
    const maxQuantity = "max_quantity" in item ? parseNumber(item.max_quantity) : null
    const label = "label" in item && typeof item.label === "string"
      ? item.label
      : undefined

    if (minQuantity === null || unitPrice === null) {
      return []
    }

    return [{
      min_quantity: Math.trunc(minQuantity),
      ...(maxQuantity !== null ? { max_quantity: Math.trunc(maxQuantity) } : {}),
      unit_price: unitPrice,
      ...(label ? { label } : {}),
    }]
  })
}

function normalizeProductSource(
  product: unknown,
): Parameters<typeof buildProductWithVariants>[0] {
  const record = asRecord(product, "product")

  return {
    id: readRequiredString(record, "id", "product"),
    organization_id: readRequiredString(record, "organization_id", "product"),
    name: readRequiredString(record, "name", "product"),
    description: typeof record.description === "string" ? record.description : undefined,
    image_url: typeof record.image_url === "string" ? record.image_url : undefined,
    images: normalizeStringArray(record.images),
    categories: normalizeStringArray(record.categories),
    is_active: typeof record.is_active === "boolean" ? record.is_active : true,
    has_quantity_pricing:
      typeof record.has_quantity_pricing === "boolean"
        ? record.has_quantity_pricing
        : false,
    price_tiers: normalizePriceTiers(record.price_tiers),
  }
}

function normalizeVariantRow(variant: unknown): ProductVariantRow {
  const record = asRecord(variant, "product_variant")

  return {
    id: readRequiredString(record, "id", "product_variant"),
    product_id: readRequiredString(record, "product_id", "product_variant"),
    organization_id: readRequiredString(record, "organization_id", "product_variant"),
    title: readRequiredString(record, "title", "product_variant"),
    sku: typeof record.sku === "string" ? record.sku : null,
    position: Math.trunc(parseNumber(record.position) ?? 0),
    is_default: typeof record.is_default === "boolean" ? record.is_default : false,
    is_active: typeof record.is_active === "boolean" ? record.is_active : true,
    price: parseNumber(record.price) ?? 0,
    compare_at_price: parseNumber(record.compare_at_price),
    stock_quantity: Math.trunc(parseNumber(record.stock_quantity) ?? 0),
    image_url: typeof record.image_url === "string" ? record.image_url : null,
    option_values: normalizeOptionValues(record.option_values),
    created_at: readRequiredString(record, "created_at", "product_variant"),
    updated_at: readRequiredString(record, "updated_at", "product_variant"),
  }
}

export async function getProductWithVariants({
  productId,
  organizationId,
  client,
}: GetProductWithVariantsParams): Promise<ProductWithVariantsReadModel | null> {
  const supabase = client ?? await createClient()

  const { data: product, error: productError } = await supabase
    .from("products")
    .select(PRODUCT_WITH_VARIANTS_PRODUCT_SELECT)
    .eq("id", productId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (productError) {
    throw new Error(`Error fetching product ${productId}: ${productError.message}`)
  }

  if (!product) {
    return null
  }

  const { data: variants, error: variantsError } = await supabase
    .from("product_variants")
    .select(PRODUCT_WITH_VARIANTS_VARIANT_SELECT)
    .eq("product_id", productId)
    .eq("organization_id", organizationId)

  if (variantsError) {
    throw new Error(`Error fetching variants for product ${productId}: ${variantsError.message}`)
  }

  return buildProductWithVariants(
    normalizeProductSource(product),
    (variants ?? []).map((variant) => normalizeVariantRow(variant)),
  )
}
