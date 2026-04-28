import { describe, expect, it } from "vitest"
import {
  normalizeAiCartLineItem,
  resolveAgentSearchProduct,
} from "@/lib/ai/executors/ecommerce"
import type { ProductVariantRow } from "@/types/product"

const baseVariant: ProductVariantRow = {
  id: "variant-default",
  product_id: "product-1",
  organization_id: "org-1",
  title: "Default",
  sku: null,
  position: 0,
  is_default: true,
  is_active: true,
  price: 50000,
  compare_at_price: 70000,
  stock_quantity: 2,
  image_url: "https://example.com/default.jpg",
  option_values: [],
  created_at: "2026-04-28T00:00:00.000Z",
  updated_at: "2026-04-28T00:00:00.000Z",
}

const secondVariant: ProductVariantRow = {
  ...baseVariant,
  id: "variant-second",
  title: "Azul / M",
  position: 1,
  is_default: false,
  price: 65000,
  compare_at_price: null,
  stock_quantity: 3,
  image_url: "https://example.com/second.jpg",
  option_values: [
    { option_name: "Color", value: "Azul" },
    { option_name: "Talla", value: "M" },
  ],
}

describe("AI ecommerce executor variant contracts", () => {
  it("resuelve búsqueda con precio absoluto de variante, rango y stock agregado", () => {
    const product = resolveAgentSearchProduct(
      {
        id: "product-1",
        name: "Producto con variantes",
        description: "Descripción",
        price: 80000,
        sale_price: 75000,
        image_url: "https://example.com/product.jpg",
        images: ["https://example.com/fallback.jpg"],
        stock: 99,
        categories: ["categoria"],
        variants: [],
      },
      [baseVariant, secondVariant],
    )

    expect(product).toMatchObject({
      id: "product-1",
      price: 50000,
      originalPrice: 70000,
      onSale: true,
      stock: 5,
      available: true,
      hasVariants: true,
      default_variant_id: "variant-default",
      default_variant_title: "Default",
      image_url: "https://example.com/default.jpg",
    })
    expect(product.price_range).toEqual({
      has_range: true,
      min_price: 50000,
      max_price: 65000,
      min_compare_at: 70000,
      max_compare_at: 70000,
    })
  })

  it("expone todas las opciones y variantes disponibles al agente", () => {
    const carbonVariant: ProductVariantRow = {
      ...baseVariant,
      id: "variant-carbon",
      title: "Carbón activado",
      option_values: [{ option_name: "Aroma", value: "Carbón activado" }],
    }
    const lavandaVariant: ProductVariantRow = {
      ...baseVariant,
      id: "variant-lavanda",
      title: "Lavanda",
      is_default: false,
      price: 52000,
      compare_at_price: null,
      stock_quantity: 4,
      option_values: [{ option_name: "Aroma", value: "Lavanda" }],
    }

    const product = resolveAgentSearchProduct(
      {
        id: "product-1",
        name: "Arena ecológica para gato",
        description: "Descripción",
        price: 50000,
        sale_price: null,
        image_url: null,
        images: [],
        stock: 6,
        categories: ["gatos"],
        variants: [],
      },
      [carbonVariant, lavandaVariant],
    )

    expect(product.variant_options).toEqual([
      { name: "Aroma", values: ["Carbón activado", "Lavanda"] },
    ])
    expect(product.available_variants).toEqual([
      expect.objectContaining({
        variant_id: "variant-carbon",
        title: "Carbón activado",
        available: true,
      }),
      expect.objectContaining({
        variant_id: "variant-lavanda",
        title: "Lavanda",
        available: true,
      }),
    ])
  })

  it("normaliza líneas AI preservando unidad vendible explícita", () => {
    const item = normalizeAiCartLineItem({
      id: "legacy-line",
      product_id: "product-1",
      variant_id: "variant-second",
      variant_title: "Azul / M",
      product_name: "Producto con variantes",
      price: 99999,
      unit_price: 65000,
      compare_at_price: 70000,
      quantity: "2",
      image_url: "https://example.com/second.jpg",
      categories: ["categoria", 123],
    })

    expect(item).toEqual({
      id: "variant-second",
      product_id: "product-1",
      variant_id: "variant-second",
      variant_title: "Azul / M",
      name: "Producto con variantes",
      product_name: "Producto con variantes",
      price: 65000,
      unit_price: 65000,
      compare_at_price: 70000,
      image_url: "https://example.com/second.jpg",
      quantity: 2,
      categories: ["categoria"],
    })
  })
})
