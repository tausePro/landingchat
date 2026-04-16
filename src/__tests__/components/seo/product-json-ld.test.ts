import { describe, expect, it } from "vitest"
import { buildProductJsonLdData } from "@/components/seo/product-json-ld"
import type { ProductWithVariantsReadModel } from "@/types/product"

const baseProduct = {
  id: "product-1",
  name: "Camiseta Premium",
  description: "Algodón pesado",
  price: 80000,
  sale_price: 70000,
  image_url: "https://example.com/legacy.jpg",
  images: ["https://example.com/legacy.jpg"],
  sku: "LEGACY-SKU",
  stock: 5,
  categories: ["ropa"],
}

const baseOrganization = {
  name: "Landing Store",
  slug: "landing-store",
}

function makeProductWithVariants(
  overrides: Partial<ProductWithVariantsReadModel> = {},
): ProductWithVariantsReadModel {
  return {
    id: overrides.id ?? "product-1",
    organization_id: overrides.organization_id ?? "org-1",
    name: overrides.name ?? "Camiseta Premium",
    description: overrides.description ?? "Algodón pesado",
    image_url: overrides.image_url ?? "https://example.com/main.jpg",
    images: overrides.images ?? ["https://example.com/main.jpg"],
    categories: overrides.categories ?? ["ropa"],
    is_active: overrides.is_active ?? true,
    has_quantity_pricing: overrides.has_quantity_pricing ?? false,
    price_tiers: overrides.price_tiers ?? null,
    default_variant: overrides.default_variant ?? {
      id: "variant-1",
      product_id: "product-1",
      organization_id: "org-1",
      title: "Default",
      sku: "VARIANT-SKU",
      position: 0,
      is_default: true,
      is_active: true,
      price: 65000,
      compare_at_price: 90000,
      stock_quantity: 8,
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
        sku: "VARIANT-SKU",
        position: 0,
        is_default: true,
        is_active: true,
        price: 65000,
        compare_at_price: 90000,
        stock_quantity: 8,
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
      min_compare_at: 90000,
      max_compare_at: 90000,
    },
  }
}

describe("buildProductJsonLdData", () => {
  it("usa la variante default como fuente preferente para Offer", () => {
    const { productSchema } = buildProductJsonLdData({
      product: baseProduct,
      organization: baseOrganization,
      url: "https://example.com/producto/camiseta-premium",
      productWithVariants: makeProductWithVariants(),
    })

    expect(productSchema.sku).toBe("VARIANT-SKU")
    expect(productSchema.image).toEqual(["https://example.com/legacy.jpg"])
    expect(productSchema.offers).toMatchObject({
      "@type": "Offer",
      priceCurrency: "COP",
      price: 65000,
      availability: "https://schema.org/InStock",
    })
  })

  it("usa AggregateOffer cuando el producto tiene rango real entre variantes", () => {
    const productWithVariants = makeProductWithVariants({
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
          price: 50000,
          compare_at_price: null,
          stock_quantity: 2,
          image_url: null,
          option_values: [],
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
        {
          id: "variant-2",
          product_id: "product-1",
          organization_id: "org-1",
          title: "XL",
          sku: "SKU-XL",
          position: 1,
          is_default: false,
          is_active: true,
          price: 78000,
          compare_at_price: null,
          stock_quantity: 0,
          image_url: null,
          option_values: [],
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ],
      price_range: {
        has_range: true,
        min_price: 50000,
        max_price: 78000,
        min_compare_at: null,
        max_compare_at: null,
      },
    })

    const { productSchema } = buildProductJsonLdData({
      product: baseProduct,
      organization: baseOrganization,
      url: "https://example.com/producto/camiseta-premium",
      productWithVariants,
    })

    expect(productSchema.offers).toMatchObject({
      "@type": "AggregateOffer",
      lowPrice: 50000,
      highPrice: 78000,
      offerCount: 2,
      availability: "https://schema.org/InStock",
    })
  })
})
