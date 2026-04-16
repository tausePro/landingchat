import { describe, expect, it } from "vitest"
import {
  listProductsWithVariants,
  type ListProductsWithVariantsParams,
} from "@/lib/commerce/listProductsWithVariants"
import type { ProductWithVariantsClient } from "@/lib/commerce/getProductWithVariants"

interface MockError {
  message: string
}

interface MockQueryResult<T> {
  data: T
  error: MockError | null
}

interface QueryCall {
  table: string
  filters: Record<string, unknown>
  excludedFilters: Record<string, unknown>
  inFilters: Record<string, unknown[]>
  selection: string
  limit?: number
  orders: Array<{
    column: string
    ascending: boolean
  }>
  orExpression: string | null
}

function createMockClient(params: {
  productsResult: MockQueryResult<unknown[] | null>
  variantsResult: MockQueryResult<unknown[] | null>
}) {
  const calls: QueryCall[] = []

  const client = {
    from(table: string) {
      const filters: Record<string, unknown> = {}
      const excludedFilters: Record<string, unknown> = {}
      const inFilters: Record<string, unknown[]> = {}
      let selection = ""
      let limit: number | undefined
      const orders: QueryCall["orders"] = []
      let orExpression: string | null = null

      const builder = {
        select(value: string) {
          selection = value
          return builder
        },
        eq(column: string, value: unknown) {
          filters[column] = value
          return builder
        },
        neq(column: string, value: unknown) {
          excludedFilters[column] = value
          return builder
        },
        in(column: string, values: unknown[]) {
          inFilters[column] = values
          return builder
        },
        or(value: string) {
          orExpression = value
          return builder
        },
        order(column: string, options?: { ascending?: boolean }) {
          orders.push({
            column,
            ascending: options?.ascending ?? true,
          })
          return builder
        },
        limit(value: number) {
          limit = value
          return builder
        },
        then(...args: Parameters<Promise<MockQueryResult<unknown[] | null>>["then"]>) {
          calls.push({
            table,
            filters: { ...filters },
            excludedFilters: { ...excludedFilters },
            inFilters: { ...inFilters },
            selection,
            limit,
            orders: [...orders],
            orExpression,
          })

          if (table === "products") {
            return Promise.resolve(params.productsResult).then(...args)
          }

          if (table === "product_variants") {
            return Promise.resolve(params.variantsResult).then(...args)
          }

          return Promise.resolve({
            data: null,
            error: { message: `Unexpected query on ${table}` },
          }).then(...args)
        },
      }

      return builder
    },
  } as unknown as ProductWithVariantsClient

  return { client, calls }
}

describe("listProductsWithVariants", () => {
  it("construye el listado variant-centric preservando fallback legacy", async () => {
    const { client, calls } = createMockClient({
      productsResult: {
        data: [
          {
            id: "product-1",
            organization_id: "org-1",
            slug: "camiseta-premium",
            name: "Camiseta Premium",
            description: "Algodón pesado",
            image_url: "https://example.com/legacy.jpg",
            images: ["https://example.com/legacy.jpg"],
            categories: ["ropa"],
            is_active: true,
            has_quantity_pricing: false,
            price_tiers: null,
            price: 80000,
            sale_price: 70000,
            stock: 9,
            badge_id: "badge-1",
            created_at: "2026-01-01T00:00:00Z",
          },
          {
            id: "product-2",
            organization_id: "org-1",
            slug: null,
            name: "Gorra",
            description: null,
            image_url: null,
            images: ["https://example.com/gorra.jpg"],
            categories: ["accesorios"],
            is_active: true,
            has_quantity_pricing: false,
            price_tiers: null,
            price: "45000",
            sale_price: null,
            stock: "2",
            badge_id: null,
            created_at: "2026-01-02T00:00:00Z",
          },
        ],
        error: null,
      },
      variantsResult: {
        data: [
          {
            id: "variant-1",
            product_id: "product-1",
            organization_id: "org-1",
            title: "Default",
            sku: "SKU-1",
            position: 0,
            is_default: true,
            is_active: true,
            price: "65000",
            compare_at_price: null,
            stock_quantity: 4,
            image_url: "https://example.com/variant.jpg",
            option_values: [],
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ],
        error: null,
      },
    })

    const result = await listProductsWithVariants({
      organizationId: "org-1",
      client,
      search: "camiseta",
      limit: 10,
    })

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      id: "product-1",
      slug: "camiseta-premium",
      legacy_price: 80000,
      legacy_sale_price: 70000,
      legacy_stock: 9,
      badge_id: "badge-1",
    })
    expect(result[0].default_variant?.price).toBe(65000)
    expect(result[1]).toMatchObject({
      id: "product-2",
      slug: null,
      legacy_price: 45000,
      legacy_sale_price: null,
      legacy_stock: 2,
      badge_id: null,
    })

    expect(calls).toHaveLength(2)
    expect(calls[0]).toMatchObject({
      table: "products",
      filters: {
        organization_id: "org-1",
      },
      excludedFilters: {
        is_active: false,
      },
      limit: 10,
      orders: [{
        column: "created_at",
        ascending: false,
      }],
      orExpression: "name.ilike.%camiseta%,description.ilike.%camiseta%",
    })
    expect(calls[1]).toMatchObject({
      table: "product_variants",
      filters: {
        organization_id: "org-1",
      },
      inFilters: {
        product_id: ["product-1", "product-2"],
      },
    })
  })

  it("devuelve arreglo vacío sin consultar variantes si no hay productos", async () => {
    const { client, calls } = createMockClient({
      productsResult: { data: [], error: null },
      variantsResult: { data: [], error: null },
    })

    const result = await listProductsWithVariants({
      organizationId: "org-1",
      client,
    })

    expect(result).toEqual([])
    expect(calls).toHaveLength(1)
    expect(calls[0].table).toBe("products")
  })

  it("lanza error si falla la lectura de variantes", async () => {
    const { client } = createMockClient({
      productsResult: {
        data: [
          {
            id: "product-1",
            organization_id: "org-1",
            name: "Camiseta",
          },
        ],
        error: null,
      },
      variantsResult: {
        data: null,
        error: { message: "variants exploded" },
      },
    })

    await expect(
      listProductsWithVariants({
        organizationId: "org-1",
        client,
      }),
    ).rejects.toThrow("Error fetching product variants for organization org-1: variants exploded")
  })

  it("normaliza límites inválidos y permite desactivar el filtro activo", async () => {
    const { client, calls } = createMockClient({
      productsResult: { data: [], error: null },
      variantsResult: { data: [], error: null },
    })

    const params: ListProductsWithVariantsParams = {
      organizationId: "org-1",
      client,
      limit: Number.NaN,
      activeOnly: false,
    }

    await listProductsWithVariants(params)

    expect(calls[0]).toMatchObject({
      limit: 20,
      excludedFilters: {},
      orders: [{
        column: "created_at",
        ascending: false,
      }],
      orExpression: null,
    })
  })

  it("respeta el orden configurable del storefront", async () => {
    const { client, calls } = createMockClient({
      productsResult: { data: [], error: null },
      variantsResult: { data: [], error: null },
    })

    await listProductsWithVariants({
      organizationId: "org-1",
      client,
      orderBy: "custom",
    })

    expect(calls[0]).toMatchObject({
      orders: [
        {
          column: "display_order",
          ascending: true,
        },
        {
          column: "created_at",
          ascending: false,
        },
      ],
    })
  })
})
