"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import type { ProductEngagementSummary, ProductReview } from "@/types/product"
import { type ActionResult, success, failure } from "@/types/common"

const productIdSchema = z.string().uuid("ID de producto inválido")
const reviewIdSchema = z.string().uuid("ID de reseña inválido")

const createProductReviewSchema = z.object({
  author_name: z.string().min(1, "El nombre es obligatorio").max(120, "El nombre es demasiado largo"),
  author_role: z.string().max(120, "El rol es demasiado largo").optional().nullable(),
  title: z.string().max(160, "El título es demasiado largo").optional().nullable(),
  content: z.string().min(1, "El contenido es obligatorio").max(5000, "La reseña es demasiado larga"),
  rating: z.number().int().min(1, "La calificación mínima es 1").max(5, "La calificación máxima es 5"),
  verified_purchase: z.boolean().default(false),
  is_published: z.boolean().default(false),
})

const updateProductReviewSchema = createProductReviewSchema.partial()

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

type AuthContext = {
  supabase: SupabaseClient
  organizationId: string
}

type ProductContext = {
  id: string
  slug: string | null
}

async function getAuthenticatedContext(): Promise<AuthContext | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Unauthorized" }
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single()

  if (profileError || !profile?.organization_id) {
    return { error: "No organization found" }
  }

  return {
    supabase,
    organizationId: profile.organization_id,
  }
}

async function getScopedProduct(
  supabase: SupabaseClient,
  organizationId: string,
  productId: string,
): Promise<ProductContext | { error: string }> {
  const { data: product, error } = await supabase
    .from("products")
    .select("id, slug")
    .eq("id", productId)
    .eq("organization_id", organizationId)
    .single()

  if (error || !product) {
    return { error: "Producto no encontrado" }
  }

  return {
    id: product.id,
    slug: product.slug,
  }
}

async function revalidateReviewPaths(
  supabase: SupabaseClient,
  organizationId: string,
  productId: string,
  productSlug?: string | null,
) {
  revalidatePath("/dashboard/products")
  revalidatePath(`/dashboard/products/${productId}`)

  const [{ data: organization }, { data: product }] = await Promise.all([
    supabase
      .from("organizations")
      .select("slug")
      .eq("id", organizationId)
      .single(),
    productSlug
      ? Promise.resolve({ data: { slug: productSlug } })
      : supabase
        .from("products")
        .select("slug")
        .eq("id", productId)
        .single(),
  ])

  if (organization?.slug) {
    revalidatePath(`/store/${organization.slug}`)
    revalidatePath(`/store/${organization.slug}/producto/${product?.slug || productId}`)
  }
}

export async function getProductReviewsForDashboard(productId: string): Promise<ActionResult<ProductReview[]>> {
  const parsedId = productIdSchema.safeParse(productId)
  if (!parsedId.success) {
    return failure(parsedId.error.issues[0]?.message || "ID de producto inválido")
  }

  const authContext = await getAuthenticatedContext()
  if ("error" in authContext) {
    return failure(authContext.error)
  }

  const productContext = await getScopedProduct(authContext.supabase, authContext.organizationId, parsedId.data)
  if ("error" in productContext) {
    return failure(productContext.error)
  }

  const { data, error } = await authContext.supabase
    .from("product_reviews")
    .select("id, product_id, organization_id, customer_id, order_id, author_name, author_role, title, content, rating, verified_purchase, is_published, published_at, created_at, updated_at")
    .eq("organization_id", authContext.organizationId)
    .eq("product_id", productContext.id)
    .order("created_at", { ascending: false })

  if (error) {
    if (error.code === "42P01") {
      return failure("Aplica la migración 20260326_product_reviews_and_signals.sql para habilitar reseñas reales.")
    }

    return failure(error.message)
  }

  return success((data || []) as ProductReview[])
}

export async function getProductEngagementSummaryForDashboard(
  productId: string,
): Promise<ActionResult<ProductEngagementSummary>> {
  const parsedId = productIdSchema.safeParse(productId)
  if (!parsedId.success) {
    return failure(parsedId.error.issues[0]?.message || "ID de producto inválido")
  }

  const authContext = await getAuthenticatedContext()
  if ("error" in authContext) {
    return failure(authContext.error)
  }

  const productContext = await getScopedProduct(authContext.supabase, authContext.organizationId, parsedId.data)
  if ("error" in productContext) {
    return failure(productContext.error)
  }

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await authContext.supabase
    .from("product_engagement_events")
    .select("event_type, visitor_id")
    .eq("organization_id", authContext.organizationId)
    .eq("product_id", productContext.id)
    .gte("occurred_at", since)

  if (error) {
    if (error.code === "42P01") {
      return success({
        pageViews: 0,
        addToCartCount: 0,
        uniqueVisitors: 0,
      })
    }

    return failure(error.message)
  }

  const rows = data || []
  const uniqueVisitors = new Set(rows.map((row) => row.visitor_id).filter(Boolean)).size

  return success({
    pageViews: rows.filter((row) => row.event_type === "page_view").length,
    addToCartCount: rows.filter((row) => row.event_type === "add_to_cart").length,
    uniqueVisitors,
  })
}

