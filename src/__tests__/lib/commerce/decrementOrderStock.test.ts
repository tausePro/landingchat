import type { SupabaseClient } from "@supabase/supabase-js"
import { describe, expect, it } from "vitest"
import { decrementOrderStock } from "@/lib/commerce/decrementOrderStock"

interface MockError {
  message: string
}

interface MockOrder {
  id: string
  items: unknown
  stock_decremented_at: string | null
}

interface MockQueryResult<T> {
  data: T
  error: MockError | null
}

interface RpcCall {
  name: string
  args: Record<string, unknown>
}

interface UpdateCall {
  table: string
  values: Record<string, unknown>
  filters: Record<string, unknown>
}

interface RpcRow {
  previous_stock: number
  new_stock: number
  was_sufficient: boolean
  variant_updated: boolean
}

interface RpcResult {
  data: RpcRow[] | RpcRow | null
  error: MockError | null
}

interface MockQueryBuilder {
  select(selection: string): MockQueryBuilder
  update(values: Record<string, unknown>): MockQueryBuilder
  eq(column: string, value: unknown): MockQueryBuilder
  maybeSingle(): Promise<MockQueryResult<MockOrder | null>>
}

function createMockClient(params: {
  orderResult: MockQueryResult<MockOrder | null>
  rpcResults?: RpcResult[]
}) {
  const rpcResults = [...(params.rpcResults ?? [])]
  const calls = {
    rpcs: [] as RpcCall[],
    updates: [] as UpdateCall[],
  }

  const client = {
    from(table: string): MockQueryBuilder {
      const filters: Record<string, unknown> = {}
      let updateValues: Record<string, unknown> | null = null

      const builder: MockQueryBuilder = {
        select() {
          return builder
        },
        update(values: Record<string, unknown>) {
          updateValues = values
          return builder
        },
        eq(column: string, value: unknown) {
          filters[column] = value

          if (updateValues && Object.keys(filters).length >= 2) {
            calls.updates.push({
              table,
              values: updateValues,
              filters: { ...filters },
            })
          }

          return builder
        },
        async maybeSingle() {
          return params.orderResult
        },
      }

      return builder
    },
    async rpc(name: string, args: Record<string, unknown>) {
      calls.rpcs.push({ name, args })

      return rpcResults.shift() ?? {
        data: [
          {
            previous_stock: 10,
            new_stock: 8,
            was_sufficient: true,
            variant_updated: true,
          },
        ],
        error: null,
      }
    },
  }

  return {
    calls,
    client: client as unknown as SupabaseClient,
  }
}

describe("decrementOrderStock", () => {
  it("omite el decremento cuando la orden ya fue decrementada", async () => {
    const { client, calls } = createMockClient({
      orderResult: {
        data: {
          id: "order-1",
          items: [{ product_id: "product-1", quantity: 2 }],
          stock_decremented_at: "2026-04-27T00:00:00.000Z",
        },
        error: null,
      },
    })

    const result = await decrementOrderStock(client, "order-1", "org-1")

    expect(result).toEqual({
      orderId: "order-1",
      organizationId: "org-1",
      skipped: true,
      reason: "already_decremented",
      items: [],
    })
    expect(calls.rpcs).toEqual([])
    expect(calls.updates).toEqual([])
  })

  it("decrementa items válidos y marca la orden como decrementada", async () => {
    const { client, calls } = createMockClient({
      orderResult: {
        data: {
          id: "order-1",
          items: [{ product_id: "product-1", quantity: 2 }],
          stock_decremented_at: null,
        },
        error: null,
      },
      rpcResults: [
        {
          data: [
            {
              previous_stock: 10,
              new_stock: 8,
              was_sufficient: true,
              variant_updated: true,
            },
          ],
          error: null,
        },
      ],
    })

    const result = await decrementOrderStock(client, "order-1", "org-1")

    expect(result.skipped).toBe(false)
    expect(result.items).toEqual([
      {
        productId: "product-1",
        quantity: 2,
        previousStock: 10,
        newStock: 8,
        wasSufficient: true,
        variantUpdated: true,
      },
    ])
    expect(calls.rpcs).toEqual([
      {
        name: "decrement_product_stock",
        args: {
          p_product_id: "product-1",
          p_organization_id: "org-1",
          p_quantity: 2,
        },
      },
    ])
    expect(calls.updates).toHaveLength(1)
    expect(calls.updates[0]).toMatchObject({
      table: "orders",
      filters: {
        id: "order-1",
        organization_id: "org-1",
      },
    })
    expect(calls.updates[0]?.values.stock_decremented_at).toEqual(expect.any(String))
  })

  it("no marca la orden como decrementada si la RPC falla", async () => {
    const { client, calls } = createMockClient({
      orderResult: {
        data: {
          id: "order-1",
          items: [{ product_id: "product-1", quantity: 2 }],
          stock_decremented_at: null,
        },
        error: null,
      },
      rpcResults: [
        {
          data: null,
          error: { message: "RPC unavailable" },
        },
      ],
    })

    const result = await decrementOrderStock(client, "order-1", "org-1")

    expect(result.skipped).toBe(false)
    expect(result.items).toEqual([
      {
        productId: "product-1",
        quantity: 2,
        previousStock: null,
        newStock: null,
        wasSufficient: false,
        variantUpdated: false,
        error: "RPC unavailable",
      },
    ])
    expect(calls.rpcs).toHaveLength(1)
    expect(calls.updates).toEqual([])
  })

  it("marca como decrementada una orden sin items para evitar reintentos inútiles", async () => {
    const { client, calls } = createMockClient({
      orderResult: {
        data: {
          id: "order-1",
          items: [],
          stock_decremented_at: null,
        },
        error: null,
      },
    })

    const result = await decrementOrderStock(client, "order-1", "org-1")

    expect(result).toMatchObject({
      orderId: "order-1",
      organizationId: "org-1",
      skipped: true,
      reason: "no_items",
      items: [],
    })
    expect(calls.rpcs).toEqual([])
    expect(calls.updates).toHaveLength(1)
  })
})
