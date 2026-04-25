import { getVariantPriceRange, resolveVariantPricing } from "@/lib/commerce/variantPricing"
import type {
  NormalizedPromotion,
  PriceTier,
  ProductData,
  ProductVariantRow,
  ProductWithVariantsReadModel,
  VariantPriceRange,
  VariantResolvedPricing,
} from "@/types/product"

interface ProductDetailRawPromotion {
  id?: string | null
  applies_to?: string | null
  target_ids?: unknown
  type?: string | null
  value?: number | string | null
  is_active?: boolean | null
  start_date?: string | null
  end_date?: string | null
}

const LOW_STOCK_THRESHOLD = 10

export interface ProductDetailVariantSelectionItem {
  id: string
  title: string
  inStock: boolean
  stockQuantity: number
  optionValues: Array<{ optionName: string; value: string }>
}

export interface ProductDetailInventorySummary {
  source: "variant" | "legacy"
  inStock: boolean
  totalStock: number | null
  lowStockLabel: string | null
}

export interface ProductDetailResolvedInventory {
  source: "variant" | "legacy"
  inStock: boolean
  totalStock: number | null
  availableQuantity: number | null
  lowStockLabel: string | null
  status: "in_stock" | "low_stock" | "out_of_stock"
}

export interface ProductDetailViewModel {
  productId: string
  categoryIds: string[]
  inventory: ProductDetailInventorySummary
  quantityPricing: {
    enabled: boolean
    minimumQuantity: number
    priceTiers: PriceTier[] | null
  }
  variants: {
    defaultVariant: ProductVariantRow | null
    hasVariantBackedPricing: boolean
  }
  variantSelection: {
    defaultVariantId: string | null
    variants: ProductDetailVariantSelectionItem[]
  }
  promotions: NormalizedPromotion[]
  pricing: {
    defaultResolved: VariantResolvedPricing | null
    resolvedPriceRange: VariantPriceRange | null
  }
}

function normalizePromotionScope(
  appliesTo: string | null | undefined,
): NormalizedPromotion["applies_to"] | null {
  switch (appliesTo) {
    case "all":
      return "all"
    case "product":
    case "products":
      return "product"
    case "variant":
    case "variants":
      return "variant"
    case "category":
    case "categories":
      return "category"
    default:
      return null
  }
}

function normalizePromotionType(
  type: string | null | undefined,
): NormalizedPromotion["type"] | null {
  if (type === "percentage" || type === "fixed") {
    return type
  }

  return null
}

function normalizePromotionTargetIds(targetIds: unknown): string[] {
  if (!Array.isArray(targetIds)) {
    return []
  }

  return targetIds.filter((targetId): targetId is string => typeof targetId === "string")
}

function normalizePromotionValue(value: number | string | null | undefined): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function normalizePromotion(rawPromotion: ProductDetailRawPromotion): NormalizedPromotion | null {
  if (!rawPromotion.id) {
    return null
  }

  const appliesTo = normalizePromotionScope(rawPromotion.applies_to)
  const type = normalizePromotionType(rawPromotion.type)
  const value = normalizePromotionValue(rawPromotion.value)

  if (!appliesTo || !type || value === null) {
    return null
  }

  return {
    id: rawPromotion.id,
    applies_to: appliesTo,
    target_ids: normalizePromotionTargetIds(rawPromotion.target_ids),
    type,
    value,
    is_active: rawPromotion.is_active ?? true,
    start_date: rawPromotion.start_date ?? null,
    end_date: rawPromotion.end_date ?? null,
  }
}

export function normalizeProductDetailPromotions(
  promotions: ProductDetailRawPromotion[] | null | undefined,
): NormalizedPromotion[] {
  return (promotions ?? [])
    .map(normalizePromotion)
    .filter((promotion): promotion is NormalizedPromotion => promotion !== null)
}

function buildLowStockLabel(quantity: number | null): string | null {
  if (quantity === null || quantity <= 0 || quantity > LOW_STOCK_THRESHOLD) {
    return null
  }

  return `Últimas ${quantity} unidade${quantity === 1 ? "d" : "s"}`
}

function resolveInventoryStatus(quantity: number | null): ProductDetailResolvedInventory["status"] {
  if (quantity === null || quantity <= 0) {
    return "out_of_stock"
  }

  if (quantity <= LOW_STOCK_THRESHOLD) {
    return "low_stock"
  }

  return "in_stock"
}

