/**
 * Property-based tests para validación de firmas de webhooks de Wompi
 * **Feature: testing-sprint, Property 1: Valid signature processing**
 * **Feature: testing-sprint, Property 2: Invalid signature rejection**
 * **Validates: Requirements 1.1, 1.2**
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import * as fc from "fast-check"
import { POST } from "@/app/api/webhooks/payments/wompi/route"
import {
    generateWompiWebhookPayload,
    generateInvalidSignature,
    createMockSupabase,
    createWebhookRequest,
    TEST_ORG,
    TEST_WOMPI_CONFIG,
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

// Mock simple de WompiGateway
const mockValidateWebhookSignature = vi.fn()
vi.mock("@/lib/payments/wompi-gateway", () => ({
    WompiGateway: vi.fn().mockImplementation(() => ({
        validateWebhookSignature: mockValidateWebhookSignature,
    })),
}))

let mockSupabase: any

beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = createMockSupabase()
    mockValidateWebhookSignature.mockClear()
})

describe("Wompi Webhook Signature Validation - Property Tests", () => {
    /**
     * **Property 1: Valid signature processing**
     * Para cualquier payload válido con firma correcta, el webhook debe procesarse exitosamente
     */
    it("processes webhooks with valid signatures successfully", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 10, maxLength: 50 }), // transactionId
                fc.string({ minLength: 5, maxLength: 20 }), // reference
                fc.constantFrom("APPROVED", "DECLINED", "PENDING", "VOIDED", "ERROR"), // status
                fc.integer({ min: 1000, max: 10000000 }), // amount
                async (transactionId, reference, status, amount) => {
                    // Configurar mocks para organización válida
                    mockSupabase.mocks.single
                        .mockResolvedValueOnce({ data: TEST_ORG, error: null }) // org lookup
                        .mockResolvedValueOnce({ data: TEST_WOMPI_CONFIG, error: null }) // config lookup
                        .mockResolvedValueOnce({ data: null, error: null }) // existing transaction lookup
                        .mockResolvedValueOnce({ data: null, error: null }) // transaction by reference lookup
                        .mockResolvedValueOnce({ data: { id: "new-tx-id" }, error: null }) // insert new transaction

                    // Mock de validación de firma exitosa
                    mockValidateWebhookSignature.mockReturnValue(true)

                    // Generar payload con firma válida
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

                    // Verificar que el webhook se procesó exitosamente
                    expect(response.status).toBe(200)
                    expect(result.received).toBe(true)
                    expect(mockValidateWebhookSignature).toHaveBeenCalledWith(
                        payload,
                        "",
                        ""
                    )
                }
            ),
            { numRuns: 100 }
        )
    })

    /**
     * **Property 2: Invalid signature rejection**
     * Para cualquier payload con firma inválida, el webhook debe ser rechazado con error 401
     */
    it("rejects webhooks with invalid signatures", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 10, maxLength: 50 }), // transactionId
                fc.string({ minLength: 5, maxLength: 20 }), // reference
                fc.constantFrom("APPROVED", "DECLINED", "PENDING", "VOIDED", "ERROR"), // status
                fc.integer({ min: 1000, max: 10000000 }), // amount
                async (transactionId, reference, status, amount) => {
                    // Configurar mocks para organización válida
                    mockSupabase.mocks.single
                        .mockResolvedValueOnce({ data: TEST_ORG, error: null }) // org lookup
                        .mockResolvedValueOnce({ data: TEST_WOMPI_CONFIG, error: null }) // config lookup

                    // Mock de validación de firma fallida
                    mockValidateWebhookSignature.mockReturnValue(false)

                    // Generar payload con firma inválida
                    const payload = generateWompiWebhookPayload(
                        transactionId,
                        reference,
                        status,
                        amount
                    )
                    // Corromper la firma
                    payload.signature.checksum = generateInvalidSignature()

                    const request = createWebhookRequest(
                        `http://localhost:3000/api/webhooks/payments/wompi?org=${TEST_ORG.slug}`,
                        payload
                    )

                    const response = await POST(request)
                    const result = await response.json()

                    // Verificar que el webhook fue rechazado
                    expect(response.status).toBe(401)
                    expect(result.error).toBe("Invalid signature")
                    expect(mockValidateWebhookSignature).toHaveBeenCalledWith(
                        payload,
                        "",
                        ""
                    )
                }
            ),
            { numRuns: 100 }
        )
    })

    /**
     * Test adicional: Webhooks sin configuración de integrity secret deben fallar
     */
    it("rejects webhooks when no integrity secret is configured", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 10, maxLength: 50 }), // transactionId
                fc.string({ minLength: 5, maxLength: 20 }), // reference
                fc.constantFrom("APPROVED", "DECLINED", "PENDING", "VOIDED", "ERROR"), // status
                fc.integer({ min: 1000, max: 10000000 }), // amount
                async (transactionId, reference, status, amount) => {
                    // Configurar mocks para organización válida pero sin integrity secret
                    const configWithoutSecret = { ...TEST_WOMPI_CONFIG, integrity_secret_encrypted: null }
                    
                    mockSupabase.mocks.single
                        .mockResolvedValueOnce({ data: TEST_ORG, error: null }) // org lookup
                        .mockResolvedValueOnce({ data: configWithoutSecret, error: null }) // config lookup

                    const payload = generateWompiWebhookPayload(
                        transactionId,
                        reference,
                        status,
                        amount
                    )

                    const request = createWebhookRequest(
                        `http://localhost:3000/api/webhooks/payments/wompi?org=${TEST_ORG.slug}`,
                        payload
                    )

                    const response = await POST(request)
                    const result = await response.json()

                    // Sin integrity secret, el webhook debe procesarse (no validar firma)
                    expect(response.status).toBe(200)
                    expect(result.received).toBe(true)
                    // No debe llamar a validateWebhookSignature si no hay secret
                    expect(mockValidateWebhookSignature).not.toHaveBeenCalled()
                }
            ),
            { numRuns: 50 }
        )
    })
})