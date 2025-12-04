/**
 * Property-based tests for customer server actions
 * **Feature: code-quality-improvements**
 * **Property 3: Success returns data wrapper**
 * **Property 4: Failure returns error wrapper**
 * **Validates: Requirements 2.2, 2.3**
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import * as fc from "fast-check"

// Create stable mock functions that persist across calls
const mockProfileSingle = vi.fn()
const mockProfileEq = vi.fn(() => ({ single: mockProfileSingle }))
const mockProfileSelect = vi.fn(() => ({ eq: mockProfileEq }))

const mockCustomerSingle = vi.fn()
const mockCustomerSelect = vi.fn(() => ({ single: mockCustomerSingle }))
const mockCustomerInsert = vi.fn(() => ({ select: mockCustomerSelect }))

const mockUpdateEq = vi.fn()
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }))

const mockDeleteEq = vi.fn()
const mockDelete = vi.fn(() => ({ eq: mockDeleteEq }))

const mockGetUser = vi.fn()
const mockFrom = vi.fn((table: string) => {
  if (table === "profiles") {
    return { select: mockProfileSelect }
  }
  if (table === "customers") {
    return { 
      insert: mockCustomerInsert,
      update: mockUpdate,
      delete: mockDelete,
    }
  }
  return {}
})

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  })),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

import { createCustomer, updateCustomer, deleteCustomer } from "@/app/dashboard/customers/actions"

describe("customer actions", () => {
  describe("createCustomer - Property 3: Success returns data wrapper", () => {
    /**
     * **Feature: code-quality-improvements, Property 3: Success returns data wrapper**
     * **Validates: Requirements 2.2**
     */
    beforeEach(() => {
      vi.clearAllMocks()
      
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
        error: null,
      })
      
      mockProfileSingle.mockResolvedValue({
        data: { organization_id: "org-123" },
        error: null,
      })
      
      mockCustomerSingle.mockResolvedValue({
        data: { id: "customer-123" },
        error: null,
      })
    })

    it("returns { success: true, data: { id } } on successful creation", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            full_name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            // Use a simple email pattern that Zod will accept
            email: fc.option(
              fc.tuple(
                fc.stringMatching(/^[a-z][a-z0-9]{0,10}$/),
                fc.stringMatching(/^[a-z]{2,6}$/),
                fc.stringMatching(/^[a-z]{2,4}$/)
              ).map(([local, domain, tld]) => `${local}@${domain}.${tld}`),
              { nil: undefined }
            ),
            phone: fc.option(fc.string({ maxLength: 50 }), { nil: undefined }),
            category: fc.constantFrom("nuevo", "recurrente", "vip", "inactivo"),
            acquisition_channel: fc.constantFrom("web", "chat", "referido", "importado", "manual"),
            tags: fc.array(fc.string(), { maxLength: 5 }),
          }),
          async (input) => {
            const result = await createCustomer(input)

            expect(result.success).toBe(true)
            if (result.success) {
              expect(result.data).toBeDefined()
              expect(result.data).toHaveProperty("id")
              expect(typeof result.data.id).toBe("string")
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe("createCustomer - Property 4: Failure returns error wrapper (validation)", () => {
    /**
     * **Feature: code-quality-improvements, Property 4: Failure returns error wrapper**
     * **Validates: Requirements 2.3**
     */
    it("returns { success: false, error } on validation failure", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.record({
              full_name: fc.constantFrom("", "   ", "\t\n"),
              category: fc.constantFrom("nuevo", "recurrente", "vip", "inactivo"),
              acquisition_channel: fc.constantFrom("web", "chat", "referido", "importado", "manual"),
              tags: fc.array(fc.string(), { maxLength: 5 }),
            }),
            fc.record({
              full_name: fc.oneof(
                fc.constant(null as unknown as string),
                fc.constant(undefined as unknown as string),
                fc.integer() as fc.Arbitrary<unknown> as fc.Arbitrary<string>
              ),
              category: fc.constantFrom("nuevo", "recurrente", "vip", "inactivo"),
              acquisition_channel: fc.constantFrom("web", "chat", "referido", "importado", "manual"),
              tags: fc.array(fc.string(), { maxLength: 5 }),
            })
          ),
          async (input) => {
            const result = await createCustomer(input as any)

            expect(result.success).toBe(false)
            if (!result.success) {
              expect(result.error).toBeDefined()
              expect(typeof result.error).toBe("string")
              expect(result.fieldErrors).toBeDefined()
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe("createCustomer - Property 4: Failure returns error wrapper (auth)", () => {
    /**
     * **Feature: code-quality-improvements, Property 4: Failure returns error wrapper**
     * **Validates: Requirements 2.3**
     */
    beforeEach(() => {
      vi.clearAllMocks()
      
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })
    })

    it("returns { success: false, error } when unauthorized", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            full_name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            category: fc.constantFrom("nuevo", "recurrente", "vip", "inactivo"),
            acquisition_channel: fc.constantFrom("web", "chat", "referido", "importado", "manual"),
            tags: fc.array(fc.string(), { maxLength: 5 }),
          }),
          async (input) => {
            const result = await createCustomer(input)

            expect(result.success).toBe(false)
            if (!result.success) {
              expect(result.error).toBeDefined()
              expect(typeof result.error).toBe("string")
              expect(result.error).toBe("Unauthorized")
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe("updateCustomer - Property 4: Failure returns error wrapper (auth)", () => {
    /**
     * **Feature: code-quality-improvements, Property 4: Failure returns error wrapper**
     * **Validates: Requirements 2.3**
     */
    beforeEach(() => {
      vi.clearAllMocks()
      
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })
    })

    it("returns { success: false, error } when unauthorized", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.record({
            full_name: fc.option(
              fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
              { nil: undefined }
            ),
          }),
          async (customerId, input) => {
            const result = await updateCustomer(customerId, input)

            expect(result.success).toBe(false)
            if (!result.success) {
              expect(result.error).toBe("Unauthorized")
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe("updateCustomer - Property 3: Success returns data wrapper", () => {
    /**
     * **Feature: code-quality-improvements, Property 3: Success returns data wrapper**
     * **Validates: Requirements 2.2**
     */
    beforeEach(() => {
      vi.clearAllMocks()
      
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
        error: null,
      })
      
      mockUpdateEq.mockResolvedValue({ error: null })
    })

    it("returns { success: true, data: undefined } on successful update", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.record({
            full_name: fc.option(
              fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
              { nil: undefined }
            ),
            // Use a simple email pattern that Zod will accept
            email: fc.option(
              fc.tuple(
                fc.stringMatching(/^[a-z][a-z0-9]{0,10}$/),
                fc.stringMatching(/^[a-z]{2,6}$/),
                fc.stringMatching(/^[a-z]{2,4}$/)
              ).map(([local, domain, tld]) => `${local}@${domain}.${tld}`),
              { nil: undefined }
            ),
          }),
          async (customerId, input) => {
            const result = await updateCustomer(customerId, input)

            expect(result.success).toBe(true)
            if (result.success) {
              expect(result.data).toBeUndefined()
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe("deleteCustomer - Property 4: Failure returns error wrapper (auth)", () => {
    /**
     * **Feature: code-quality-improvements, Property 4: Failure returns error wrapper**
     * **Validates: Requirements 2.3**
     */
    beforeEach(() => {
      vi.clearAllMocks()
      
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })
    })

    it("returns { success: false, error } when unauthorized", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          async (customerId) => {
            const result = await deleteCustomer(customerId)

            expect(result.success).toBe(false)
            if (!result.success) {
              expect(result.error).toBe("Unauthorized")
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe("deleteCustomer - Property 3: Success returns data wrapper", () => {
    /**
     * **Feature: code-quality-improvements, Property 3: Success returns data wrapper**
     * **Validates: Requirements 2.2**
     */
    beforeEach(() => {
      vi.clearAllMocks()
      
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
        error: null,
      })
      
      mockDeleteEq.mockResolvedValue({ error: null })
    })

    it("returns { success: true, data: undefined } on successful delete", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          async (customerId) => {
            const result = await deleteCustomer(customerId)

            expect(result.success).toBe(true)
            if (result.success) {
              expect(result.data).toBeUndefined()
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
