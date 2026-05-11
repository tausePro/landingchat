/**
 * Property-based tests para manejo de estados de transacciones
 * **Feature: testing-sprint, Property 4: APPROVED status updates**
 * **Feature: testing-sprint, Property 5: DECLINED status preservation**
 * **Validates: Requirements 1.4, 1.5**
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import * as fc from "fast-check"
import { POST } from "@/app/api/webhooks/payments/wompi/route"
import {
    generateWompiWebhookPayload,
    createMockSupabase,
    createWebhookRequest,
    TEST_ORG,
    TEST_WOMPI_CONFIG,
    TEST_TRANSACTION,
} from "./webhook-test-utils"

// Mock de dependencias
vi.mock("@/lib/supabase/server", () => ({
    createServiceClient: () => mockSupabase,
}))

vi.mock("@/lib/utils/encryption", () => ({
    decrypt: vi.fn((encrypted: string) => {
        if (encrypted === "encrypted_integrity_secret") return "test_integrity_secret"
        if (encrypted === "encrypted_private_key") return "test_private_key"
        return encrypted
    }),
}))

const STATUS_MAP: Record<string, string> = {
    APPROVED: "approved",
    DECLINED: "declined",
    VOIDED: "voided",
    ERROR: "error",
    PENDING: "pending",
}
vi.mock("@/lib/payments/wompi-gateway", () => ({
    WompiGateway: class {
        validateWebhookSignature() {
            return true
        }
        async parseWebhook(request: Request) {
            const payload = await request.json()
            const transaction = payload?.data?.transaction
            if (!transaction) {
                return { isValid: false, event: null, error: "Missing transaction", httpStatus: 400 }
            }
            return {
                isValid: true,
                event: {
                    provider: "wompi",
                    eventType: "transaction.updated",
                    transactionId: String(transaction.id),
                    reference: String(transaction.reference),
                    status: STATUS_MAP[String(transaction.status)] || "pending",
                    amount: Number(transaction.amount_in_cents) || 0,
                    currency: String(transaction.currency || "COP"),
                    paymentMethod: transaction.payment_method_type
                        ? String(transaction.payment_method_type).toLowerCase()
                        : undefined,
                    rawPayload: payload,
                },
            }
        }
    },
}))

// Mock de notificaciones WhatsApp
vi.mock("@/lib/notifications/whatsapp", () => ({
    sendSaleNotification: vi.fn().mockResolvedValue(undefined),
}))

let mockSupabase: ReturnType<typeof createMockSupabase>

beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = createMockSupabase()
})

describe("Transaction Status Handling - Property Tests", () => {
    /**
     * **Property 4: APPROVED status updates**
     * Para cualquier transacción que cambie a APPROVED, debe actualizar orden a "confirmed" y "paid"
     */
    it("updates orders to confirmed and paid when transaction is APPROVED", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 10, maxLength: 50 }), // transactionId
                fc.string({ minLength: 5, maxLength: 20 }), // reference
                fc.integer({ min: 1000, max: 10000000 }), // amount
                fc.string({ minLength: 5, maxLength: 20 }), // orderId
                async (transactionId, reference, amount, orderId) => {
                    // Configurar mocks para organización válida
                    mockSupabase.mocks.single
                        .mockResolvedValueOnce({ data: TEST_ORG, error: null }) // org lookup
                        .mockResolvedValueOnce({ data: TEST_WOMPI_CONFIG, error: null }) // config lookup
                        .mockResolvedValueOnce({ 
                            data: { 
                                ...TEST_TRANSACTION, 
                                provider_transaction_id: transactionId,
                                status: "pending",
                                order_id: orderId
                            }, 
                            error: null 
                        }) // existing transaction lookup
                        .mockResolvedValueOnce({
                            data: {
                                id: orderId,
                                status: "pending",
                                payment_status: "pending",
                            },
                            error: null,
                        })
                        .mockResolvedValueOnce({ // order lookup for notification
                            data: {
                                id: orderId,
                                order_number: `ORD-${orderId}`,
                                total: amount,
                                customers: { name: "Test Customer" },
                                order_items: [
                                    { quantity: 1, products: { name: "Test Product" } }
                                ]
                            },
                            error: null
                        })

                    // Mock para los updates
                    mockSupabase.mocks.eq.mockReturnValue({
                        single: mockSupabase.mocks.single,
                        eq: mockSupabase.mocks.eq,
                    })

                    const payload = generateWompiWebhookPayload(
                        transactionId,
                        reference,
                        "APPROVED", // Estado APPROVED
                        amount,
                        "test_integrity_secret"
                    )

                    const request = createWebhookRequest(
                        `http://localhost:3000/api/webhooks/payments/wompi?org=${TEST_ORG.slug}`,
                        payload
                    )

                    const response = await POST(request)
                    const result = await response.json()

                    // Verificar que se procesó exitosamente
                    expect(response.status).toBe(200)
                    expect(result.received).toBe(true)

                    // Verificar que se llamó a update para la transacción
                    expect(mockSupabase.mocks.update).toHaveBeenCalledWith({
                        status: "approved",
                        provider_response: payload.data,
                        completed_at: expect.any(String), // Debe tener completed_at para APPROVED
                        updated_at: expect.any(String),
                    })

                    // Verificar que se llamó a update para la orden
                    const updateCalls = mockSupabase.mocks.update.mock.calls
                    const orderUpdateCall = updateCalls.find(call => 
                        call[0].payment_status === "paid"
                    )
                    expect(orderUpdateCall).toBeDefined()
                    const orderUpdate = orderUpdateCall?.[0]
                    if (!orderUpdate) throw new Error("Expected order update call for paid status")
                    expect(orderUpdate).toMatchObject({
                        payment_status: "paid",
                        status: "confirmed",
                        updated_at: expect.any(String),
                    })
                    // Fase 0.4 post-mortem: `confirmed_at` se removió del
                    // UPDATE porque la columna no existe en `orders`.
                    expect(orderUpdate.confirmed_at).toBeUndefined()
                }
            ),
            { numRuns: 50 }
        )
    })

    /**
     * **Property 5: DECLINED status preservation**
     * Para cualquier transacción que cambie a DECLINED, debe actualizar orden a "cancelled" y "failed"
     */
    it("updates orders to cancelled and failed when transaction is DECLINED", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 10, maxLength: 50 }), // transactionId
                fc.string({ minLength: 5, maxLength: 20 }), // reference
                fc.integer({ min: 1000, max: 10000000 }), // amount
                fc.string({ minLength: 5, maxLength: 20 }), // orderId
                async (transactionId, reference, amount, orderId) => {
                    // Configurar mocks para organización válida
                    mockSupabase.mocks.single
                        .mockResolvedValueOnce({ data: TEST_ORG, error: null }) // org lookup
                        .mockResolvedValueOnce({ data: TEST_WOMPI_CONFIG, error: null }) // config lookup
                        .mockResolvedValueOnce({ 
                            data: { 
                                ...TEST_TRANSACTION, 
                                provider_transaction_id: transactionId,
                                status: "pending",
                                order_id: orderId
                            }, 
                            error: null 
                        }) // existing transaction lookup
                        .mockResolvedValueOnce({
                            data: {
                                id: orderId,
                                status: "pending",
                                payment_status: "pending",
                            },
                            error: null,
                        })

                    // Mock para los updates
                    mockSupabase.mocks.eq.mockReturnValue({
                        single: mockSupabase.mocks.single,
                        eq: mockSupabase.mocks.eq,
                    })

                    const payload = generateWompiWebhookPayload(
                        transactionId,
                        reference,
                        "DECLINED", // Estado DECLINED
                        amount,
                        "test_integrity_secret"
                    )

                    const request = createWebhookRequest(
                        `http://localhost:3000/api/webhooks/payments/wompi?org=${TEST_ORG.slug}`,
                        payload
                    )

                    const response = await POST(request)
                    const result = await response.json()

                    // Verificar que se procesó exitosamente
                    expect(response.status).toBe(200)
                    expect(result.received).toBe(true)

                    // Verificar que se llamó a update para la transacción
                    expect(mockSupabase.mocks.update).toHaveBeenCalledWith({
                        status: "declined",
                        provider_response: payload.data,
                        completed_at: null, // NO debe tener completed_at para DECLINED
                        updated_at: expect.any(String),
                    })

                    // Verificar que se llamó a update para la orden
                    const updateCalls = mockSupabase.mocks.update.mock.calls
                    const orderUpdateCall = updateCalls.find(call => 
                        call[0].payment_status === "failed"
                    )
                    expect(orderUpdateCall).toBeDefined()
                    const orderUpdate = orderUpdateCall?.[0]
                    if (!orderUpdate) throw new Error("Expected order update call for failed status")
                    expect(orderUpdate).toMatchObject({
                        payment_status: "failed",
                        status: "cancelled",
                        updated_at: expect.any(String),
                    })
                    expect(orderUpdate.confirmed_at).toBeUndefined()
                }
            ),
            { numRuns: 50 }
        )
    })

    /**
     * Test complementario: Estados PENDING no deben cambiar el estado de la orden
     */
    it("preserves order status when transaction remains PENDING", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 10, maxLength: 50 }), // transactionId
                fc.string({ minLength: 5, maxLength: 20 }), // reference
                fc.integer({ min: 1000, max: 10000000 }), // amount
                fc.string({ minLength: 5, maxLength: 20 }), // orderId
                async (transactionId, reference, amount, orderId) => {
                    // Configurar mocks para organización válida
                    mockSupabase.mocks.single
                        .mockResolvedValueOnce({ data: TEST_ORG, error: null }) // org lookup
                        .mockResolvedValueOnce({ data: TEST_WOMPI_CONFIG, error: null }) // config lookup
                        .mockResolvedValueOnce({ 
                            data: { 
                                ...TEST_TRANSACTION, 
                                provider_transaction_id: transactionId,
                                status: "pending",
                                order_id: orderId
                            }, 
                            error: null 
                        }) // existing transaction lookup

                    // Mock para los updates
                    mockSupabase.mocks.eq.mockReturnValue({
                        single: mockSupabase.mocks.single,
                        eq: mockSupabase.mocks.eq,
                    })

                    const payload = generateWompiWebhookPayload(
                        transactionId,
                        reference,
                        "PENDING", // Estado PENDING
                        amount,
                        "test_integrity_secret"
                    )

                    const request = createWebhookRequest(
                        `http://localhost:3000/api/webhooks/payments/wompi?org=${TEST_ORG.slug}`,
                        payload
                    )

                    const response = await POST(request)
                    const result = await response.json()

                    // Verificar que se procesó exitosamente
                    expect(response.status).toBe(200)
                    expect(result.received).toBe(true)
                    expect(result.duplicate).toBe(true) // Mismo estado, debe ser duplicado

                    // NO debe llamar a update porque el estado no cambió
                    expect(mockSupabase.mocks.update).not.toHaveBeenCalled()
                }
            ),
            { numRuns: 30 }
        )
    })

    /**
     * Test para estados VOIDED (reembolsado)
     */
    it("updates orders to refunded when transaction is VOIDED", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 10, maxLength: 50 }), // transactionId
                fc.string({ minLength: 5, maxLength: 20 }), // reference
                fc.integer({ min: 1000, max: 10000000 }), // amount
                fc.string({ minLength: 5, maxLength: 20 }), // orderId
                async (transactionId, reference, amount, orderId) => {
                    // Configurar mocks para organización válida
                    mockSupabase.mocks.single
                        .mockResolvedValueOnce({ data: TEST_ORG, error: null }) // org lookup
                        .mockResolvedValueOnce({ data: TEST_WOMPI_CONFIG, error: null }) // config lookup
                        .mockResolvedValueOnce({ 
                            data: { 
                                ...TEST_TRANSACTION, 
                                provider_transaction_id: transactionId,
                                status: "approved", // Cambio de approved a voided
                                order_id: orderId
                            }, 
                            error: null 
                        }) // existing transaction lookup
                        .mockResolvedValueOnce({
                            data: {
                                id: orderId,
                                status: "confirmed",
                                payment_status: "paid",
                            },
                            error: null,
                        })

                    // Mock para los updates
                    mockSupabase.mocks.eq.mockReturnValue({
                        single: mockSupabase.mocks.single,
                        eq: mockSupabase.mocks.eq,
                    })

                    const payload = generateWompiWebhookPayload(
                        transactionId,
                        reference,
                        "VOIDED", // Estado VOIDED
                        amount,
                        "test_integrity_secret"
                    )

                    const request = createWebhookRequest(
                        `http://localhost:3000/api/webhooks/payments/wompi?org=${TEST_ORG.slug}`,
                        payload
                    )

                    const response = await POST(request)
                    const result = await response.json()

                    // Verificar que se procesó exitosamente
                    expect(response.status).toBe(200)
                    expect(result.received).toBe(true)

                    // Verificar que se llamó a update para la transacción
                    expect(mockSupabase.mocks.update).toHaveBeenCalledWith({
                        status: "voided",
                        provider_response: payload.data,
                        completed_at: null, // NO debe tener completed_at para VOIDED
                        updated_at: expect.any(String),
                    })

                    // Verificar que se llamó a update para la orden
                    const updateCalls = mockSupabase.mocks.update.mock.calls
                    const orderUpdateCall = updateCalls.find(call => 
                        call[0].payment_status === "refunded"
                    )
                    expect(orderUpdateCall).toBeDefined()
                    const orderUpdate = orderUpdateCall?.[0]
                    if (!orderUpdate) throw new Error("Expected order update call for refunded status")
                    expect(orderUpdate).toMatchObject({
                        payment_status: "refunded",
                        updated_at: expect.any(String),
                    })
                    expect(orderUpdate.status).toBeUndefined()
                }
            ),
            { numRuns: 30 }
        )
    })
})