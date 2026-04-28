import { describe, expect, it } from "vitest"
import type { ProductVariantDraft } from "@/lib/commerce/variantDrafts"
import {
  syncVariantDrafts,
  type SyncVariantDraftsClient,
} from "@/lib/commerce/syncVariantDrafts"

interface MockError {
  message: string
}

interface ExistingRow {
  id: string
  position: number | string
}

interface RecordedOperation {
  table: string
  operation: "insert" | "update" | "delete"
  values?: unknown
  filters: Record<string, unknown>
}

function makeDraft(overrides: Partial<ProductVariantDraft> = {}): ProductVariantDraft {
  return {
    title: overrides.title ?? "Default",
    sku: overrides.sku ?? null,
    position: overrides.position ?? 0,
    is_default: overrides.is_default ?? false,
    is_active: overrides.is_active ?? true,
    price: overrides.price ?? 50000,
    compare_at_price: overrides.compare_at_price ?? null,
    stock_quantity: overrides.stock_quantity ?? 10,
    image_url: overrides.image_url ?? null,
    option_values: overrides.option_values ?? [],
  }
}

function createMockClient(params: {
  existingRows?: ExistingRow[]
  existingError?: MockError | null
  insertError?: MockError | null
  updateError?: MockError | null
  deleteError?: MockError | null
}) {
  const operations: RecordedOperation[] = []

  const client = {
    from(table: string) {
      const filters: Record<string, unknown> = {}
      let operation: RecordedOperation["operation"] | null = null
      let values: unknown

      const builder = {
        select() {
          return builder
        },
        update(nextValues: unknown) {
          operation = "update"
          values = nextValues
          return builder
        },
        insert(nextValues: unknown) {
          operations.push({
            table,
            operation: "insert",
            values: nextValues,
            filters: {},
          })
          return Promise.resolve({ error: params.insertError ?? null })
        },
        delete() {
          operation = "delete"
          return builder
        },
        eq(column: string, value: unknown) {
          filters[column] = value

          if (operation === "update" && Object.keys(filters).length >= 2) {
            operations.push({
              table,
              operation,
              values,
              filters: { ...filters },
            })
            return Promise.resolve({ error: params.updateError ?? null })
          }

          if (operation === "delete" && Object.keys(filters).length >= 2) {
            operations.push({
              table,
              operation,
              values,
              filters: { ...filters },
            })
            return Promise.resolve({ error: params.deleteError ?? null })
          }

          return builder
        },
        in(column: string, value: unknown) {
          filters[column] = value
          return builder
        },
        order() {
          return Promise.resolve({
            data: params.existingRows ?? [],
            error: params.existingError ?? null,
          })
        },
      }

      return builder
    },
  }

  return {
    client: client as unknown as SyncVariantDraftsClient,
    operations,
  }
}

describe("syncVariantDrafts", () => {
  it("actualiza posiciones existentes, inserta nuevas y elimina sobrantes", async () => {
    const { client, operations } = createMockClient({
      existingRows: [
        { id: "variant-0", position: 0 },
        { id: "variant-2", position: 2 },
      ],
    })

    const result = await syncVariantDrafts({
      client,
      productId: "product-1",
      organizationId: "org-1",
      drafts: [
        makeDraft({ title: "Rojo", position: 0, is_default: true }),
        makeDraft({ title: "Azul", position: 1 }),
      ],
    })

    expect(result).toEqual({ inserted: 1, updated: 1, deleted: 1 })
    expect(operations.map((operation) => operation.operation)).toEqual(["update", "insert", "delete"])
    expect(operations[0]).toMatchObject({
      table: "product_variants",
      operation: "update",
      filters: {
        id: "variant-0",
        organization_id: "org-1",
      },
    })
    expect(operations[1]?.values).toMatchObject({
      product_id: "product-1",
      organization_id: "org-1",
      title: "Azul",
      position: 1,
    })
    expect(operations[2]?.filters).toMatchObject({
      id: ["variant-2"],
      organization_id: "org-1",
    })
  })

  it("normaliza posiciones existentes como string", async () => {
    const { client, operations } = createMockClient({
      existingRows: [{ id: "variant-0", position: "0" }],
    })

    const result = await syncVariantDrafts({
      client,
      productId: "product-1",
      organizationId: "org-1",
      drafts: [makeDraft({ position: 0, is_default: true })],
    })

    expect(result).toEqual({ inserted: 0, updated: 1, deleted: 0 })
    expect(operations).toHaveLength(1)
    expect(operations[0]?.operation).toBe("update")
  })

  it("propaga errores al cargar variantes existentes", async () => {
    const { client } = createMockClient({
      existingError: { message: "select failed" },
    })

    await expect(syncVariantDrafts({
      client,
      productId: "product-1",
      organizationId: "org-1",
      drafts: [makeDraft()],
    })).rejects.toThrow("select failed")
  })

  it("propaga errores de escritura", async () => {
    const { client } = createMockClient({
      existingRows: [{ id: "variant-0", position: 0 }],
      updateError: { message: "update failed" },
    })

    await expect(syncVariantDrafts({
      client,
      productId: "product-1",
      organizationId: "org-1",
      drafts: [makeDraft({ position: 0 })],
    })).rejects.toThrow("update failed")
  })
})
