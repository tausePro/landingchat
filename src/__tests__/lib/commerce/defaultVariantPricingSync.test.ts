import { describe, expect, it } from "vitest"
import { resolveDefaultVariantPricingSync } from "@/lib/commerce/defaultVariantPricingSync"

describe("resolveDefaultVariantPricingSync", () => {
  it("mantiene price como precio actual cuando no hay sale_price", () => {
    expect(resolveDefaultVariantPricingSync({ price: 48000, sale_price: null })).toEqual({
      price: 48000,
      compare_at_price: null,
    })
  })

  it("convierte price legacy regular y sale_price legacy descuento al contrato target", () => {
    expect(resolveDefaultVariantPricingSync({ price: 48000, sale_price: 40000 })).toEqual({
      price: 40000,
      compare_at_price: 48000,
    })
  })

  it("ignora sale_price cuando no es menor que price", () => {
    expect(resolveDefaultVariantPricingSync({ price: 40000, sale_price: 48000 })).toEqual({
      price: 40000,
      compare_at_price: null,
    })
  })

  it("trata sale_price cero como ausencia de oferta", () => {
    expect(resolveDefaultVariantPricingSync({ price: 40000, sale_price: 0 })).toEqual({
      price: 40000,
      compare_at_price: null,
    })
  })

  it("normaliza valores inválidos sin producir precios negativos", () => {
    expect(resolveDefaultVariantPricingSync({ price: -100, sale_price: 50 })).toEqual({
      price: 0,
      compare_at_price: null,
    })
  })
})
