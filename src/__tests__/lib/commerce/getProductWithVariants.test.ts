import { describe, expect, it } from "vitest"
import {
  getProductWithVariants,
  type ProductWithVariantsClient,
} from "@/lib/commerce/getProductWithVariants"

interface MockError {
  message: string
}

interface MockQueryResult<T> {
  data: T
  error: MockError | null
}

interface QueryCall {
  table: string
  mode: "maybeSingle" | "many"
  filters: Record<string, unknown>
  selection: string
}

function createMockClient(params: {
  productResult: MockQueryResult<unknown | null>
  variantsResult: MockQueryResult<unknown[] | null>
}) {
  const calls: QueryCall[] = []

  const client = {
    from(table: string) {
      const filters: Record<string, unknown> = {}
      let selection = ""

      const builder = {
        select(value: string) {
          selection = value
          return builder
        },
        eq(column: string, value: unknown) {
          filters[column] = value
          return builder
        },
        async maybeSingle() {
          calls.push({
            table,
            mode: "maybeSingle",
            filters: { ...filters },
            selection,
          })

          if (table !== "products") {
            throw new Error(`Unexpected maybeSingle on ${table}`)
          }

          return params.productResult
        },
        then(...args: Parameters<Promise<MockQueryResult<unknown[] | null>>["then"]>) {
          calls.push({
            table,
            mode: "many",
            filters: { ...filters },
            selection,
          })

          if (table !== "product_variants") {
            return Promise.resolve({ data: null, error: { message: `Unexpected many query on ${table}` } }).then(...args)
          }

          return Promise.resolve(params.variantsResult).then(...args)
        },
      }

      return builder
    },
  } as unknown as ProductWithVariantsClient

  return { client, calls }
}

describe("getProductWithVariants", () => {
  it("devuelve null si el producto no existe", async () => {
    const { client, calls } = createMockClient({
      productResult: { data: null, error: null },
      variantsResult: { data: [], error: null },
    })

    const result = await getProductWithVariants({
      productId: "product-1",
      organizationId: "org-1",
      client,
    })

    expect(result).toBeNull()
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      table: "products",
      mode: "maybeSingle",
      filters: {
        id: "product-1",
        organization_id: "org-1",
      },
    })
  })

  it("construye el read model variant-centric desde Supabase", async () => {
    const { client, calls } = createMockClient({
      productResult: {
        data: {
          id: "product-1",
          organization_id: "org-1",
          name: "Camiseta",
          description: "Premium",
          image_url: "https://example.com/main.jpg",
          images: ["https://example.com/main.jpg", "https://example.com/alt.jpg"],
          categories: ["ropa", "camisetas"],
          is_active: true,
          has_quantity_pricing: true,
          price_tiers: [
            { min_quantity: "12", unit_price: "42000", label: "Docena" },
          ],
        },
        error: null,
      },
      variantsResult: {
        data: [
          {
            id: "variant-2",
            product_id: "product-1",
            organization_id: "org-1",
            title: "Rojo - XL",
            sku: "SKU-XL",
            position: "2",
            is_default: false,
            is_active: true,
            price: "65000",
            compare_at_price: null,
            stock_quantity: "3",
            image_url: "https://example.com/xl.jpg",
            option_values: [{ option_name: "Color", value: "Rojo" }],
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
          {
            id: "variant-1",
            product_id: "product-1",
            organization_id: "org-1",
            title: "Default",
            sku: "SKU-BASE",
            position: 0,
            is_default: true,
            is_active: true,
            price: 50000,
            compare_at_price: "60000",
            stock_quantity: 10,
            image_url: "https://example.com/default.jpg",
            option_values: [],
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ],
        error: null,
      },
    })

    const result = await getProductWithVariants({
      productId: "product-1",
      organizationId: "org-1",
      client,
    })

    expect(result).not.toBeNull()
    expect(result?.default_variant?.id).toBe("variant-1")
    expect(result?.variants.map((variant) => variant.id)).toEqual(["variant-1", "variant-2"])
    expect(result?.price_tiers).toEqual([
      { min_quantity: 12, unit_price: 42000, label: "Docena" },
    ])
    expect(result?.price_range).toMatchObject({
      has_range: true,
      min_price: 50000,
      max_price: 65000,
      min_compare_at: 60000,
      max_compare_at: 60000,
    })
    expect(result?.images).toEqual([
      "https://example.com/main.jpg",
      "https://example.com/alt.jpg",
    ])
    expect(result?.categories).toEqual(["ropa", "camisetas"])

    expect(calls).toHaveLength(2)
    expect(calls[1]).toMatchObject({
      table: "product_variants",
      mode: "many",
      filters: {
        product_id: "product-1",
        organization_id: "org-1",
      },
    })
  })

  it("reconstruye el título de la variante desde option_values cuando title viene vacío", async () => {
    const { client } = createMockClient({
      productResult: {
        data: {
          id: "product-1",
          organization_id: "org-1",
          name: "Arena",
        },
        error: null,
      },
      variantsResult: {
        data: [
          {
            id: "variant-1",
            product_id: "product-1",
            organization_id: "org-1",
            title: "",
            sku: null,
            position: 0,
            is_default: true,
            is_active: true,
            price: 79900,
            compare_at_price: null,
            stock_quantity: 10,
            image_url: null,
            option_values: [
              { option_name: "Fragancia", value: "Manzana" },
              { option_name: "Presentación", value: "25 Kg" },
            ],
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ],
        error: null,
      },
    })

    const result = await getProductWithVariants({
      productId: "product-1",
      organizationId: "org-1",
      client,
    })

    expect(result?.default_variant?.title).toBe("Manzana / 25 Kg")
    expect(result?.variants[0]?.title).toBe("Manzana / 25 Kg")
  })

  it("lanza error si falla la lectura del producto", async () => {
    const { client } = createMockClient({
      productResult: { data: null, error: { message: "db exploded" } },
      variantsResult: { data: [], error: null },
    })

    await expect(
      getProductWithVariants({
        productId: "product-1",
        organizationId: "org-1",
        client,
      }),
    ).rejects.toThrow("Error fetching product product-1: db exploded")
  })

  it("lanza error si falla la lectura de variantes", async () => {
    const { client } = createMockClient({
      productResult: {
        data: {
          id: "product-1",
          organization_id: "org-1",
          name: "Camiseta",
        },
        error: null,
      },
      variantsResult: { data: null, error: { message: "variants exploded" } },
    })

    await expect(
      getProductWithVariants({
        productId: "product-1",
        organizationId: "org-1",
        client,
      }),
    ).rejects.toThrow("Error fetching variants for product product-1: variants exploded")
  })
})
