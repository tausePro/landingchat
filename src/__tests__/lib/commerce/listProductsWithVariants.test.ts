import { describe, expect, it } from "vitest"
import {
  listProductsWithVariants,
  type ListProductsWithVariantsParams,
} from "@/lib/commerce/listProductsWithVariants"

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
  greaterThanOrEqual: Record<string, unknown>
  lessThanOrEqual: Record<string, unknown>
  overlapsFilters: Record<string, unknown>
  selection: string
  limit?: number
  orders: Array<{
    column: string
    ascending: boolean
  }>
  orExpression: string | null
}

interface RpcCall {
  fn: string
  args: Record<string, unknown>
}

function createMockClient(params: {
  productsResults?: Array<MockQueryResult<unknown[] | null>>
  productsResult?: MockQueryResult<unknown[] | null>
  variantsResult: MockQueryResult<unknown[] | null>
  rpcResult?: MockQueryResult<unknown[] | null>
}) {
  const calls: QueryCall[] = []
  const rpcCalls: RpcCall[] = []
  // Algunos paths llaman products dos veces (search -> select por IDs).
  // Permite encolar resultados sucesivos; si no hay queue, usa productsResult.
  const productsQueue = [...(params.productsResults ?? [])]

  function nextProductsResult(): MockQueryResult<unknown[] | null> {
    if (productsQueue.length > 0) {
      return productsQueue.shift()!
    }
    return params.productsResult ?? { data: [], error: null }
  }

  const client = {
    from(table: string) {
      const filters: Record<string, unknown> = {}
      const excludedFilters: Record<string, unknown> = {}
      const inFilters: Record<string, unknown[]> = {}
      const greaterThanOrEqual: Record<string, unknown> = {}
      const lessThanOrEqual: Record<string, unknown> = {}
      const overlapsFilters: Record<string, unknown> = {}
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
        gte(column: string, value: unknown) {
          greaterThanOrEqual[column] = value
          return builder
        },
        lte(column: string, value: unknown) {
          lessThanOrEqual[column] = value
          return builder
        },
        overlaps(column: string, value: unknown) {
          overlapsFilters[column] = value
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
            greaterThanOrEqual: { ...greaterThanOrEqual },
            lessThanOrEqual: { ...lessThanOrEqual },
            overlapsFilters: { ...overlapsFilters },
            selection,
            limit,
            orders: [...orders],
            orExpression,
          })

          if (table === "products") {
            return Promise.resolve(nextProductsResult()).then(...args)
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
    async rpc(fn: string, args: Record<string, unknown>) {
      rpcCalls.push({ fn, args })
      return params.rpcResult ?? { data: [], error: null }
    },
  } as unknown as Parameters<typeof listProductsWithVariants>[0]["client"]

  return { client, calls, rpcCalls }
}

describe("listProductsWithVariants", () => {
  it("construye el listado variant-centric (path B sin search) preservando fallback legacy", async () => {
    const { client, calls, rpcCalls } = createMockClient({
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
            variants: [
              {
                type: "Talla",
                values: ["S", "M"],
                hasPriceAdjustment: true,
                variantPrices: {
                  "Talla:S": 65000,
                  "Talla:M": 68000,
                },
              },
            ],
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
            variants: [],
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
      limit: 10,
    })

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      id: "product-1",
      slug: "camiseta-premium",
      legacy_price: 80000,
      legacy_sale_price: 70000,
      legacy_stock: 9,
      legacy_variants: [{
        type: "Talla",
        values: ["S", "M"],
        hasPriceAdjustment: true,
        variantPrices: {
          "Talla:S": 65000,
          "Talla:M": 68000,
        },
      }],
      badge_id: "badge-1",
    })
    expect(result[0].default_variant?.price).toBe(65000)
    expect(result[1]).toMatchObject({
      id: "product-2",
      slug: null,
      legacy_price: 45000,
      legacy_sale_price: null,
      legacy_stock: 2,
      legacy_variants: [],
      badge_id: null,
    })

    expect(rpcCalls).toHaveLength(0)
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
      orExpression: null,
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

  it("con search llama la RPC search_products y respeta el orden de relevancia", async () => {
    const { client, calls, rpcCalls } = createMockClient({
      rpcResult: {
        data: [
          { product_id: "product-2", rank: 0.82, similarity: 0 },
          { product_id: "product-1", rank: 0.41, similarity: 0 },
        ],
        error: null,
      },
      productsResults: [
        {
          // SELECT por IDs viene DESORDENADO (Postgres no preserva el orden
          // del IN clause). El código debe reordenar usando el ranking RPC.
          data: [
            {
              id: "product-1",
              organization_id: "org-1",
              slug: "camiseta-premium",
              name: "Camiseta Premium",
              description: null,
              image_url: null,
              images: [],
              categories: ["ropa"],
              is_active: true,
              has_quantity_pricing: false,
              price_tiers: null,
              price: 80000,
              sale_price: null,
              stock: 5,
              variants: [],
              badge_id: null,
              created_at: "2026-01-01T00:00:00Z",
            },
            {
              id: "product-2",
              organization_id: "org-1",
              slug: "camiseta-basica",
              name: "Camiseta Básica",
              description: null,
              image_url: null,
              images: [],
              categories: ["ropa"],
              is_active: true,
              has_quantity_pricing: false,
              price_tiers: null,
              price: 30000,
              sale_price: null,
              stock: 12,
              variants: [],
              badge_id: null,
              created_at: "2026-01-02T00:00:00Z",
            },
          ],
          error: null,
        },
      ],
      variantsResult: { data: [], error: null },
    })

    const result = await listProductsWithVariants({
      organizationId: "org-1",
      client,
      search: "camiseta",
      limit: 10,
      minPrice: 1000,
      maxPrice: 100000,
      categories: ["ropa"],
    })

    expect(rpcCalls).toHaveLength(1)
    expect(rpcCalls[0]).toEqual({
      fn: "search_products",
      args: {
        p_organization_id: "org-1",
        p_query: "camiseta",
        p_min_price: 1000,
        p_max_price: 100000,
        p_categories: ["ropa"],
        p_limit: 10,
      },
    })

    // El orden devuelto debe ser product-2 (rank mayor) antes que product-1
    expect(result.map((p) => p.id)).toEqual(["product-2", "product-1"])

    // Tras la RPC se hace SELECT por IDs y luego variants
    expect(calls).toHaveLength(2)
    expect(calls[0]).toMatchObject({
      table: "products",
      inFilters: { id: ["product-2", "product-1"] },
    })
    expect(calls[1]).toMatchObject({
      table: "product_variants",
      inFilters: { product_id: expect.arrayContaining(["product-1", "product-2"]) },
    })
  })

  it("con search sin resultados de la RPC devuelve arreglo vacío sin tocar products", async () => {
    const { client, calls, rpcCalls } = createMockClient({
      rpcResult: { data: [], error: null },
      variantsResult: { data: [], error: null },
    })

    const result = await listProductsWithVariants({
      organizationId: "org-1",
      client,
      search: "shampu",
      limit: 10,
    })

    expect(result).toEqual([])
    expect(rpcCalls).toHaveLength(1)
    expect(calls).toEqual([])
  })

  it("propaga errores de la RPC search_products", async () => {
    const { client } = createMockClient({
      rpcResult: { data: null, error: { message: "rpc broke" } },
      variantsResult: { data: [], error: null },
    })

    await expect(
      listProductsWithVariants({
        organizationId: "org-1",
        client,
        search: "camiseta",
      }),
    ).rejects.toThrow("Error searching products for organization org-1: rpc broke")
  })

  it("aplica filtros gte/lte/overlaps en el path sin search", async () => {
    const { client, calls, rpcCalls } = createMockClient({
      productsResult: { data: [], error: null },
      variantsResult: { data: [], error: null },
    })

    await listProductsWithVariants({
      organizationId: "org-1",
      client,
      minPrice: 5000,
      maxPrice: 50000,
      categories: ["ropa", "accesorios"],
    })

    expect(rpcCalls).toEqual([])
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      table: "products",
      filters: { organization_id: "org-1" },
      excludedFilters: { is_active: false },
      greaterThanOrEqual: { price: 5000 },
      lessThanOrEqual: { price: 50000 },
      overlapsFilters: { categories: ["ropa", "accesorios"] },
    })
  })

  it("ignora filtros invalidos (precio negativo, categorías vacías)", async () => {
    const { client, calls } = createMockClient({
      productsResult: { data: [], error: null },
      variantsResult: { data: [], error: null },
    })

    await listProductsWithVariants({
      organizationId: "org-1",
      client,
      minPrice: -100,
      maxPrice: undefined,
      categories: ["", "   "],
    })

    expect(calls[0]).toMatchObject({
      greaterThanOrEqual: {},
      lessThanOrEqual: {},
      overlapsFilters: {},
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
