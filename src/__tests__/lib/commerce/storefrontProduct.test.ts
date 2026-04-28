import { describe, expect, it } from "vitest"
import {
  mapProductListItemToStorefrontProduct,
  resolveStorefrontProductPricing,
} from "@/lib/commerce/storefrontProduct"
import type { ProductWithVariantsListItem } from "@/types/product"

function makeProductListItem(
  overrides: Partial<ProductWithVariantsListItem> = {},
): ProductWithVariantsListItem {
  const hasOverride = <K extends keyof ProductWithVariantsListItem>(key: K): boolean => key in overrides

  return {
    id: overrides.id ?? "product-1",
    organization_id: overrides.organization_id ?? "org-1",
    slug: hasOverride("slug") ? (overrides.slug ?? null) : "camiseta-premium",
    name: overrides.name ?? "Camiseta Premium",
    description: hasOverride("description") ? (overrides.description ?? null) : "Algodón pesado",
    image_url: hasOverride("image_url") ? (overrides.image_url ?? null) : "https://example.com/product.jpg",
    images: overrides.images ?? ["https://example.com/product.jpg"],
    categories: overrides.categories ?? ["ropa"],
    is_active: overrides.is_active ?? true,
    has_quantity_pricing: overrides.has_quantity_pricing ?? false,
    price_tiers: overrides.price_tiers ?? null,
    default_variant: hasOverride("default_variant") ? (overrides.default_variant ?? null) : {
      id: "variant-1",
      product_id: "product-1",
      organization_id: "org-1",
      title: "Default",
      sku: "SKU-1",
      position: 0,
      is_default: true,
      is_active: true,
      price: 65000,
      compare_at_price: null,
      stock_quantity: 4,
      image_url: "https://example.com/variant.jpg",
      option_values: [],
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    variants: overrides.variants ?? [
      {
        id: "variant-1",
        product_id: "product-1",
        organization_id: "org-1",
        title: "Default",
        sku: "SKU-1",
        position: 0,
        is_default: true,
        is_active: true,
        price: 65000,
        compare_at_price: null,
        stock_quantity: 4,
        image_url: "https://example.com/variant.jpg",
        option_values: [],
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ],
    price_range: overrides.price_range ?? {
      has_range: false,
      min_price: 65000,
      max_price: 65000,
      min_compare_at: null,
      max_compare_at: null,
    },
    legacy_price: overrides.legacy_price ?? 80000,
    legacy_sale_price: overrides.legacy_sale_price ?? 70000,
    legacy_stock: overrides.legacy_stock ?? 9,
    legacy_variants: overrides.legacy_variants ?? null,
    badge_id: hasOverride("badge_id") ? (overrides.badge_id ?? null) : "badge-1",
  }
}

describe("resolveStorefrontProductPricing", () => {
  it("prioriza compare_at de la variante cuando existe", () => {
    const pricing = resolveStorefrontProductPricing(
      makeProductListItem({
        default_variant: {
          id: "variant-1",
          product_id: "product-1",
          organization_id: "org-1",
          title: "Default",
          sku: "SKU-1",
          position: 0,
          is_default: true,
          is_active: true,
          price: 65000,
          compare_at_price: 90000,
          stock_quantity: 4,
          image_url: "https://example.com/variant.jpg",
          option_values: [],
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      }),
    )

    expect(pricing).toEqual({
      price: 90000,
      sale_price: 65000,
    })
  })

  it("prefiere la variante default sobre sale_price legacy cuando no coincide", () => {
    const pricing = resolveStorefrontProductPricing(
      makeProductListItem({
        legacy_price: 80000,
        legacy_sale_price: 70000,
        default_variant: {
          id: "variant-1",
          product_id: "product-1",
          organization_id: "org-1",
          title: "Default",
          sku: "SKU-1",
          position: 0,
          is_default: true,
          is_active: true,
          price: 65000,
          compare_at_price: null,
          stock_quantity: 4,
          image_url: "https://example.com/variant.jpg",
          option_values: [],
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      }),
    )

    expect(pricing).toEqual({
      price: 65000,
      sale_price: null,
    })
  })
})

describe("mapProductListItemToStorefrontProduct", () => {
  it("mapea stock agregado de variantes, badge e imagen preferente", () => {
    const product = mapProductListItemToStorefrontProduct(
      makeProductListItem({
        variants: [
          {
            id: "variant-1",
            product_id: "product-1",
            organization_id: "org-1",
            title: "S",
            sku: "SKU-S",
            position: 0,
            is_default: true,
            is_active: true,
            price: 65000,
            compare_at_price: null,
            stock_quantity: 2,
            image_url: "https://example.com/variant-s.jpg",
            option_values: [],
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
          {
            id: "variant-2",
            product_id: "product-1",
            organization_id: "org-1",
            title: "M",
            sku: "SKU-M",
            position: 1,
            is_default: false,
            is_active: true,
            price: 68000,
            compare_at_price: null,
            stock_quantity: 3,
            image_url: null,
            option_values: [],
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ],
        default_variant: {
          id: "variant-1",
          product_id: "product-1",
          organization_id: "org-1",
          title: "S",
          sku: "SKU-S",
          position: 0,
          is_default: true,
          is_active: true,
          price: 65000,
          compare_at_price: null,
          stock_quantity: 2,
          image_url: "https://example.com/variant-s.jpg",
          option_values: [],
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      }),
    )

    expect(product).toMatchObject({
      id: "product-1",
      slug: "camiseta-premium",
      image_url: "https://example.com/variant-s.jpg",
      stock: 5,
      badge_id: "badge-1",
      price: 65000,
      sale_price: null,
      price_range: {
        has_range: false,
        min_price: 65000,
        max_price: 65000,
      },
    })
  })

  it("preserva rango de precios para vistas de venta con variantes variables", () => {
    const product = mapProductListItemToStorefrontProduct(
      makeProductListItem({
        price_range: {
          has_range: true,
          min_price: 50000,
          max_price: 68000,
          min_compare_at: null,
          max_compare_at: null,
        },
      }),
    )

    expect(product.price_range).toEqual({
      has_range: true,
      min_price: 50000,
      max_price: 68000,
      min_compare_at: null,
      max_compare_at: null,
    })
  })

  it("deriva rango desde precios absolutos legacy cuando el read model target aún no trae rango", () => {
    const product = mapProductListItemToStorefrontProduct(
      makeProductListItem({
        price_range: {
          has_range: false,
          min_price: 101000,
          max_price: 101000,
          min_compare_at: null,
          max_compare_at: null,
        },
        legacy_price: 101000,
        legacy_sale_price: null,
        legacy_variants: [
          {
            type: "Colores",
            values: ["Azul Cielo", "Cafe"],
            hasPriceAdjustment: true,
            variantPrices: {
              "Colores:Azul Cielo": 125000,
              "Colores:Cafe": 110000,
            },
          },
        ],
      }),
    )

    expect(product.price_range).toEqual({
      has_range: true,
      min_price: 110000,
      max_price: 125000,
      min_compare_at: null,
      max_compare_at: null,
    })
  })

  it("usa fallback legacy cuando no hay variantes", () => {
    const product = mapProductListItemToStorefrontProduct(
      makeProductListItem({
        slug: null,
        default_variant: null,
        variants: [],
        image_url: null,
        images: [],
        legacy_price: 45000,
        legacy_sale_price: 40000,
        legacy_stock: 2,
        badge_id: null,
      }),
    )

    expect(product).toMatchObject({
      id: "product-1",
      slug: "product-1",
      image_url: "",
      stock: 2,
      badge_id: null,
      price: 45000,
      sale_price: 40000,
      price_range: {
        has_range: false,
        min_price: 40000,
        max_price: 40000,
      },
    })
  })
})
