/**
 * Property-based tests para webhooks de ePayco
 * Mirrors Wompi tests for ePayco webhook endpoint
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6**
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import * as fc from "fast-check"
import { POST } from "@/app/api/webhooks/payments/epayco/route"
import {
    generateEpaycoWebhookPayload,
    generateInvalidSignature,
    createMockSupabase,
    createWebhookRequest,
    TEST_ORG,
    TEST_EPAYCO_CONFIG,
    TEST_TRANSACTION,
} from "./webhook-test-utils"

// Mock de dependencias
vi.mock("@/lib/supabase/server", () => ({
    createServiceClient: () => mockSupabase,
}))

vi.mock("@/lib/utils/encryption", () => ({
    decrypt: vi.fn((encrypted: string) => {
        if (encrypted === "encrypted_private_key") return "test_private_key"
        return encrypted
    }),
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

describe("ePayco Webhook - Property Tests", () => {
    /**
     * Test de validación de firma para ePayco
     */
    it("processes webhooks with valid ePayco signatures", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 10, maxLength: 50 }), // refPayco
                fc.string({ minLength: 10, maxLength: 50 }), // transactionId
                fc.string({ minLength: 5, maxLength: 20 }), // invoice
                fc.float({ min: 10, max: 10000 }), // amount
                fc.constantFrom("1", "2", "3", "4", "6"), // codResponse
                async (refPayco, transactionId, invoice, amount, codResponse) => {
                    const amountStr = amount.toFixed(2)
                    
                    // Configurar mocks para organización válida
                    mockSupabase.mocks.single
                        .mockResolvedValueOnce({ data: TEST_ORG, error: null }) // org lookup
                        .mockResolvedValueOnce({ data: TEST_EPAYCO_CONFIG, error: null }) // config lookup
                        .mockResolvedValueOnce({ data: null, error: null }) // existing transaction lookup
                        .mockResolvedValueOnce({ data: null, error: null }) // transaction by reference lookup
                        .mockResolvedValueOnce({ data: { id: "new-tx-id" }, error: null }) // insert new transaction

                    // Generar payload con firma válida
                    const payload = generateEpaycoWebhookPayload(
                        refPayco,
                        transactionId,
                        invoice,
                        amountStr,
                        codResponse,
                        TEST_EPAYCO_CONFIG.public_key,
                        "test_private_key"
                    )

                    const request = createWebhookRequest(
                        `http://localhost:3000/api/webhooks/payments/epayco?org=${TEST_ORG.slug}`,
                        payload
                    )

                    const response = await POST(request)
                    const result = await response.json()

                    // Verificar que el webhook se procesó exitosamente
                    expect(response.status).toBe(200)
                    expect(result.received).toBe(true)
                }
            ),
            { numRuns: 50 }
        )
    })

    /**
     * Test de rechazo de firmas inválidas para ePayco
     */
    it("rejects webhooks with invalid ePayco signatures", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 10, maxLength: 50 }), // refPayco
                fc.string({ minLength: 10, maxLength: 50 }), // transactionId
                fc.string({ minLength: 5, maxLength: 20 }), // invoice
                fc.float({ min: 10, max: 10000 }), // amount
                fc.constantFrom("1", "2", "3", "4", "6"), // codResponse
                async (refPayco, transactionId, invoice, amount, codResponse) => {
                    const amountStr = amount.toFixed(2)
                    
                    // Configurar mocks para organización válida
                    mockSupabase.mocks.single
                        .mockResolvedValueOnce({ data: TEST_ORG, error: null }) // org lookup
                        .mockResolvedValueOnce({ data: TEST_EPAYCO_CONFIG, error: null }) // config lookup

                    // Generar payload con firma inválida
                    const payload = generateEpaycoWebhookPayload(
                        refPayco,
                        transactionId,
                        invoice,
                        amountStr,
                        codResponse,
                        TEST_EPAYCO_CONFIG.public_key,
                        "test_private_key"
                    )
                    // Corromper la firma
                    payload.x_signature = generateInvalidSignature()

                    const request = createWebhookRequest(
                        `http://localhost:3000/api/webhooks/payments/epayco?org=${TEST_ORG.slug}`,
                        payload
                    )

                    const response = await POST(request)
                    const result = await response.json()

                    // Verificar que el webhook fue rechazado
                    expect(response.status).toBe(401)
                    expect(result.error).toBe("Invalid signature")
                }
            ),
            { numRuns: 50 }
        )
    })

    /**
     * Test de idempotencia para ePayco
     */
    it("handles duplicate ePayco webhooks idempotently", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 10, maxLength: 50 }), // refPayco
                fc.string({ minLength: 10, maxLength: 50 }), // transactionId
                fc.string({ minLength: 5, maxLength: 20 }), // invoice
                fc.float({ min: 10, max: 10000 }), // amount
                fc.constantFrom("1", "2", "3", "4", "6"), // codResponse
                async (refPayco, transactionId, invoice, amount, codResponse) => {
                    const amountStr = amount.toFixed(2)
                    const mappedStatus = mapEpaycoStatus(codResponse)
                    
                    // Configurar mocks para organización válida
                    mockSupabase.mocks.single
                        .mockResolvedValueOnce({ data: TEST_ORG, error: null }) // org lookup
                        .mockResolvedValueOnce({ data: TEST_EPAYCO_CONFIG, error: null }) // config lookup
                        .mockResolvedValueOnce({ 
                            data: { 
                                ...TEST_TRANSACTION, 
                                provider_transaction_id: refPayco,
                                status: mappedStatus // Mismo estado que el webhook
                            }, 
                            error: null 
                        }) // existing transaction lookup

                    const payload = generateEpaycoWebhookPayload(
                        refPayco,
                        transactionId,
                        invoice,
                        amountStr,
                        codResponse,
                        TEST_EPAYCO_CONFIG.public_key,
                        "test_private_key"
                    )

                    const request = createWebhookRequest(
                        `http://localhost:3000/api/webhooks/payments/epayco?org=${TEST_ORG.slug}`,
                        payload
                    )

                    const response = await POST(request)
                    const result = await response.json()

                    // Verificar respuesta de idempotencia
                    expect(response.status).toBe(200)
                    expect(result.received).toBe(true)
                    expect(result.duplicate).toBe(true)

                    // Verificar que NO se llamó a update (idempotencia)
                    expect(mockSupabase.mocks.update).not.toHaveBeenCalled()
                }
            ),
            { numRuns: 50 }
        )
    })

    /**
     * Test de manejo de estados APPROVED para ePayco
     */
    it("updates orders to confirmed when ePayco transaction is approved", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 10, maxLength: 50 }), // refPayco
                fc.string({ minLength: 10, maxLength: 50 }), // transactionId
                fc.string({ minLength: 5, maxLength: 20 }), // invoice
                fc.float({ min: 10, max: 10000 }), // amount
                fc.string({ minLength: 5, maxLength: 20 }), // orderId
                async (refPayco, transactionId, invoice, amount, orderId) => {
                    const amountStr = amount.toFixed(2)
                    
                    // Configurar mocks para organización válida
                    mockSupabase.mocks.single
                        .mockResolvedValueOnce({ data: TEST_ORG, error: null }) // org lookup
                        .mockResolvedValueOnce({ data: TEST_EPAYCO_CONFIG, error: null }) // config lookup
                        .mockResolvedValueOnce({ 
                            data: { 
                                ...TEST_TRANSACTION, 
                                provider_transaction_id: refPayco,
                                status: "pending",
                                order_id: orderId
                            }, 
                            error: null 
                        }) // existing transaction lookup
                        .mockResolvedValueOnce({ // order lookup for notification
                            data: {
                                id: orderId,
                                order_number: `ORD-${orderId}`,
                                total: Math.round(amount * 100),
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

                    const payload = generateEpaycoWebhookPayload(
                        refPayco,
                        transactionId,
                        invoice,
                        amountStr,
                        "1", // Código 1 = APPROVED
                        TEST_EPAYCO_CONFIG.public_key,
                        "test_private_key"
                    )

                    const request = createWebhookRequest(
                        `http://localhost:3000/api/webhooks/payments/epayco?org=${TEST_ORG.slug}`,
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
                        provider_response: payload,
                        completed_at: expect.any(String), // Debe tener completed_at para APPROVED
                        updated_at: expect.any(String),
                    })

                    // Verificar que se llamó a update para la orden
                    const updateCalls = mockSupabase.mocks.update.mock.calls
                    const orderUpdateCall = updateCalls.find(call => 
                        call[0].payment_status === "paid"
                    )
                    expect(orderUpdateCall).toBeDefined()
                    expect(orderUpdateCall[0]).toMatchObject({
                        payment_status: "paid",
                        status: "confirmed",
                        confirmed_at: expect.any(String),
                        updated_at: expect.any(String),
                    })
                }
            ),
            { numRuns: 30 }
        )
    })

    /**
     * Test de manejo de estados DECLINED para ePayco
     */
    it("updates orders to cancelled when ePayco transaction is declined", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 10, maxLength: 50 }), // refPayco
                fc.string({ minLength: 10, maxLength: 50 }), // transactionId
                fc.string({ minLength: 5, maxLength: 20 }), // invoice
                fc.float({ min: 10, max: 10000 }), // amount
                fc.string({ minLength: 5, maxLength: 20 }), // orderId
                async (refPayco, transactionId, invoice, amount, orderId) => {
                    const amountStr = amount.toFixed(2)
                    
                    // Configurar mocks para organización válida
                    mockSupabase.mocks.single
                        .mockResolvedValueOnce({ data: TEST_ORG, error: null }) // org lookup
                        .mockResolvedValueOnce({ data: TEST_EPAYCO_CONFIG, error: null }) // config lookup
                        .mockResolvedValueOnce({ 
                            data: { 
                                ...TEST_TRANSACTION, 
                                provider_transaction_id: refPayco,
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

                    const payload = generateEpaycoWebhookPayload(
                        refPayco,
                        transactionId,
                        invoice,
                        amountStr,
                        "2", // Código 2 = DECLINED
                        TEST_EPAYCO_CONFIG.public_key,
                        "test_private_key"
                    )

                    const request = createWebhookRequest(
                        `http://localhost:3000/api/webhooks/payments/epayco?org=${TEST_ORG.slug}`,
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
                        provider_response: payload,
                        completed_at: null, // NO debe tener completed_at para DECLINED
                        updated_at: expect.any(String),
                    })

                    // Verificar que se llamó a update para la orden
                    const updateCalls = mockSupabase.mocks.update.mock.calls
                    const orderUpdateCall = updateCalls.find(call => 
                        call[0].payment_status === "failed"
                    )
                    expect(orderUpdateCall).toBeDefined()
                    expect(orderUpdateCall[0]).toMatchObject({
                        payment_status: "failed",
                        status: "cancelled",
                        updated_at: expect.any(String),
                    })
                    // No debe tener confirmed_at para DECLINED
                    expect(orderUpdateCall[0].confirmed_at).toBeUndefined()
                }
            ),
            { numRuns: 30 }
        )
    })

    /**
     * Test de manejo de content-type form-urlencoded
     */
    it("handles form-urlencoded payloads correctly", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 10, maxLength: 50 }), // refPayco
                fc.string({ minLength: 10, maxLength: 50 }), // transactionId
                fc.string({ minLength: 5, maxLength: 20 }), // invoice
                fc.float({ min: 10, max: 10000 }), // amount
                async (refPayco, transactionId, invoice, amount) => {
                    const amountStr = amount.toFixed(2)
                    
                    // Configurar mocks para organización válida
                    mockSupabase.mocks.single
                        .mockResolvedValueOnce({ data: TEST_ORG, error: null }) // org lookup
                        .mockResolvedValueOnce({ data: TEST_EPAYCO_CONFIG, error: null }) // config lookup
                        .mockResolvedValueOnce({ data: null, error: null }) // existing transaction lookup
                        .mockResolvedValueOnce({ data: null, error: null }) // transaction by reference lookup
                        .mockResolvedValueOnce({ data: { id: "new-tx-id" }, error: null }) // insert new transaction

                    const payload = generateEpaycoWebhookPayload(
                        refPayco,
                        transactionId,
                        invoice,
                        amountStr,
                        "1",
                        TEST_EPAYCO_CONFIG.public_key,
                        "test_private_key"
                    )

                    const request = createWebhookRequest(
                        `http://localhost:3000/api/webhooks/payments/epayco?org=${TEST_ORG.slug}`,
                        payload,
                        "application/x-www-form-urlencoded"
                    )

                    const response = await POST(request)
                    const result = await response.json()

                    // Verificar que el webhook se procesó exitosamente
                    expect(response.status).toBe(200)
                    expect(result.received).toBe(true)
                }
            ),
            { numRuns: 30 }
        )
    })
})

/**
 * Mapea códigos de respuesta de ePayco a estados internos
 */
function mapEpaycoStatus(
    codResponse: string
): "pending" | "approved" | "declined" | "voided" | "error" {
    const statusMap: Record<
        string,
        "pending" | "approved" | "declined" | "voided" | "error"
    > = {
        "1": "approved",
        "2": "declined",
        "3": "pending",
        "4": "error",
        "6": "voided",
    }
    return statusMap[codResponse] || "pending"
}