export function resolveProductDetailInventory(
  viewModel: ProductDetailViewModel,
  selectedVariantId?: string | null,
): ProductDetailResolvedInventory {
  const variantId = selectedVariantId ?? viewModel.variantSelection.defaultVariantId
  const selectedVariant = variantId
    ? viewModel.variantSelection.variants.find((variant) => variant.id === variantId) ?? null
    : null

  if (selectedVariant) {
    return {
      source: "variant",
      inStock: selectedVariant.inStock,
      totalStock: viewModel.inventory.totalStock,
      availableQuantity: selectedVariant.stockQuantity,
      lowStockLabel: buildLowStockLabel(selectedVariant.stockQuantity),
      status: resolveInventoryStatus(selectedVariant.stockQuantity),
    }
  }

  return {
    source: viewModel.inventory.source,
    inStock: viewModel.inventory.inStock,
    totalStock: viewModel.inventory.totalStock,
    availableQuantity: viewModel.inventory.totalStock,
    lowStockLabel: viewModel.inventory.lowStockLabel,
    status: resolveInventoryStatus(viewModel.inventory.totalStock),
  }
}

interface BuildProductDetailViewModelParams {
  product: Pick<ProductData, "id" | "categories" | "minimum_quantity" | "has_quantity_pricing" | "price_tiers" | "stock">
  productWithVariants?: ProductWithVariantsReadModel | null
  promotions?: ProductDetailRawPromotion[] | null
}

export function buildProductDetailViewModel({
  product,
  productWithVariants,
  promotions,
}: BuildProductDetailViewModelParams): ProductDetailViewModel {
  const normalizedPromotions = normalizeProductDetailPromotions(promotions)
  const categoryIds = productWithVariants?.categories ?? product.categories ?? []
  const minimumQuantity = product.minimum_quantity ?? 1
  const quantityPricingEnabled = productWithVariants?.has_quantity_pricing ?? product.has_quantity_pricing ?? false
  const priceTiers = productWithVariants?.price_tiers ?? product.price_tiers ?? null
  const activeVariants = productWithVariants?.variants.filter((variant) => variant.is_active) ?? []
  const defaultVariant = activeVariants.find((variant) => variant.is_default)
    ?? activeVariants[0]
    ?? productWithVariants?.default_variant
    ?? null
  const hasVariantBackedPricing = Boolean(defaultVariant)
  const inventorySource: ProductDetailInventorySummary["source"] = activeVariants.length > 0 ? "variant" : "legacy"
  const totalStock = inventorySource === "variant"
    ? activeVariants.reduce((total, variant) => total + Math.max(0, variant.stock_quantity), 0)
    : Math.max(0, Math.trunc(product.stock))

  const defaultResolved = defaultVariant
    ? resolveVariantPricing(defaultVariant, {
        promotions: normalizedPromotions,
        quantity: minimumQuantity,
        category_ids: categoryIds,
        price_tiers: defaultVariant.is_default ? priceTiers : null,
        has_quantity_pricing: defaultVariant.is_default && quantityPricingEnabled,
      })
    : null

  const resolvedPriceRange = productWithVariants?.variants?.length
    ? getVariantPriceRange(productWithVariants.variants, {
        promotions: normalizedPromotions,
        quantity: minimumQuantity,
        category_ids: categoryIds,
      })
    : null

  return {
    productId: product.id,
    categoryIds,
    inventory: {
      source: inventorySource,
      inStock: totalStock > 0,
      totalStock,
      lowStockLabel: buildLowStockLabel(totalStock),
    },
    quantityPricing: {
      enabled: quantityPricingEnabled,
      minimumQuantity,
      priceTiers,
    },
    variants: {
      defaultVariant,
      hasVariantBackedPricing,
    },
    variantSelection: {
      defaultVariantId: defaultVariant?.id ?? null,
      variants: activeVariants.map((variant) => ({
        id: variant.id,
        title: variant.title,
        inStock: variant.stock_quantity > 0,
        stockQuantity: variant.stock_quantity,
        optionValues: variant.option_values.map((optionValue) => ({
          optionName: optionValue.option_name,
          value: optionValue.value,
        })),
      })),
    },
    promotions: normalizedPromotions,
    pricing: {
      defaultResolved,
      resolvedPriceRange,
    },
  }
}
