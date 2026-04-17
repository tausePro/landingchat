import { describe, expect, it } from "vitest"
import {
  getCartItemLineId,
  getCartItemProductId,
  normalizeCartItem,
  toCouponCartItem,
  toOrderSummaryItem,
  toTargetCartLineItem,
} from "@/store/cart-store"

describe("cart-store contract", () => {
  it("normaliza items legacy a shape transicional variant-centric", () => {
    const item = normalizeCartItem({
      id: "product-1",
      name: "Camiseta Premium",
      price: 70000,
      image_url: "https://example.com/product.jpg",
      categories: ["ropa", 123],
    }, 2)

    expect(item).toMatchObject({
      id: "product-1",
      product_id: "product-1",
      variant_id: null,
      variant_title: null,
      name: "Camiseta Premium",
      product_name: "Camiseta Premium",
      price: 70000,
      unit_price: 70000,
      compare_at_price: null,
      image_url: "https://example.com/product.jpg",
      categories: ["ropa"],
      quantity: 2,
    })
  })

  it("usa variant_id como line id cuando existe", () => {
    const item = normalizeCartItem({
      id: "product-1",
      product_id: "product-1",
      variant_id: "variant-1",
      variant_title: "Rojo / M",
      product_name: "Camiseta Premium",
      unit_price: 65000,
      compare_at_price: 80000,
      quantity: 1,
    })

    expect(item).not.toBeNull()
    expect(getCartItemLineId(item!)).toBe("variant-1")
    expect(getCartItemProductId(item!)).toBe("product-1")
  })

  it("mapea payloads de cupón y resumen usando product_id aunque la línea sea una variante", () => {
    const item = normalizeCartItem({
      id: "variant-1",
      product_id: "product-1",
      variant_id: "variant-1",
      variant_title: "Rojo / M",
      name: "Camiseta Premium",
      price: 65000,
      quantity: 3,
      categories: ["ropa"],
    })

    expect(item).not.toBeNull()
    expect(toCouponCartItem(item!)).toEqual({
      id: "product-1",
      product_id: "product-1",
      price: 65000,
      quantity: 3,
      categories: ["ropa"],
    })
    expect(toOrderSummaryItem(item!)).toEqual({
      id: "product-1",
      product_id: "product-1",
      price: 65000,
      quantity: 3,
    })
  })

  it("solo convierte al target CartLineItem cuando ya existe variante explícita", () => {
    const withoutVariant = normalizeCartItem({
      id: "product-1",
      name: "Camiseta Premium",
      price: 70000,
    })

    const withVariant = normalizeCartItem({
      id: "variant-1",
      product_id: "product-1",
      variant_id: "variant-1",
      variant_title: "Rojo / M",
      product_name: "Camiseta Premium",
      unit_price: 65000,
      compare_at_price: 80000,
      quantity: 2,
      image_url: "https://example.com/variant.jpg",
    })

    expect(toTargetCartLineItem(withoutVariant!)).toBeNull()
    expect(toTargetCartLineItem(withVariant!)).toEqual({
      product_id: "product-1",
      variant_id: "variant-1",
      variant_title: "Rojo / M",
      product_name: "Camiseta Premium",
      unit_price: 65000,
      compare_at_price: 80000,
      quantity: 2,
      image_url: "https://example.com/variant.jpg",
    })
  })
})
