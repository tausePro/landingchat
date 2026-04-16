import { getVariantPriceRange } from "@/lib/commerce/variantPricing"
import type {
  ProductData,
  ProductVariantRow,
  ProductWithVariantsReadModel,
} from "@/types/product"

type ProductWithVariantsSource = Pick<
  ProductData,
  | "id"
  | "organization_id"
  | "slug"
  | "name"
  | "description"
  | "image_url"
  | "images"
  | "categories"
  | "is_active"
  | "has_quantity_pricing"
  | "price_tiers"
>

function sortVariants(variants: ProductVariantRow[]): ProductVariantRow[] {
  return [...variants].sort((a, b) => {
    if (a.position !== b.position) {
      return a.position - b.position
    }

    return a.title.localeCompare(b.title)
  })
}

export function selectDefaultVariant(
  variants: ProductVariantRow[],
): ProductVariantRow | null {
  return variants.find((variant) => variant.is_default) ?? variants[0] ?? null
}

export function buildProductWithVariants(
  product: ProductWithVariantsSource,
  variants: ProductVariantRow[],
): ProductWithVariantsReadModel {
  const productVariants = sortVariants(
    variants.filter((variant) => variant.product_id === product.id),
  )

  return {
    id: product.id,
    organization_id: product.organization_id,
    slug: product.slug ?? null,
    name: product.name,
    description: product.description ?? null,
    image_url: product.image_url ?? null,
    images: product.images ?? [],
    categories: product.categories ?? [],
    is_active: product.is_active ?? true,
    has_quantity_pricing: product.has_quantity_pricing ?? false,
    price_tiers: product.price_tiers ?? null,
    default_variant: selectDefaultVariant(productVariants),
    variants: productVariants,
    price_range: getVariantPriceRange(productVariants),
  }
}
