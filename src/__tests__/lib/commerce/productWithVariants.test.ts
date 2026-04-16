import { describe, expect, it } from "vitest"
import {
  buildProductWithVariants,
  selectDefaultVariant,
} from "@/lib/commerce/productWithVariants"
import type { ProductData, ProductVariantRow } from "@/types/product"

function makeProduct(
  overrides: Partial<ProductData> = {},
): Parameters<typeof buildProductWithVariants>[0] {
  return {
    id: overrides.id ?? "product-1",
    organization_id: overrides.organization_id ?? "org-1",
    name: overrides.name ?? "Producto test",
    description: overrides.description,
    image_url: overrides.image_url,
    images: overrides.images ?? [],
    categories: overrides.categories ?? [],
    is_active: overrides.is_active ?? true,
    has_quantity_pricing: overrides.has_quantity_pricing ?? false,
    price_tiers: overrides.price_tiers,
  }
}

function makeVariant(
  overrides: Partial<ProductVariantRow> = {},
): ProductVariantRow {
  return {
    id: overrides.id ?? "variant-1",
    product_id: overrides.product_id ?? "product-1",
    organization_id: overrides.organization_id ?? "org-1",
    title: overrides.title ?? "Default",
    sku: overrides.sku ?? null,
    position: overrides.position ?? 0,
    is_default: overrides.is_default ?? false,
    is_active: overrides.is_active ?? true,
    price: overrides.price ?? 48000,
    compare_at_price: overrides.compare_at_price ?? null,
    stock_quantity: overrides.stock_quantity ?? 10,
    image_url: overrides.image_url ?? null,
    option_values: overrides.option_values ?? [],
    created_at: overrides.created_at ?? "2026-01-01T00:00:00Z",
    updated_at: overrides.updated_at ?? "2026-01-01T00:00:00Z",
  }
}

describe("selectDefaultVariant", () => {
  it("prioriza la variante marcada como default", () => {
    const variants = [
      makeVariant({ id: "v-2", position: 1, is_default: false }),
      makeVariant({ id: "v-1", position: 0, is_default: true }),
    ]

    expect(selectDefaultVariant(variants)?.id).toBe("v-1")
  })

  it("usa la primera variante cuando ninguna está marcada como default", () => {
    const variants = [
      makeVariant({ id: "v-1", position: 0 }),
      makeVariant({ id: "v-2", position: 1 }),
    ]

    expect(selectDefaultVariant(variants)?.id).toBe("v-1")
  })

  it("devuelve null si no hay variantes", () => {
    expect(selectDefaultVariant([])).toBeNull()
  })
})

describe("buildProductWithVariants", () => {
  it("construye el read model con variantes ordenadas y variante default", () => {
    const product = makeProduct({
      images: ["https://example.com/a.jpg"],
      categories: ["camisetas"],
    })
    const variants = [
      makeVariant({
        id: "v-2",
        position: 2,
        title: "Rojo",
        price: 65000,
      }),
      makeVariant({
        id: "v-1",
        position: 0,
        title: "Default",
        is_default: true,
        price: 50000,
        compare_at_price: 60000,
      }),
      makeVariant({
        id: "v-foreign",
        product_id: "other-product",
        position: 1,
      }),
    ]

    const result = buildProductWithVariants(product, variants)

    expect(result.variants.map((variant) => variant.id)).toEqual(["v-1", "v-2"])
    expect(result.default_variant?.id).toBe("v-1")
    expect(result.images).toEqual(["https://example.com/a.jpg"])
    expect(result.categories).toEqual(["camisetas"])
    expect(result.price_range).toMatchObject({
      has_range: true,
      min_price: 50000,
      max_price: 65000,
      min_compare_at: 60000,
      max_compare_at: 60000,
    })
  })

  it("normaliza campos opcionales y soporta productos sin variantes", () => {
    const product = makeProduct({
      description: undefined,
      image_url: undefined,
      images: undefined,
      categories: undefined,
      is_active: undefined,
      has_quantity_pricing: undefined,
      price_tiers: undefined,
    })

    const result = buildProductWithVariants(product, [])

    expect(result.description).toBeNull()
    expect(result.image_url).toBeNull()
    expect(result.images).toEqual([])
    expect(result.categories).toEqual([])
    expect(result.is_active).toBe(true)
    expect(result.has_quantity_pricing).toBe(false)
    expect(result.price_tiers).toBeNull()
    expect(result.default_variant).toBeNull()
    expect(result.variants).toEqual([])
    expect(result.price_range).toMatchObject({
      has_range: false,
      min_price: 0,
      max_price: 0,
      min_compare_at: null,
      max_compare_at: null,
    })
  })
})
