import { describe, expect, it } from "vitest"
import {
  ecommerceToolHandlers,
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

// =============================================================================
// Regresión bug add_to_cart: el executor search_products debe delegar la
// búsqueda textual en el RPC search_products (FTS + f_unaccent + fuzzy).
// Antes usaba ilike sobre nombres acentuados y fallaba con queries normalizadas
// (ej. "renovacion" no matcheaba "RENOVACIÓN").
// =============================================================================

interface MockQueryResult<T> {
  data: T
  error: { message: string } | null
}

interface RpcCall {
  fn: string
  args: Record<string, unknown>
}

interface SelectCall {
  table: string
  filters: Record<string, unknown>
  inFilters: Record<string, unknown[]>
  containsFilters: Record<string, unknown>
  selection: string
  limit?: number
  orders: Array<{ column: string; ascending: boolean }>
}

function createSearchMockClient(params: {
  rpcResult?: MockQueryResult<unknown[] | null>
  productsResult?: MockQueryResult<unknown[] | null>
  variantsResult?: MockQueryResult<unknown[] | null>
}) {
  const rpcCalls: RpcCall[] = []
  const selectCalls: SelectCall[] = []

  const client = {
    from(table: string) {
      const filters: Record<string, unknown> = {}
      const inFilters: Record<string, unknown[]> = {}
      const containsFilters: Record<string, unknown> = {}
      let selection = ""
      let limit: number | undefined
      const orders: SelectCall["orders"] = []

      const builder = {
        select(value: string) {
          selection = value
          return builder
        },
        eq(column: string, value: unknown) {
          filters[column] = value
          return builder
        },
        in(column: string, values: unknown[]) {
          inFilters[column] = values
          return builder
        },
        contains(column: string, value: unknown) {
          containsFilters[column] = value
          return builder
        },
        order(column: string, options?: { ascending?: boolean }) {
          orders.push({ column, ascending: options?.ascending ?? true })
          return builder
        },
        limit(value: number) {
          limit = value
          return builder
        },
        then(...args: Parameters<Promise<MockQueryResult<unknown[] | null>>["then"]>) {
          selectCalls.push({
            table,
            filters: { ...filters },
            inFilters: { ...inFilters },
            containsFilters: { ...containsFilters },
            selection,
            limit,
            orders: [...orders],
          })

          if (table === "products") {
            return Promise.resolve(
              params.productsResult ?? { data: [], error: null },
            ).then(...args)
          }

          if (table === "product_variants") {
            return Promise.resolve(
              params.variantsResult ?? { data: [], error: null },
            ).then(...args)
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
  }

  return { client, rpcCalls, selectCalls }
}

describe("AI ecommerce executor search_products (regresión bug add_to_cart)", () => {
  const context = {
    chatId: "chat-1",
    organizationId: "org-1",
  }

  it("delega en RPC search_products con query trimmed cuando hay texto", async () => {
    const { client, rpcCalls } = createSearchMockClient({
      rpcResult: { data: [{ product_id: "p1", rank: 0.5, similarity: 0 }], error: null },
      productsResult: {
        data: [
          {
            id: "p1",
            name: "RENOVACIÓN energética",
            description: null,
            price: 100000,
            sale_price: null,
            image_url: null,
            images: [],
            stock: 10,
            categories: ["servicios"],
            variants: [],
          },
        ],
        error: null,
      },
      variantsResult: { data: [], error: null },
    })

    const handler = ecommerceToolHandlers["search_products"]!
    const result = await handler(
      client as never,
      { query: "  renovacion  ", limit: 10 },
      context,
    )

    expect(rpcCalls).toHaveLength(1)
    expect(rpcCalls[0]).toEqual({
      fn: "search_products",
      args: {
        p_organization_id: "org-1",
        p_query: "renovacion",
        p_min_price: null,
        p_max_price: null,
        p_categories: null,
        p_limit: 10,
      },
    })

    expect(result.success).toBe(true)
    expect(result.data?.totalFound).toBe(1)
    expect(result.data?.products[0]).toMatchObject({
      id: "p1",
      name: "RENOVACIÓN energética",
    })
  })

  it("preserva el orden de relevancia del RPC aunque el SELECT regrese desordenado", async () => {
    const { client } = createSearchMockClient({
      rpcResult: {
        data: [
          { product_id: "p2", rank: 0.9, similarity: 0 },
          { product_id: "p1", rank: 0.3, similarity: 0 },
        ],
        error: null,
      },
      productsResult: {
        // Postgres no garantiza orden con IN, simulamos respuesta invertida
        data: [
          {
            id: "p1",
            name: "Producto uno",
            description: null,
            price: 1000,
            sale_price: null,
            image_url: null,
            images: [],
            stock: 5,
            categories: [],
            variants: [],
          },
          {
            id: "p2",
            name: "Producto dos",
            description: null,
            price: 2000,
            sale_price: null,
            image_url: null,
            images: [],
            stock: 5,
            categories: [],
            variants: [],
          },
        ],
        error: null,
      },
      variantsResult: { data: [], error: null },
    })

    const handler = ecommerceToolHandlers["search_products"]!
    const result = await handler(
      client as never,
      { query: "producto" },
      context,
    )

    expect(result.success).toBe(true)
    expect(result.data?.products.map((p: { id: string }) => p.id)).toEqual(["p2", "p1"])
  })

  it("propaga categoría al RPC como array de un elemento", async () => {
    const { client, rpcCalls } = createSearchMockClient({
      rpcResult: { data: [], error: null },
    })

    const handler = ecommerceToolHandlers["search_products"]!
    await handler(
      client as never,
      { query: "camisa", category: "ropa", limit: 5 },
      context,
    )

    expect(rpcCalls[0]?.args).toMatchObject({
      p_categories: ["ropa"],
      p_limit: 5,
    })
  })

  it("retorna lista vacía sin consultar products cuando el RPC no encuentra coincidencias", async () => {
    const { client, selectCalls } = createSearchMockClient({
      rpcResult: { data: [], error: null },
    })

    const handler = ecommerceToolHandlers["search_products"]!
    const result = await handler(client as never, { query: "noexiste" }, context)

    expect(result).toEqual({
      success: true,
      data: { products: [], totalFound: 0 },
    })
    expect(selectCalls).toEqual([])
  })

  it("propaga error del RPC al agente", async () => {
    const { client } = createSearchMockClient({
      rpcResult: { data: null, error: { message: "rpc broke" } },
    })

    const handler = ecommerceToolHandlers["search_products"]!
    const result = await handler(client as never, { query: "test" }, context)

    expect(result).toEqual({ success: false, error: "rpc broke" })
  })

  it("no llama al RPC cuando no hay query (modo browse), ordena por stock", async () => {
    const { client, rpcCalls, selectCalls } = createSearchMockClient({
      productsResult: { data: [], error: null },
    })

    const handler = ecommerceToolHandlers["search_products"]!
    await handler(client as never, { category: "ropa" }, context)

    expect(rpcCalls).toEqual([])
    expect(selectCalls).toHaveLength(1)
    expect(selectCalls[0]).toMatchObject({
      table: "products",
      containsFilters: { categories: ["ropa"] },
      orders: [{ column: "stock", ascending: false }],
    })
  })
})

// =============================================================================
// Regresión bug envío gratis: get_shipping_options ofrecía "Envío Gratis"
// (price 0) cuando free_shipping_enabled estaba activo, SIN exigir que el
// subtotal del carrito alcanzara free_shipping_min_amount. Resultado: clientes
// por debajo del mínimo (ej. 13.500 con mínimo 15.000) recibían envío gratis.
// =============================================================================

function createShippingMockClient(params: {
  shippingSettings: Record<string, unknown> | null
  cartItems: unknown[]
}) {
  const client = {
    from(table: string) {
      const builder = {
        select() {
          return builder
        },
        eq() {
          return builder
        },
        single() {
          if (table === "shipping_settings") {
            return Promise.resolve({ data: params.shippingSettings, error: null })
          }
          if (table === "carts") {
            return Promise.resolve({ data: { items: params.cartItems }, error: null })
          }
          return Promise.resolve({
            data: null,
            error: { message: `Unexpected query on ${table}` },
          })
        },
      }
      return builder
    },
  }
  return { client }
}

describe("AI ecommerce executor get_shipping_options (regresión bug envío gratis)", () => {
  const context = { chatId: "chat-1", organizationId: "org-1" }
  const cartLine = (unitPrice: number) => ({
    product_id: "p1",
    product_name: "Producto",
    unit_price: unitPrice,
    quantity: 1,
  })

  it("NO ofrece envío gratis cuando el subtotal está por debajo del mínimo", async () => {
    const { client } = createShippingMockClient({
      shippingSettings: {
        default_shipping_rate: 8000,
        free_shipping_enabled: true,
        free_shipping_min_amount: 15000,
        free_shipping_zones: null,
        estimated_delivery_days: 3,
      },
      cartItems: [cartLine(13500)],
    })

    const handler = ecommerceToolHandlers["get_shipping_options"]!
    const result = await handler(client as never, { city: "Bogotá" }, context)

    expect(result.success).toBe(true)
    expect(result.data?.meetsFreeShippingMinimum).toBe(false)
    expect(result.data?.remainingForFreeShipping).toBe(1500)
    const ids = result.data?.options.map((o: { id: string }) => o.id)
    expect(ids).not.toContain("free")
    expect(ids).toContain("standard")
    const standard = result.data?.options.find((o: { id: string }) => o.id === "standard")
    expect(standard?.price).toBe(8000)
  })

  it("ofrece envío gratis cuando el subtotal alcanza el mínimo", async () => {
    const { client } = createShippingMockClient({
      shippingSettings: {
        default_shipping_rate: 8000,
        free_shipping_enabled: true,
        free_shipping_min_amount: 15000,
        free_shipping_zones: null,
        estimated_delivery_days: 3,
      },
      cartItems: [cartLine(20000)],
    })

    const handler = ecommerceToolHandlers["get_shipping_options"]!
    const result = await handler(client as never, { city: "Bogotá" }, context)

    expect(result.success).toBe(true)
    expect(result.data?.meetsFreeShippingMinimum).toBe(true)
    expect(result.data?.remainingForFreeShipping).toBe(0)
    const free = result.data?.options.find((o: { id: string }) => o.id === "free")
    expect(free?.price).toBe(0)
  })
})
