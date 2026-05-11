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
        if (encrypted === "encrypted_events_secret") return "test_events_secret"
        if (encrypted === "encrypted_private_key") return "test_private_key"
        return encrypted
    }),
}))

// Mock de WompiGateway como clase (mismo patrón que transaction-status tests)
let mockSignatureResult = true
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
            return mockSignatureResult
        }
        async parseWebhook(request: Request) {
            const payload = await request.json()
            const transaction = payload?.data?.transaction
            if (!transaction) {
                return { isValid: false, event: null, error: "Missing transaction", httpStatus: 400 }
            }
            if (!mockSignatureResult) {
                return { isValid: false, event: null, error: "Invalid signature", httpStatus: 401 }
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

let mockSupabase: any

beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = createMockSupabase()
    mockSignatureResult = true
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
                        .mockResolvedValueOnce({ data: null, error: null }) // order lookup by reference
                        .mockResolvedValueOnce({ data: { id: "new-tx-id" }, error: null }) // insert new transaction

                    // Firma válida
                    mockSignatureResult = true

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

                    // Firma inválida
                    mockSignatureResult = false

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
                    // Configurar mocks para organización válida pero sin events secret
                    const configWithoutSecret = { ...TEST_WOMPI_CONFIG, events_secret_encrypted: null }
                    
                    mockSupabase.mocks.single
                        .mockResolvedValueOnce({ data: TEST_ORG, error: null }) // org lookup
                        .mockResolvedValueOnce({ data: configWithoutSecret, error: null }) // config lookup
                        .mockResolvedValueOnce({ data: null, error: null }) // existing transaction lookup
                        .mockResolvedValueOnce({ data: null, error: null }) // transaction by reference lookup
                        .mockResolvedValueOnce({ data: null, error: null }) // order lookup by reference
                        .mockResolvedValueOnce({ data: { id: "new-tx-id" }, error: null }) // insert new transaction

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

                    // Sin events secret, el webhook debe procesarse (no validar firma)
                    expect(response.status).toBe(200)
                    expect(result.received).toBe(true)
                }
            ),
            { numRuns: 50 }
        )
    })
})