import type { ProductVariantDraft } from "@/lib/commerce/variantDrafts"
import type { createClient } from "@/lib/supabase/server"

export type SyncVariantDraftsClient = Pick<Awaited<ReturnType<typeof createClient>>, "from">

export interface SyncVariantDraftsParams {
  client: SyncVariantDraftsClient
  productId: string
  organizationId: string
  drafts: ProductVariantDraft[]
}

export interface SyncVariantDraftsResult {
  inserted: number
  updated: number
  deleted: number
}

interface ExistingVariantIdentity {
  id: string
  position: number
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) {
    return null
  }

  return value as Record<string, unknown>
}

function normalizeExistingVariant(value: unknown): ExistingVariantIdentity | null {
  const record = asRecord(value)
  if (!record) {
    return null
  }

  const id = typeof record.id === "string" ? record.id : null
  const rawPosition = record.position
  const position = typeof rawPosition === "number"
    ? rawPosition
    : typeof rawPosition === "string"
      ? Number(rawPosition)
      : Number.NaN

  if (!id || !Number.isInteger(position) || position < 0) {
    return null
  }

  return { id, position }
}

function buildVariantRow(
  productId: string,
  organizationId: string,
  draft: ProductVariantDraft,
): Record<string, unknown> {
  return {
    product_id: productId,
    organization_id: organizationId,
    title: draft.title,
    sku: draft.sku,
    position: draft.position,
    is_default: draft.is_default,
    is_active: draft.is_active,
    price: draft.price,
    compare_at_price: draft.compare_at_price,
    stock_quantity: draft.stock_quantity,
    image_url: draft.image_url,
    option_values: draft.option_values,
  }
}

export async function syncVariantDrafts({
  client,
  productId,
  organizationId,
  drafts,
}: SyncVariantDraftsParams): Promise<SyncVariantDraftsResult> {
  const { data: existingRows, error: existingError } = await client
    .from("product_variants")
    .select("id, position")
    .eq("product_id", productId)
    .eq("organization_id", organizationId)
    .order("position", { ascending: true })

  if (existingError) {
    throw new Error(existingError.message)
  }

  const existingVariants = (existingRows ?? [])
    .map((row) => normalizeExistingVariant(row))
    .filter((row): row is ExistingVariantIdentity => row !== null)
  const existingByPosition = new Map(existingVariants.map((row) => [row.position, row]))
  const draftPositions = new Set(drafts.map((draft) => draft.position))
  let inserted = 0
  let updated = 0

  for (const draft of drafts) {
    const existing = existingByPosition.get(draft.position)
    const row = buildVariantRow(productId, organizationId, draft)

    if (existing) {
      const { error } = await client
        .from("product_variants")
        .update(row)
        .eq("id", existing.id)
        .eq("organization_id", organizationId)

      if (error) {
        throw new Error(error.message)
      }

      updated += 1
      continue
    }

    const { error } = await client
      .from("product_variants")
      .insert(row)

    if (error) {
      throw new Error(error.message)
    }

    inserted += 1
  }

  const staleIds = existingVariants
    .filter((row) => !draftPositions.has(row.position))
    .map((row) => row.id)

  if (staleIds.length > 0) {
    const { error } = await client
      .from("product_variants")
      .delete()
      .in("id", staleIds)
      .eq("organization_id", organizationId)

    if (error) {
      throw new Error(error.message)
    }
  }

  return {
    inserted,
    updated,
    deleted: staleIds.length,
  }
}
