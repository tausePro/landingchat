/**
 * Tests de `submitCustomerReviews` (página pública de reseña post-compra).
 *
 * Garantías:
 * - Token HMAC inválido → rechazo sin tocar la base.
 * - Solo productos que están en la orden; idempotencia por (order, product).
 * - Las reseñas entran SIN publicar (is_published=false), verified_purchase
 *   true y source 'customer_form'.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

const mockOrderSingle = vi.fn()
const mockOrderEq = vi.fn()
const mockOrderSelect = vi.fn()

const mockReviewsSelectEq = vi.fn()
const mockReviewsSelect = vi.fn()
const mockReviewsInsert = vi.fn()

const mockFrom = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
    createServiceClient: vi.fn(() => ({ from: mockFrom })),
    createClient: vi.fn(),
}))

const ORDER_ID = "3f2c9a10-0000-4000-8000-000000000001"
const PRODUCT_IN_ORDER = "3f2c9a10-0000-4000-8000-00000000000a"
const PRODUCT_NOT_IN_ORDER = "3f2c9a10-0000-4000-8000-00000000000b"

beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("ENCRYPTION_KEY", "test-secret-key-for-reviews")

    mockOrderSingle.mockResolvedValue({
        data: {
            id: ORDER_ID,
            organization_id: "org-1",
            customer_id: "customer-1",
            payment_status: "paid",
            items: [{ product_id: PRODUCT_IN_ORDER, name: "Serum", quantity: 1, price: 10 }],
        },
    })
    mockOrderEq.mockReturnValue({ single: mockOrderSingle })
    mockOrderSelect.mockReturnValue({ eq: mockOrderEq })

    mockReviewsSelectEq.mockResolvedValue({ data: [] })
    mockReviewsSelect.mockReturnValue({ eq: mockReviewsSelectEq })
    mockReviewsInsert.mockResolvedValue({ error: null })

    mockFrom.mockImplementation((table: string) => {
        if (table === "orders") return { select: mockOrderSelect }
        if (table === "product_reviews") return { select: mockReviewsSelect, insert: mockReviewsInsert }
        throw new Error(`Tabla inesperada: ${table}`)
    })
})

async function buildValidInput() {
    const { buildReviewToken } = await import("@/lib/reviews/token")
    return {
        orderId: ORDER_ID,
        token: buildReviewToken(ORDER_ID),
        authorName: "Laura",
        reviews: [{ productId: PRODUCT_IN_ORDER, rating: 5, content: "Excelente producto" }],
    }
}

describe("submitCustomerReviews", () => {
    it("inserta la reseña sin publicar, verificada y con source customer_form", async () => {
        const { submitCustomerReviews } = await import("@/app/store/[slug]/resena/[orderId]/actions")
        const result = await submitCustomerReviews(await buildValidInput())

        expect(result.success).toBe(true)
        expect(mockReviewsInsert).toHaveBeenCalledWith([
            expect.objectContaining({
                organization_id: "org-1",
                product_id: PRODUCT_IN_ORDER,
                customer_id: "customer-1",
                order_id: ORDER_ID,
                author_name: "Laura",
                rating: 5,
                verified_purchase: true,
                is_published: false,
                source: "customer_form",
            }),
        ])
    })

    it("rechaza un token inválido sin tocar la base", async () => {
        const { submitCustomerReviews } = await import("@/app/store/[slug]/resena/[orderId]/actions")
        const input = await buildValidInput()

        const result = await submitCustomerReviews({ ...input, token: "0".repeat(64) })

        expect(result.success).toBe(false)
        expect(mockFrom).not.toHaveBeenCalled()
    })

    it("rechaza productos que no están en la orden", async () => {
        const { submitCustomerReviews } = await import("@/app/store/[slug]/resena/[orderId]/actions")
        const input = await buildValidInput()
        input.reviews = [{ productId: PRODUCT_NOT_IN_ORDER, rating: 4, content: "No estaba en la orden" }]

        const result = await submitCustomerReviews(input)

        expect(result.success).toBe(false)
        expect(mockReviewsInsert).not.toHaveBeenCalled()
    })

    it("no duplica reseñas ya dejadas para la misma orden y producto", async () => {
        mockReviewsSelectEq.mockResolvedValue({ data: [{ product_id: PRODUCT_IN_ORDER }] })

        const { submitCustomerReviews } = await import("@/app/store/[slug]/resena/[orderId]/actions")
        const result = await submitCustomerReviews(await buildValidInput())

        expect(result.success).toBe(false)
        expect(mockReviewsInsert).not.toHaveBeenCalled()
    })

    it("rechaza órdenes no pagadas", async () => {
        mockOrderSingle.mockResolvedValue({
            data: { id: ORDER_ID, organization_id: "org-1", customer_id: null, payment_status: "pending", items: [] },
        })

        const { submitCustomerReviews } = await import("@/app/store/[slug]/resena/[orderId]/actions")
        const result = await submitCustomerReviews(await buildValidInput())

        expect(result.success).toBe(false)
        expect(mockReviewsInsert).not.toHaveBeenCalled()
    })
})
