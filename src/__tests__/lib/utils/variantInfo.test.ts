import { describe, expect, it } from "vitest"

import { appendVariantToItemName, formatVariantInfo } from "@/lib/utils/variantInfo"

describe("variantInfo", () => {
  it("returns plain string variant info", () => {
    expect(formatVariantInfo("Lavanda / 25 Kg")).toBe("Lavanda / 25 Kg")
  })

  it("returns variant_title from structured variant info", () => {
    expect(
      formatVariantInfo({
        variant_id: "variant-1",
        variant_title: "Lavanda / 25 Kg",
      }),
    ).toBe("Lavanda / 25 Kg")
  })

  it("formats legacy variant arrays", () => {
    expect(
      formatVariantInfo([
        { type: "Fragancia", values: ["Lavanda"] },
        { type: "Presentación", values: ["25 Kg"] },
      ]),
    ).toBe("Fragancia: Lavanda | Presentación: 25 Kg")
  })

  it("appends variant label to item name when present", () => {
    expect(
      appendVariantToItemName("Arena Nature Pets", { variant_title: "Lavanda / 25 Kg" }),
    ).toBe("Arena Nature Pets (Lavanda / 25 Kg)")
  })
})
