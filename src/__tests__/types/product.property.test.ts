/**
 * Property-based tests for product schema validation
 * **Feature: code-quality-improvements, Property 2: Invalid input returns structured error**
 * **Validates: Requirements 1.2**
 */

import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { createProductSchema } from "@/types/product"

describe("createProductSchema", () => {
  /**
   * **Feature: code-quality-improvements, Property 2: Invalid input returns structured error**
   * **Validates: Requirements 1.2**
   *
   * For any input that fails Zod validation, the result SHALL have shape
   * { success: false, error: ZodError } with structured field errors.
   */
  it("returns structured errors for invalid inputs with empty name", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: fc.constantFrom("", "   ", "\t", "\n"), // Invalid: empty or whitespace-only names
          price: fc.double({ min: 0.01, max: 10000, noNaN: true }),
        }),
        async (input) => {
          const result = createProductSchema.safeParse(input)

          expect(result.success).toBe(false)
          if (!result.success) {
            expect(result.error).toBeDefined()
            expect(result.error.issues).toBeDefined()
            expect(Array.isArray(result.error.issues)).toBe(true)
            // Should have at least one error for the name field
            const nameErrors = result.error.issues.filter(
              (e) => e.path.some((p) => p === "name")
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
   * For any input with negative price, validation SHALL fail with structured error.
   */
  it("returns structured errors for invalid inputs with negative price", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 200 }),
          price: fc.double({ max: -0.01, noNaN: true }), // Invalid: negative price
        }),
        async (input) => {
          const result = createProductSchema.safeParse(input)

          expect(result.success).toBe(false)
          if (!result.success) {
            expect(result.error).toBeDefined()
            expect(result.error.issues).toBeDefined()
            // Should have error for price field
            const priceErrors = result.error.issues.filter(
              (e) => e.path.some((p) => p === "price")
            )
            expect(priceErrors.length).toBeGreaterThan(0)
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
   * For any input with negative stock, validation SHALL fail with structured error.
   */
  it("returns structured errors for invalid inputs with negative stock", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 200 }),
          price: fc.double({ min: 0.01, max: 10000, noNaN: true }),
          stock: fc.integer({ max: -1 }), // Invalid: negative stock
        }),
        async (input) => {
          const result = createProductSchema.safeParse(input)

          expect(result.success).toBe(false)
          if (!result.success) {
            expect(result.error).toBeDefined()
            expect(result.error.issues).toBeDefined()
            // Should have error for stock field
            const stockErrors = result.error.issues.filter(
              (e) => e.path.some((p) => p === "stock")
            )
            expect(stockErrors.length).toBeGreaterThan(0)
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
  it("accepts valid product inputs", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0),
          price: fc.double({ min: 0.01, max: 100000, noNaN: true }),
          stock: fc.integer({ min: 0, max: 10000 }),
          description: fc.option(fc.string({ maxLength: 5000 }), { nil: undefined }),
          is_active: fc.option(fc.boolean(), { nil: undefined }),
        }),
        async (input) => {
          const result = createProductSchema.safeParse(input)

          expect(result.success).toBe(true)
          if (result.success) {
            expect(result.data.name).toBe(input.name)
            expect(result.data.price).toBe(input.price)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