export async function createProductReview(
  productId: string,
  input: z.infer<typeof createProductReviewSchema>,
): Promise<ActionResult<ProductReview>> {
  const parsedId = productIdSchema.safeParse(productId)
  if (!parsedId.success) {
    return failure(parsedId.error.issues[0]?.message || "ID de producto inválido")
  }

  const parsed = createProductReviewSchema.safeParse(input)
  if (!parsed.success) {
    return failure("Validation failed", parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }

  const authContext = await getAuthenticatedContext()
  if ("error" in authContext) {
    return failure(authContext.error)
  }

  const productContext = await getScopedProduct(authContext.supabase, authContext.organizationId, parsedId.data)
  if ("error" in productContext) {
    return failure(productContext.error)
  }

  const { data, error } = await authContext.supabase
    .from("product_reviews")
    .insert({
      organization_id: authContext.organizationId,
      product_id: productContext.id,
      author_name: parsed.data.author_name,
      author_role: parsed.data.author_role?.trim() || null,
      title: parsed.data.title?.trim() || null,
      content: parsed.data.content,
      rating: parsed.data.rating,
      verified_purchase: parsed.data.verified_purchase,
      is_published: parsed.data.is_published,
      published_at: parsed.data.is_published ? new Date().toISOString() : null,
      source: "manual",
    })
    .select("id, product_id, organization_id, customer_id, order_id, author_name, author_role, title, content, rating, verified_purchase, is_published, published_at, created_at, updated_at")
    .single()

  if (error) {
    if (error.code === "42P01") {
      return failure("Aplica la migración 20260326_product_reviews_and_signals.sql para habilitar reseñas reales.")
    }

    return failure(error.message)
  }

  await revalidateReviewPaths(authContext.supabase, authContext.organizationId, productContext.id, productContext.slug)

  return success(data as ProductReview)
}

export async function updateProductReview(
  reviewId: string,
  input: z.infer<typeof updateProductReviewSchema>,
): Promise<ActionResult<ProductReview>> {
  const parsedId = reviewIdSchema.safeParse(reviewId)
  if (!parsedId.success) {
    return failure(parsedId.error.issues[0]?.message || "ID de reseña inválido")
  }

  const parsed = updateProductReviewSchema.safeParse(input)
  if (!parsed.success) {
    return failure("Validation failed", parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }

  const authContext = await getAuthenticatedContext()
  if ("error" in authContext) {
    return failure(authContext.error)
  }

  const { data: existingReview, error: existingReviewError } = await authContext.supabase
    .from("product_reviews")
    .select("id, product_id, is_published")
    .eq("id", parsedId.data)
    .eq("organization_id", authContext.organizationId)
    .single()

  if (existingReviewError || !existingReview) {
    if (existingReviewError?.code === "42P01") {
      return failure("Aplica la migración 20260326_product_reviews_and_signals.sql para habilitar reseñas reales.")
    }

    return failure("Reseña no encontrada")
  }

  const productContext = await getScopedProduct(authContext.supabase, authContext.organizationId, existingReview.product_id)
  if ("error" in productContext) {
    return failure(productContext.error)
  }

  const updatePayload: {
    author_name?: string
    author_role?: string | null
    title?: string | null
    content?: string
    rating?: number
    verified_purchase?: boolean
    is_published?: boolean
    published_at?: string | null
  } = {}

  if (parsed.data.author_name !== undefined) updatePayload.author_name = parsed.data.author_name
  if (parsed.data.author_role !== undefined) updatePayload.author_role = parsed.data.author_role?.trim() || null
  if (parsed.data.title !== undefined) updatePayload.title = parsed.data.title?.trim() || null
  if (parsed.data.content !== undefined) updatePayload.content = parsed.data.content
  if (parsed.data.rating !== undefined) updatePayload.rating = parsed.data.rating
  if (parsed.data.verified_purchase !== undefined) updatePayload.verified_purchase = parsed.data.verified_purchase
  if (parsed.data.is_published !== undefined) {
    updatePayload.is_published = parsed.data.is_published
    updatePayload.published_at = parsed.data.is_published
      ? existingReview.is_published
        ? undefined
        : new Date().toISOString()
      : null
  }

  const { data, error } = await authContext.supabase
    .from("product_reviews")
    .update(updatePayload)
    .eq("id", parsedId.data)
    .eq("organization_id", authContext.organizationId)
    .select("id, product_id, organization_id, customer_id, order_id, author_name, author_role, title, content, rating, verified_purchase, is_published, published_at, created_at, updated_at")
    .single()

  if (error) {
    return failure(error.message)
  }

  await revalidateReviewPaths(authContext.supabase, authContext.organizationId, productContext.id, productContext.slug)

  return success(data as ProductReview)
}

export async function deleteProductReview(reviewId: string): Promise<ActionResult<void>> {
  const parsedId = reviewIdSchema.safeParse(reviewId)
  if (!parsedId.success) {
    return failure(parsedId.error.issues[0]?.message || "ID de reseña inválido")
  }

  const authContext = await getAuthenticatedContext()
  if ("error" in authContext) {
    return failure(authContext.error)
  }

  const { data: existingReview, error: existingReviewError } = await authContext.supabase
    .from("product_reviews")
    .select("id, product_id")
    .eq("id", parsedId.data)
    .eq("organization_id", authContext.organizationId)
    .single()

  if (existingReviewError || !existingReview) {
    if (existingReviewError?.code === "42P01") {
      return failure("Aplica la migración 20260326_product_reviews_and_signals.sql para habilitar reseñas reales.")
    }

    return failure("Reseña no encontrada")
  }

  const productContext = await getScopedProduct(authContext.supabase, authContext.organizationId, existingReview.product_id)
  if ("error" in productContext) {
    return failure(productContext.error)
  }

  const { error } = await authContext.supabase
    .from("product_reviews")
    .delete()
    .eq("id", parsedId.data)
    .eq("organization_id", authContext.organizationId)

  if (error) {
    return failure(error.message)
  }

  await revalidateReviewPaths(authContext.supabase, authContext.organizationId, productContext.id, productContext.slug)

  return success(undefined)
}
