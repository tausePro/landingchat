/**
 * Property-based tests para idempotencia de webhooks de pagos
 * **Feature: testing-sprint, Property 3: Idempotent duplicate handling**
 * **Validates: Requirements 1.3**
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

vi.mock("@/lib/payments/wompi-gateway", () => ({
    WompiGateway: vi.fn().mockImplementation(function () {
        return {
            validateWebhookSignature: vi.fn().mockReturnValue(true),
        }
    }),
}))

let mockSupabase: ReturnType<typeof createMockSupabase>

beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = createMockSupabase()
})

describe("Webhook Idempotency - Property Tests", () => {
    /**
     * **Property 3: Idempotent duplicate handling**
     * Para cualquier webhook duplicado con el mismo estado, debe retornar éxito sin modificar datos
     */
    it("handles duplicate webhooks idempotently when status is unchanged", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 10, maxLength: 50 }), // transactionId
                fc.string({ minLength: 5, maxLength: 20 }), // reference
                fc.constantFrom("APPROVED", "DECLINED", "PENDING", "VOIDED", "ERROR"), // status
                fc.integer({ min: 1000, max: 10000000 }), // amount
                async (transactionId, reference, status, amount) => {
                    const mappedStatus = mapWompiStatus(status)
                    
                    // Configurar mocks para organización válida
                    mockSupabase.mocks.single
                        .mockResolvedValueOnce({ data: TEST_ORG, error: null }) // org lookup
                        .mockResolvedValueOnce({ data: TEST_WOMPI_CONFIG, error: null }) // config lookup
                        .mockResolvedValueOnce({ 
                            data: { 
                                ...TEST_TRANSACTION, 
                                provider_transaction_id: transactionId,
                                status: mappedStatus // Mismo estado que el webhook
                            }, 
                            error: null 
                        }) // existing transaction lookup

                    const payload = generateWompiWebhookPayload(
                        transactionId,
                        reference,
                        status,
                        amount,
                        "test_integrity_secret"
                    )

                    const request = createWebhookRequest(
                        `http://localhost:3000/api/webhooks/payments/wompi?org=${TEST_ORG.slug}`,
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
            { numRuns: 100 }
        )
    })

    /**
     * Test complementario: Webhooks con estado diferente deben actualizar la transacción
     */
    it("updates transaction when webhook has different status", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 10, maxLength: 50 }), // transactionId
                fc.string({ minLength: 5, maxLength: 20 }), // reference
                fc.constantFrom("APPROVED", "DECLINED", "VOIDED", "ERROR"), // new status
                fc.integer({ min: 1000, max: 10000000 }), // amount
                async (transactionId, reference, newStatus, amount) => {
                    const newMappedStatus = mapWompiStatus(newStatus)
                    const oldMappedStatus = "pending" // Estado diferente al nuevo
                    
                    // Solo proceder si los estados son realmente diferentes
                    if (newMappedStatus === oldMappedStatus) return

                    // Configurar mocks para organización válida
                    mockSupabase.mocks.single
                        .mockResolvedValueOnce({ data: TEST_ORG, error: null }) // org lookup
                        .mockResolvedValueOnce({ data: TEST_WOMPI_CONFIG, error: null }) // config lookup
                        .mockResolvedValueOnce({ 
                            data: { 
                                ...TEST_TRANSACTION, 
                                provider_transaction_id: transactionId,
                                status: oldMappedStatus // Estado diferente al webhook
                            }, 
                            error: null 
                        }) // existing transaction lookup

                    // Mock para el update
                    mockSupabase.mocks.eq.mockReturnValue({
                        single: mockSupabase.mocks.single,
                        eq: mockSupabase.mocks.eq,
                    })

                    const payload = generateWompiWebhookPayload(
                        transactionId,
                        reference,
                        newStatus,
                        amount,
                        "test_integrity_secret"
                    )

                    const request = createWebhookRequest(
                        `http://localhost:3000/api/webhooks/payments/wompi?org=${TEST_ORG.slug}`,
                        payload
                    )

                    const response = await POST(request)
                    const result = await response.json()

                    // Verificar que se procesó la actualización
                    expect(response.status).toBe(200)
                    expect(result.received).toBe(true)
                    expect(result.duplicate).toBeUndefined()

                    // Verificar que SÍ se llamó a update (no es idempotente cuando el estado cambia)
                    expect(mockSupabase.mocks.update).toHaveBeenCalled()
                }
            ),
            { numRuns: 100 }
        )
    })

    /**
     * Test para transacciones encontradas por referencia
     */
    it("handles idempotency for transactions found by reference", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 10, maxLength: 50 }), // transactionId
                fc.string({ minLength: 5, maxLength: 20 }), // reference
                fc.constantFrom("APPROVED", "DECLINED", "PENDING", "VOIDED", "ERROR"), // status
                fc.integer({ min: 1000, max: 10000000 }), // amount
                async (transactionId, reference, status, amount) => {
                    const mappedStatus = mapWompiStatus(status)
                    
                    // Configurar mocks para organización válida
                    mockSupabase.mocks.single
                        .mockResolvedValueOnce({ data: TEST_ORG, error: null }) // org lookup
                        .mockResolvedValueOnce({ data: TEST_WOMPI_CONFIG, error: null }) // config lookup
                        .mockResolvedValueOnce({ data: null, error: null }) // no existing transaction by ID
                        .mockResolvedValueOnce({ 
                            data: { 
                                ...TEST_TRANSACTION, 
                                provider_reference: reference,
                                status: mappedStatus // Mismo estado que el webhook
                            }, 
                            error: null 
                        }) // transaction found by reference

                    const payload = generateWompiWebhookPayload(
                        transactionId,
                        reference,
                        status,
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

                    // Debe actualizar con el provider_transaction_id incluso si el estado es igual
                    expect(mockSupabase.mocks.update).toHaveBeenCalled()
                }
            ),
            { numRuns: 50 }
        )
    })
})

/**
 * Mapea estados de Wompi a estados internos
 */
function mapWompiStatus(
    wompiStatus: string
): "pending" | "approved" | "declined" | "voided" | "error" {
    const statusMap: Record<
        string,
        "pending" | "approved" | "declined" | "voided" | "error"
    > = {
        APPROVED: "approved",
        DECLINED: "declined",
        VOIDED: "voided",
        ERROR: "error",
        PENDING: "pending",
    }
    return statusMap[wompiStatus] || "pending"
}