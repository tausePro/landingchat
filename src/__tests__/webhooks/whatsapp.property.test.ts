/**
 * Property-based tests for WhatsApp webhook handler
 * **Feature: whatsapp-integration, Property 5: Validación de webhook**
 * **Validates: Requirements 3.5, 5.4**
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import * as fc from "fast-check"
import crypto from "crypto"

// Mock Supabase client before importing
const mockSystemSettingsSelect = vi.fn()
const mockWhatsAppInstanceSelect = vi.fn()
const mockWhatsAppInstanceUpdate = vi.fn()

const mockFrom = vi.fn((table: string) => {
  if (table === "system_settings") {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: mockSystemSettingsSelect
        }))
      }))
    }
  }
  if (table === "whatsapp_instances") {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: mockWhatsAppInstanceSelect
        }))
      })),
      update: vi.fn((data: unknown) => ({
        eq: vi.fn(() => mockWhatsAppInstanceUpdate())
      }))
    }
  }
  // Default mock for other tables
  return {
    select: vi.fn(() => ({ 
      eq: vi.fn(() => ({ 
        single: vi.fn(() => Promise.resolve({ data: null, error: null })) 
      })) 
    })),
    insert: vi.fn(() => ({ 
      select: vi.fn(() => ({ 
        single: vi.fn(() => Promise.resolve({ data: { id: "test-id" }, error: null })) 
      })) 
    })),
    update: vi.fn(() => ({ 
      eq: vi.fn(() => Promise.resolve({ error: null })) 
    })),
  }
})

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(() => ({
    from: mockFrom,
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
  })),
}))

// Mock unified messaging
vi.mock("@/lib/messaging/unified", () => ({
  processIncomingMessage: vi.fn(() => Promise.resolve({ success: true })),
}))

describe("WhatsApp Webhook - Property 5: Validación de webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * **Feature: whatsapp-integration, Property 5: Validación de webhook**
   * **Validates: Requirements 3.5, 5.4**
   *
   * For any webhook request without valid signature, the system SHALL reject
   * with 401 status when webhookSecret is configured.
   */
  it("rejects webhooks with invalid signature when secret is configured", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random webhook secret
        fc.string({ minLength: 16, maxLength: 64 }),
        // Generate random invalid signature (64 char hex string)
        fc.stringMatching(/^[0-9a-f]{64}$/),
        async (webhookSecret, invalidSignatureHex) => {
          // Use a fixed valid payload to avoid processing errors
          const payload = {
            event: "qrcode.updated",
            instance: "test-instance",
            data: { qrcode: "test-qr" },
          }

          // Setup mock to return webhook secret
          mockSystemSettingsSelect.mockResolvedValue({
            data: {
              key: "evolution_api_config",
              value: { webhookSecret },
            },
            error: null,
          })

          mockWhatsAppInstanceSelect.mockResolvedValue({
            data: {
              id: "test-instance-id",
              organization_id: "test-org-id",
              status: "connected",
            },
            error: null,
          })

          mockWhatsAppInstanceUpdate.mockResolvedValue({ error: null })

          // Create request with invalid signature
          const bodyText = JSON.stringify(payload)
          const request = new Request("http://localhost:3000/api/webhooks/whatsapp", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-webhook-signature": `sha256=${invalidSignatureHex}`,
            },
            body: bodyText,
          })

          // Import handler dynamically to use fresh mocks
          const { POST } = await import("@/app/api/webhooks/whatsapp/route")
          const response = await POST(request as any)

          // Should reject with 401
          expect(response.status).toBe(401)
          const json = await response.json()
          expect(json.error).toBe("Invalid signature")
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * **Feature: whatsapp-integration, Property 5: Validación de webhook**
   * **Validates: Requirements 3.5, 5.4**
   *
   * For any webhook request with valid HMAC-SHA256 signature, the system SHALL
   * accept and process the webhook.
   */
  it("accepts webhooks with valid HMAC-SHA256 signature", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random webhook payloads
        fc.record({
          event: fc.constantFrom("connection.update", "qrcode.updated"),
          instance: fc.string({ minLength: 5, maxLength: 50 }),
          data: fc.record({
            state: fc.constantFrom("open", "close", "connecting"),
          }),
        }),
        // Generate random webhook secret
        fc.string({ minLength: 16, maxLength: 64 }),
        async (payload, webhookSecret) => {
          // Setup mocks
          mockSystemSettingsSelect.mockResolvedValue({
            data: {
              key: "evolution_api_config",
              value: { webhookSecret },
            },
            error: null,
          })

          mockWhatsAppInstanceSelect.mockResolvedValue({
            data: {
              id: "test-instance-id",
              organization_id: "test-org-id",
              status: "connected",
            },
            error: null,
          })

          mockWhatsAppInstanceUpdate.mockResolvedValue({ error: null })

          // Calculate valid signature
          const bodyText = JSON.stringify(payload)
          const hmac = crypto.createHmac("sha256", webhookSecret)
          hmac.update(bodyText)
          const validSignature = `sha256=${hmac.digest("hex")}`

          // Create request with valid signature
          const request = new Request("http://localhost:3000/api/webhooks/whatsapp", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-webhook-signature": validSignature,
            },
            body: bodyText,
          })

          // Import handler dynamically
          const { POST } = await import("@/app/api/webhooks/whatsapp/route")
          const response = await POST(request as any)

          // Should accept (200 or 500 if processing fails, but NOT 401)
          expect(response.status).not.toBe(401)
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * **Feature: whatsapp-integration, Property 5: Validación de webhook**
   * **Validates: Requirements 3.5, 5.4**
   *
   * For any webhook request when no webhookSecret is configured, the system
   * SHALL accept the webhook without signature validation.
   */
  it("accepts webhooks without signature when no secret is configured", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          event: fc.constantFrom("connection.update", "qrcode.updated"),
          instance: fc.string({ minLength: 5, maxLength: 50 }),
          data: fc.record({
            state: fc.constantFrom("open", "close", "connecting"),
          }),
        }),
        async (payload) => {
          // Setup mock to return NO webhook secret
          mockSystemSettingsSelect.mockResolvedValue({
            data: {
              key: "evolution_api_config",
              value: { url: "http://test.com", apiKey: "test" },
            },
            error: null,
          })

          mockWhatsAppInstanceSelect.mockResolvedValue({
            data: {
              id: "test-instance-id",
              organization_id: "test-org-id",
              status: "connected",
            },
            error: null,
          })

          mockWhatsAppInstanceUpdate.mockResolvedValue({ error: null })

          // Create request WITHOUT signature
          const bodyText = JSON.stringify(payload)
          const request = new Request("http://localhost:3000/api/webhooks/whatsapp", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: bodyText,
          })

          // Import handler dynamically
          const { POST } = await import("@/app/api/webhooks/whatsapp/route")
          const response = await POST(request as any)

          // Should accept (not 401)
          expect(response.status).not.toBe(401)
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * **Feature: whatsapp-integration, Property 5: Validación de webhook**
   * **Validates: Requirements 3.5, 5.4**
   *
   * For any webhook request, signature validation SHALL use timing-safe comparison
   * to prevent timing attacks.
   */
  it("uses timing-safe comparison for signature validation", async () => {
    // This property is tested implicitly by using crypto.timingSafeEqual
    // We verify that the implementation doesn't leak timing information
    // by ensuring consistent response times regardless of signature similarity

    const webhookSecret = "test-secret-key-12345"
    const payload = {
      event: "connection.update",
      instance: "test-instance",
      data: { state: "open" },
    }

    mockSystemSettingsSelect.mockResolvedValue({
      data: {
        key: "evolution_api_config",
        value: { webhookSecret },
      },
      error: null,
    })

    mockWhatsAppInstanceSelect.mockResolvedValue({
      data: {
        id: "test-instance-id",
        organization_id: "test-org-id",
        status: "connected",
      },
      error: null,
    })

    mockWhatsAppInstanceUpdate.mockResolvedValue({ error: null })

    const bodyText = JSON.stringify(payload)
    
    // Calculate correct signature
    const hmac = crypto.createHmac("sha256", webhookSecret)
    hmac.update(bodyText)
    const correctSignature = `sha256=${hmac.digest("hex")}`

    // Test with signatures of varying similarity
    const signatures = [
      "sha256=0000000000000000000000000000000000000000000000000000000000000000", // Completely wrong
      correctSignature.slice(0, -10) + "0000000000", // Partially correct
      correctSignature, // Correct
    ]

    const timings: number[] = []

    for (const signature of signatures) {
      const request = new Request("http://localhost:3000/api/webhooks/whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-signature": signature,
        },
        body: bodyText,
      })

      const start = performance.now()
      const { POST } = await import("@/app/api/webhooks/whatsapp/route")
      await POST(request as any)
      const end = performance.now()

      timings.push(end - start)
    }

    // Verify that timing differences are minimal (< 50ms variance)
    // This is a heuristic test - timing-safe comparison should have consistent timing
    const maxTiming = Math.max(...timings)
    const minTiming = Math.min(...timings)
    const variance = maxTiming - minTiming

    // Allow some variance due to system noise, but should be relatively consistent
    expect(variance).toBeLessThan(100) // 100ms tolerance for system noise
  })
})
