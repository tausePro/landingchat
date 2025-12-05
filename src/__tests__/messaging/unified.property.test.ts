/**
 * Property-based tests for unified messaging service
 * **Feature: whatsapp-integration, Property 1: Identificación de cliente por teléfono**
 * **Validates: Requirements 3.2, 3.3, 5.1**
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import * as fc from "fast-check"

// Mock Supabase client
const mockCustomerSelect = vi.fn()
const mockCustomerInsert = vi.fn()
const mockCustomerUpdate = vi.fn()

const mockFrom = vi.fn((table: string) => {
  if (table === "customers") {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: mockCustomerSelect
          })),
          single: mockCustomerSelect
        }))
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: mockCustomerInsert
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => mockCustomerUpdate())
      }))
    }
  }
  return {
    select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn() })) })),
    insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn() })) })),
  }
})

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(() => Promise.resolve({
    from: mockFrom,
  })),
}))

import { identifyCustomer } from "@/lib/messaging/unified"

describe("Unified Messaging - Property 1: Identificación de cliente por teléfono", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * **Feature: whatsapp-integration, Property 1: Identificación de cliente por teléfono**
   * **Validates: Requirements 3.2, 3.3, 5.1**
   *
   * For any phone number, if a customer exists with that phone number,
   * the system SHALL return the existing customer ID (not create a new one).
   */
  it("returns existing customer when phone number matches", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random organization ID
        fc.uuid(),
        // Generate random phone number
        fc.tuple(
          fc.constantFrom("+1", "+52", "+57", "+34"),
          fc.integer({ min: 1000000000, max: 9999999999 })
        ).map(([code, num]) => `${code}${num}`),
        // Generate random customer ID
        fc.uuid(),
        async (organizationId, phoneNumber, existingCustomerId) => {
          // Setup mock to return existing customer
          mockCustomerSelect.mockResolvedValue({
            data: { id: existingCustomerId },
            error: null,
          })

          mockCustomerUpdate.mockResolvedValue({ error: null })

          // Call identifyCustomer
          const result = await identifyCustomer(organizationId, phoneNumber)

          // Should return existing customer
          expect(result).not.toBeNull()
          expect(result?.id).toBe(existingCustomerId)
          expect(result?.isNew).toBe(false)

          // Should NOT have called insert (no new customer created)
          expect(mockCustomerInsert).not.toHaveBeenCalled()
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Feature: whatsapp-integration, Property 1: Identificación de cliente por teléfono**
   * **Validates: Requirements 3.2, 3.3, 5.1**
   *
   * For any phone number, if NO customer exists with that phone number,
   * the system SHALL create a new customer with that phone number.
   */
  it("creates new customer when phone number does not exist", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random organization ID
        fc.uuid(),
        // Generate random phone number
        fc.tuple(
          fc.constantFrom("+1", "+52", "+57", "+34"),
          fc.integer({ min: 1000000000, max: 9999999999 })
        ).map(([code, num]) => `${code}${num}`),
        // Generate random new customer ID
        fc.uuid(),
        async (organizationId, phoneNumber, newCustomerId) => {
          // Setup mock to return NO existing customer
          mockCustomerSelect.mockResolvedValue({
            data: null,
            error: { code: "PGRST116" }, // Supabase "not found" error
          })

          // Setup mock to return new customer
          mockCustomerInsert.mockResolvedValue({
            data: { id: newCustomerId },
            error: null,
          })

          // Call identifyCustomer
          const result = await identifyCustomer(organizationId, phoneNumber)

          // Should return new customer
          expect(result).not.toBeNull()
          expect(result?.id).toBe(newCustomerId)
          expect(result?.isNew).toBe(true)

          // Should have called insert (new customer created)
          expect(mockCustomerInsert).toHaveBeenCalled()
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Feature: whatsapp-integration, Property 1: Identificación de cliente por teléfono**
   * **Validates: Requirements 3.2, 3.3, 5.1**
   *
   * For any email address, if a customer exists with that email,
   * the system SHALL return the existing customer ID.
   */
  it("returns existing customer when email matches", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random organization ID
        fc.uuid(),
        // Generate random email
        fc.emailAddress(),
        // Generate random customer ID
        fc.uuid(),
        async (organizationId, email, existingCustomerId) => {
          // Setup mock to return existing customer
          mockCustomerSelect.mockResolvedValue({
            data: { id: existingCustomerId },
            error: null,
          })

          mockCustomerUpdate.mockResolvedValue({ error: null })

          // Call identifyCustomer with email (no phone)
          const result = await identifyCustomer(organizationId, undefined, email)

          // Should return existing customer
          expect(result).not.toBeNull()
          expect(result?.id).toBe(existingCustomerId)
          expect(result?.isNew).toBe(false)

          // Should NOT have called insert
          expect(mockCustomerInsert).not.toHaveBeenCalled()
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Feature: whatsapp-integration, Property 1: Identificación de cliente por teléfono**
   * **Validates: Requirements 3.2, 3.3, 5.1**
   *
   * For any request without phone or email, the system SHALL return null
   * (cannot identify customer without contact information).
   */
  it("returns null when no contact information provided", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random organization ID
        fc.uuid(),
        async (organizationId) => {
          // Call identifyCustomer without phone or email
          const result = await identifyCustomer(organizationId)

          // Should return null
          expect(result).toBeNull()

          // Should NOT have called any database operations
          expect(mockCustomerSelect).not.toHaveBeenCalled()
          expect(mockCustomerInsert).not.toHaveBeenCalled()
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * **Feature: whatsapp-integration, Property 1: Identificación de cliente por teléfono**
   * **Validates: Requirements 3.2, 3.3, 5.1**
   *
   * For any customer identification, the system SHALL update last_interaction_at
   * for existing customers.
   */
  it("updates last interaction timestamp for existing customers", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.tuple(
          fc.constantFrom("+1", "+52", "+57", "+34"),
          fc.integer({ min: 1000000000, max: 9999999999 })
        ).map(([code, num]) => `${code}${num}`),
        fc.uuid(),
        async (organizationId, phoneNumber, existingCustomerId) => {
          // Setup mock to return existing customer
          mockCustomerSelect.mockResolvedValue({
            data: { id: existingCustomerId },
            error: null,
          })

          mockCustomerUpdate.mockResolvedValue({ error: null })

          // Call identifyCustomer
          await identifyCustomer(organizationId, phoneNumber)

          // Should have called update to set last_interaction_at
          expect(mockCustomerUpdate).toHaveBeenCalled()
        }
      ),
      { numRuns: 100 }
    )
  })
})
