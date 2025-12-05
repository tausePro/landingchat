/**
 * Property-based tests for WhatsApp notifications
 * **Feature: whatsapp-integration, Property 4: Persistencia de mensajes**
 * **Validates: Requirements 3.4, 4.5**
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import * as fc from "fast-check"

// Mock Supabase client
const mockWhatsAppInstanceSelect = vi.fn()
const mockSystemSettingsSelect = vi.fn()

const mockFrom = vi.fn((table: string) => {
  if (table === "whatsapp_instances") {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: mockWhatsAppInstanceSelect
            }))
          }))
        }))
      }))
    }
  }
  if (table === "system_settings") {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: mockSystemSettingsSelect
        }))
      }))
    }
  }
  return {
    select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn() })) })),
  }
})

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(() => Promise.resolve({
    from: mockFrom,
  })),
}))

// Mock Evolution client
const mockSendTextMessage = vi.fn()
vi.mock("@/lib/evolution", () => ({
  EvolutionClient: class {
    sendTextMessage = mockSendTextMessage
  },
}))

import { 
  sendSaleNotification, 
  sendLowStockNotification,
  sendNewConversationNotification 
} from "@/lib/notifications/whatsapp"

describe("WhatsApp Notifications - Property 4: Persistencia de mensajes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * **Feature: whatsapp-integration, Property 4: Persistencia de mensajes**
   * **Validates: Requirements 3.4, 4.5**
   *
   * For any notification, when notifications are enabled, the system SHALL
   * send the notification via WhatsApp.
   */
  it("sends sale notification when enabled", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random organization ID
        fc.uuid(),
        // Generate random order data
        fc.record({
          id: fc.uuid(),
          total: fc.integer({ min: 1000, max: 1000000 }),
          customerName: fc.string({ minLength: 3, maxLength: 50 }),
          items: fc.array(
            fc.record({
              name: fc.string({ minLength: 3, maxLength: 30 }),
              quantity: fc.integer({ min: 1, max: 10 })
            }),
            { minLength: 1, maxLength: 5 }
          )
        }),
        // Generate random phone number
        fc.tuple(
          fc.constantFrom("+1", "+52", "+57", "+34"),
          fc.integer({ min: 1000000000, max: 9999999999 })
        ).map(([code, num]) => `${code}${num}`),
        async (organizationId, order, phoneNumber) => {
          // Setup mocks - notifications ENABLED
          mockWhatsAppInstanceSelect.mockResolvedValue({
            data: {
              phone_number: phoneNumber,
              notifications_enabled: true,
              notify_on_sale: true,
            },
            error: null,
          })

          mockSystemSettingsSelect.mockResolvedValue({
            data: {
              value: {
                url: "http://test.com",
                apiKey: "test-key",
              },
            },
            error: null,
          })

          mockSendTextMessage.mockResolvedValue(undefined)

          // Send notification
          const result = await sendSaleNotification(
            { organizationId },
            order
          )

          // Should succeed
          expect(result).toBe(true)

          // Should have called sendTextMessage
          expect(mockSendTextMessage).toHaveBeenCalled()
          const lastCall = mockSendTextMessage.mock.calls[mockSendTextMessage.mock.calls.length - 1]
          expect(lastCall).toBeDefined()
          expect(lastCall[1]).toMatchObject({
            number: phoneNumber,
            text: expect.stringContaining(order.customerName),
          })
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * **Feature: whatsapp-integration, Property 4: Persistencia de mensajes**
   * **Validates: Requirements 3.4, 4.5**
   *
   * For any notification, when notifications are disabled, the system SHALL NOT
   * send the notification.
   */
  it("does not send sale notification when disabled", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.record({
          id: fc.uuid(),
          total: fc.integer({ min: 1000, max: 1000000 }),
          customerName: fc.string({ minLength: 3, maxLength: 50 }),
          items: fc.array(
            fc.record({
              name: fc.string({ minLength: 3, maxLength: 30 }),
              quantity: fc.integer({ min: 1, max: 10 })
            }),
            { minLength: 1, maxLength: 5 }
          )
        }),
        async (organizationId, order) => {
          // Setup mocks - notifications DISABLED
          mockWhatsAppInstanceSelect.mockResolvedValue({
            data: {
              phone_number: "+573001234567",
              notifications_enabled: false, // DISABLED
              notify_on_sale: true,
            },
            error: null,
          })

          // Send notification
          const result = await sendSaleNotification(
            { organizationId },
            order
          )

          // Should return false (not sent)
          expect(result).toBe(false)

          // Should NOT have called sendTextMessage
          expect(mockSendTextMessage).not.toHaveBeenCalled()
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * **Feature: whatsapp-integration, Property 4: Persistencia de mensajes**
   * **Validates: Requirements 3.4, 4.5**
   *
   * For any low stock notification, when enabled, the system SHALL send
   * notification with product details.
   */
  it("sends low stock notification when enabled", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.record({
          id: fc.uuid(),
          name: fc.string({ minLength: 3, maxLength: 50 }),
          stock: fc.integer({ min: 0, max: 10 }),
          sku: fc.option(fc.string({ minLength: 3, maxLength: 20 }), { nil: undefined })
        }),
        fc.tuple(
          fc.constantFrom("+1", "+52", "+57", "+34"),
          fc.integer({ min: 1000000000, max: 9999999999 })
        ).map(([code, num]) => `${code}${num}`),
        async (organizationId, product, phoneNumber) => {
          // Setup mocks - notifications ENABLED
          mockWhatsAppInstanceSelect.mockResolvedValue({
            data: {
              phone_number: phoneNumber,
              notifications_enabled: true,
              notify_on_low_stock: true,
            },
            error: null,
          })

          mockSystemSettingsSelect.mockResolvedValue({
            data: {
              value: {
                url: "http://test.com",
                apiKey: "test-key",
              },
            },
            error: null,
          })

          mockSendTextMessage.mockResolvedValue(undefined)

          // Send notification
          const result = await sendLowStockNotification(
            { organizationId },
            product
          )

          // Should succeed
          expect(result).toBe(true)

          // Should have called sendTextMessage with product name
          expect(mockSendTextMessage).toHaveBeenCalled()
          const lastCall = mockSendTextMessage.mock.calls[mockSendTextMessage.mock.calls.length - 1]
          expect(lastCall).toBeDefined()
          expect(lastCall[1]).toMatchObject({
            number: phoneNumber,
            text: expect.stringContaining(product.name),
          })
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * **Feature: whatsapp-integration, Property 4: Persistencia de mensajes**
   * **Validates: Requirements 3.4, 4.5**
   *
   * For any new conversation notification, when enabled, the system SHALL send
   * notification with customer details.
   */
  it("sends new conversation notification when enabled", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        // Generate customer with at least phone OR email
        fc.oneof(
          fc.record({
            name: fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length > 0),
            phone: fc.tuple(
              fc.constantFrom("+1", "+52", "+57", "+34"),
              fc.integer({ min: 1000000000, max: 9999999999 })
            ).map(([code, num]) => `${code}${num}`),
            email: fc.option(fc.emailAddress(), { nil: undefined })
          }),
          fc.record({
            name: fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length > 0),
            phone: fc.option(
              fc.tuple(
                fc.constantFrom("+1", "+52", "+57", "+34"),
                fc.integer({ min: 1000000000, max: 9999999999 })
              ).map(([code, num]) => `${code}${num}`),
              { nil: undefined }
            ),
            email: fc.emailAddress()
          })
        ),
        fc.tuple(
          fc.constantFrom("+1", "+52", "+57", "+34"),
          fc.integer({ min: 1000000000, max: 9999999999 })
        ).map(([code, num]) => `${code}${num}`),
        async (organizationId, customer, phoneNumber) => {
          // Setup mocks - notifications ENABLED
          mockWhatsAppInstanceSelect.mockResolvedValue({
            data: {
              phone_number: phoneNumber,
              notifications_enabled: true,
              notify_on_new_conversation: true,
            },
            error: null,
          })

          mockSystemSettingsSelect.mockResolvedValue({
            data: {
              value: {
                url: "http://test.com",
                apiKey: "test-key",
              },
            },
            error: null,
          })

          mockSendTextMessage.mockResolvedValue(undefined)

          // Send notification
          const result = await sendNewConversationNotification(
            { organizationId },
            customer
          )

          // Should succeed
          expect(result).toBe(true)

          // Should have called sendTextMessage with customer name
          expect(mockSendTextMessage).toHaveBeenCalled()
          const lastCall = mockSendTextMessage.mock.calls[mockSendTextMessage.mock.calls.length - 1]
          expect(lastCall).toBeDefined()
          expect(lastCall[1]).toMatchObject({
            number: phoneNumber,
            text: expect.stringContaining(customer.name),
          })
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * **Feature: whatsapp-integration, Property 4: Persistencia de mensajes**
   * **Validates: Requirements 3.4, 4.5**
   *
   * For any notification type, when the specific notification type is disabled,
   * the system SHALL NOT send that notification.
   */
  it("respects individual notification type settings", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.record({
          id: fc.uuid(),
          total: fc.integer({ min: 1000, max: 1000000 }),
          customerName: fc.string({ minLength: 3, maxLength: 50 }),
          items: fc.array(
            fc.record({
              name: fc.string({ minLength: 3, maxLength: 30 }),
              quantity: fc.integer({ min: 1, max: 10 })
            }),
            { minLength: 1, maxLength: 5 }
          )
        }),
        async (organizationId, order) => {
          // Setup mocks - notifications enabled BUT notify_on_sale disabled
          mockWhatsAppInstanceSelect.mockResolvedValue({
            data: {
              phone_number: "+573001234567",
              notifications_enabled: true, // ENABLED
              notify_on_sale: false, // BUT THIS TYPE DISABLED
            },
            error: null,
          })

          // Send notification
          const result = await sendSaleNotification(
            { organizationId },
            order
          )

          // Should return false (not sent)
          expect(result).toBe(false)

          // Should NOT have called sendTextMessage
          expect(mockSendTextMessage).not.toHaveBeenCalled()
        }
      ),
      { numRuns: 50 }
    )
  })
})
