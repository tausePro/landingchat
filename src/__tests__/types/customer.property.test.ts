/**
 * Property-based tests for customer schema validation
 * **Feature: code-quality-improvements, Property 2: Invalid input returns structured error**
 * **Validates: Requirements 1.2**
 */

import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { createCustomerSchema } from "@/types/customer"

describe("createCustomerSchema", () => {
  /**
   * **Feature: code-quality-improvements, Property 2: Invalid input returns structured error**
   * **Validates: Requirements 1.2**
   *
   * For any input that fails Zod validation, the result SHALL have shape
   * { success: false, error: ZodError } with structured field errors.
   */
  it("returns structured errors for invalid inputs with empty full_name", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          full_name: fc.constantFrom("", "   ", "\t", "\n"), // Invalid: empty or whitespace-only names
        }),
        async (input) => {
          const result = createCustomerSchema.safeParse(input)

          expect(result.success).toBe(false)
          if (!result.success) {
            expect(result.error).toBeDefined()
            expect(result.error.issues).toBeDefined()
            expect(Array.isArray(result.error.issues)).toBe(true)
            // Should have at least one error for the full_name field
            const nameErrors = result.error.issues.filter(
              (e) => e.path.some((p) => p === "full_name")
            )
            expect(nameErrors.length).toBeGreaterThan(0)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Feature: code-quality-improvements, Property 2: Invalid input returns structured error**
   * **Validates: Requirements 1.2**
   *
   * For any input with invalid email format, validation SHALL fail with structured error.
   */
  it("returns structured errors for invalid email format", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          full_name: fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0),
          email: fc.string({ minLength: 1, maxLength: 100 }).filter(
            (s) => !s.includes("@") || !s.includes(".") // Invalid email patterns
          ),
        }),
        async (input) => {
          const result = createCustomerSchema.safeParse(input)

          expect(result.success).toBe(false)
          if (!result.success) {
            expect(result.error).toBeDefined()
            expect(result.error.issues).toBeDefined()
            // Should have error for email field
            const emailErrors = result.error.issues.filter(
              (e) => e.path.some((p) => p === "email")
            )
            expect(emailErrors.length).toBeGreaterThan(0)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Feature: code-quality-improvements, Property 2: Invalid input returns structured error**
   * **Validates: Requirements 1.2**
   *
   * For any input with invalid category, validation SHALL fail with structured error.
   */
  it("returns structured errors for invalid category", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          full_name: fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0),
          category: fc.string({ minLength: 1 }).filter(
            (s) => !["nuevo", "recurrente", "vip", "inactivo"].includes(s)
          ),
        }),
        async (input) => {
          const result = createCustomerSchema.safeParse(input)

          expect(result.success).toBe(false)
          if (!result.success) {
            expect(result.error).toBeDefined()
            expect(result.error.issues).toBeDefined()
            // Should have error for category field
            const categoryErrors = result.error.issues.filter(
              (e) => e.path.some((p) => p === "category")
            )
            expect(categoryErrors.length).toBeGreaterThan(0)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Valid inputs should pass validation.
   * This ensures our schema accepts well-formed data.
   */
  it("accepts valid customer inputs", async () => {
    // Generate emails that match Zod's stricter validation (alphanumeric local part)
    const zodCompatibleEmail = fc
      .tuple(
        fc.stringMatching(/^[a-z][a-z0-9]{0,19}$/), // local part: starts with letter, alphanumeric
        fc.stringMatching(/^[a-z]{2,10}$/), // domain name
        fc.constantFrom("com", "org", "net", "io", "co") // TLD
      )
      .map(([local, domain, tld]) => `${local}@${domain}.${tld}`)

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          full_name: fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0),
          email: fc.option(zodCompatibleEmail, { nil: undefined }),
          phone: fc.option(fc.string({ maxLength: 50 }), { nil: undefined }),
          category: fc.option(
            fc.constantFrom("nuevo", "recurrente", "vip", "inactivo"),
            { nil: undefined }
          ),
          acquisition_channel: fc.option(
            fc.constantFrom("web", "chat", "referido", "importado", "manual"),
            { nil: undefined }
          ),
        }),
        async (input) => {
          const result = createCustomerSchema.safeParse(input)

          expect(result.success).toBe(true)
          if (result.success) {
            expect(result.data.full_name).toBe(input.full_name)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
