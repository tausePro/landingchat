import { describe, expect, it } from "vitest"
import { expandLegacyVariantsToVariantDrafts } from "@/lib/commerce/variantDrafts"

const baseInput = {
  productName: "Camiseta",
  basePrice: 50000,
  baseCompareAtPrice: 60000,
  baseStock: 10,
  baseSku: "SKU-BASE",
  baseImageUrl: "https://example.com/base.jpg",
}

describe("expandLegacyVariantsToVariantDrafts", () => {
  it("crea una variante default cuando no hay variantes legacy válidas", () => {
    const result = expandLegacyVariantsToVariantDrafts({
      ...baseInput,
      legacyVariants: [
        { type: "", values: [] },
        { type: "Color", values: [" "] },
      ],
    })

    expect(result).toEqual([
      {
        title: "Camiseta",
        sku: "SKU-BASE",
        position: 0,
        is_default: true,
        is_active: true,
        price: 50000,
        compare_at_price: 60000,
        stock_quantity: 10,
        image_url: "https://example.com/base.jpg",
        option_values: [],
      },
    ])
  })

  it("expande opciones legacy a variantes vendibles target", () => {
    const result = expandLegacyVariantsToVariantDrafts({
      ...baseInput,
      legacyVariants: [
        {
          type: "Color",
          values: ["Rojo", "Azul"],
          hasImageMapping: true,
          images: {
            Rojo: ["https://example.com/red-1.jpg", "https://example.com/red-2.jpg"],
          },
        },
        {
          type: "Talla",
          values: ["S", "M"],
          hasPriceAdjustment: true,
          priceAdjustments: {
            M: 5000,
          },
          hasStockByVariant: true,
          stockByVariant: {
            S: 3,
            M: 2,
          },
        },
      ],
    })

    expect(result).toHaveLength(4)
    expect(result.map((variant) => variant.title)).toEqual([
      "Rojo / S",
      "Rojo / M",
      "Azul / S",
      "Azul / M",
    ])
    expect(result[0]).toMatchObject({
      sku: "SKU-BASE",
      position: 0,
      is_default: true,
      price: 50000,
      compare_at_price: 60000,
      stock_quantity: 3,
      image_url: "https://example.com/red-1.jpg",
      option_values: [
        { option_name: "Color", value: "Rojo" },
        { option_name: "Talla", value: "S" },
      ],
    })
    expect(result[1]).toMatchObject({
      sku: null,
      position: 1,
      is_default: false,
      price: 55000,
      compare_at_price: 65000,
      stock_quantity: 2,
      image_url: "https://example.com/red-1.jpg",
    })
  })

  it("deduplica valores y conserva el orden de primera aparición", () => {
    const result = expandLegacyVariantsToVariantDrafts({
      ...baseInput,
      legacyVariants: [
        {
          type: "Color",
          values: ["Rojo", "Rojo", " Azul ", ""],
        },
      ],
    })

    expect(result.map((variant) => variant.title)).toEqual(["Rojo", "Azul"])
  })

  it("clampa precios negativos derivados de ajustes legacy", () => {
    const result = expandLegacyVariantsToVariantDrafts({
      productName: "Liquidación",
      basePrice: 10000,
      baseCompareAtPrice: null,
      baseStock: 5,
      baseSku: null,
      baseImageUrl: null,
      legacyVariants: [
        {
          type: "Estado",
          values: ["Outlet"],
          hasPriceAdjustment: true,
          priceAdjustments: {
            Outlet: -15000,
          },
        },
      ],
    })

    expect(result[0]?.price).toBe(0)
    expect(result[0]?.compare_at_price).toBeNull()
  })

  it("usa el menor stock explícito cuando hay múltiples dimensiones con stock", () => {
    const result = expandLegacyVariantsToVariantDrafts({
      ...baseInput,
      legacyVariants: [
        {
          type: "Color",
          values: ["Rojo"],
          hasStockByVariant: true,
          stockByVariant: { Rojo: 8 },
        },
        {
          type: "Talla",
          values: ["M"],
          hasStockByVariant: true,
          stockByVariant: { M: 2 },
        },
      ],
    })

    expect(result[0]?.stock_quantity).toBe(2)
  })

  it("propaga estado inactivo del producto a los drafts", () => {
    const result = expandLegacyVariantsToVariantDrafts({
      ...baseInput,
      baseIsActive: false,
      legacyVariants: [
        {
          type: "Color",
          values: ["Rojo", "Azul"],
        },
      ],
    })

    expect(result.every((variant) => variant.is_active === false)).toBe(true)
  })
})
