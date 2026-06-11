"use server"

import { z } from "zod"
import { createServiceClient } from "@/lib/supabase/server"
import { verifyReviewToken } from "@/lib/reviews/token"
import { type ActionResult, success, failure } from "@/types"

/**
 * Submit público de reseñas post-compra.
 *
 * Seguridad: el token HMAC del link (verificado server-side) es la
 * autorización — solo quien recibió el link de SU orden puede reseñar, y
 * solo los productos de esa orden. `createServiceClient()` es necesario
 * porque el cliente final no tiene sesión Supabase (página pública); todos
 * los datos insertados derivan de la orden verificada, nunca del input.
 */

const reviewItemSchema = z.object({
    productId: z.string().uuid(),
    rating: z.number().int().min(1).max(5),
    title: z.string().trim().max(120).optional(),
    content: z.string().trim().min(5).max(2000),
})

const submitSchema = z.object({
    orderId: z.string().uuid(),
    token: z.string().min(16),
    authorName: z.string().trim().min(2).max(80),
    reviews: z.array(reviewItemSchema).min(1).max(20),
})

export type SubmitCustomerReviewsInput = z.infer<typeof submitSchema>

export async function submitCustomerReviews(
    input: SubmitCustomerReviewsInput
): Promise<ActionResult<{ inserted: number }>> {
    try {
        const validation = submitSchema.safeParse(input)
        if (!validation.success) {
            return failure(validation.error.issues[0]?.message || "Datos inválidos")
        }
        const { orderId, token, authorName, reviews } = validation.data

        if (!verifyReviewToken(orderId, token)) {
            return failure("Link de reseña no válido")
        }

        const supabase = createServiceClient()
        const { data: order } = await supabase
            .from("orders")
            .select("id, organization_id, customer_id, items, payment_status")
            .eq("id", orderId)
            .single()

        if (!order || order.payment_status !== "paid") {
            return failure("Link de reseña no válido")
        }

        // Solo productos que realmente están en la orden
        const orderProductIds = new Set(
            ((order.items as Array<{ product_id?: string }>) ?? [])
                .map((item) => item.product_id)
                .filter((id): id is string => typeof id === "string")
        )
        const validReviews = reviews.filter((review) => orderProductIds.has(review.productId))
        if (validReviews.length === 0) {
            return failure("Los productos no corresponden a esta orden")
        }

        // Idempotencia: una reseña por producto por orden
        const { data: existing } = await supabase
            .from("product_reviews")
            .select("product_id")
            .eq("order_id", orderId)

        const alreadyReviewed = new Set((existing ?? []).map((row: { product_id: string }) => row.product_id))
        const toInsert = validReviews.filter((review) => !alreadyReviewed.has(review.productId))
        if (toInsert.length === 0) {
            return failure("Ya dejaste reseñas para este pedido")
        }

        const { error } = await supabase.from("product_reviews").insert(
            toInsert.map((review) => ({
                organization_id: order.organization_id,
                product_id: review.productId,
                customer_id: order.customer_id,
                order_id: order.id,
                author_name: authorName,
                title: review.title || null,
                content: review.content,
                rating: review.rating,
                verified_purchase: true,
                is_published: false,
                source: "customer_form",
            }))
        )

        if (error) {
            console.error("[reviews/submit] Error inserting reviews:", error)
            return failure("No pudimos guardar tus reseñas")
        }

        return success({ inserted: toInsert.length })
    } catch (error) {
        console.error("[reviews/submit] Unexpected error:", error)
        return failure("No pudimos guardar tus reseñas")
    }
}
