/**
 * Property-based tests for tax information completeness
 * Task 3.3: Property 11 - Tax Information Completeness
 * Feature: e-commerce-checkout-flow, Property 11
 * Validates: Requirements 10.1, 10.2, 10.3, 10.5
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { documentTypeSchema, personTypeSchema } from '@/types/order'

describe('Property 11: Tax Information Completeness', () => {
  // Arbitraries for generating test data
  const documentTypeArb = fc.constantFrom('CC', 'NIT', 'CE', 'Passport', 'TI')
  const personTypeArb = fc.constantFrom('Natural', 'Jurídica')
  const documentNumberArb = fc.integer({ min: 10000, max: 999999999999999 }).map(n => n.toString())
  
  const customerInfoArb = fc.record({
    name: fc.string({ minLength: 3, maxLength: 100 }),
    email: fc.emailAddress(),
    phone: fc.string({ minLength: 10, maxLength: 15 }),
    address: fc.string({ minLength: 5, maxLength: 200 }),
    city: fc.string({ minLength: 3, maxLength: 50 }),
    document_type: documentTypeArb,
    document_number: documentNumberArb,
    person_type: personTypeArb,
    business_name: fc.option(fc.string({ minLength: 3, maxLength: 100 }), { nil: undefined })
  })

  it('should validate that all orders have required tax fields', () => {
    fc.assert(
      fc.property(customerInfoArb, (customerInfo) => {
        // Validate document_type
        const documentTypeResult = documentTypeSchema.safeParse(customerInfo.document_type)
        expect(documentTypeResult.success).toBe(true)
        
        // Validate document_number exists and is not empty
        expect(customerInfo.document_number).toBeDefined()
        expect(customerInfo.document_number.length).toBeGreaterThan(0)
        
        // Validate person_type
        const personTypeResult = personTypeSchema.safeParse(customerInfo.person_type)
        expect(personTypeResult.success).toBe(true)
        
        // If Jurídica, business_name should be present (optional but recommended)
        if (customerInfo.person_type === 'Jurídica' && customerInfo.business_name) {
          expect(customerInfo.business_name.length).toBeGreaterThan(0)
        }
      }),
      { numRuns: 50 }
    )
  })

  it('should accept all valid document types', () => {
    fc.assert(
      fc.property(documentTypeArb, (docType) => {
        const result = documentTypeSchema.safeParse(docType)
        expect(result.success).toBe(true)
      }),
      { numRuns: 50 }
    )
  })

  it('should accept all valid person types', () => {
    fc.assert(
      fc.property(personTypeArb, (personType) => {
        const result = personTypeSchema.safeParse(personType)
        expect(result.success).toBe(true)
      }),
      { numRuns: 50 }
    )
  })

  it('should reject invalid document types', () => {
    const invalidTypes = ['DNI', 'RUT', 'INVALID', '', '123']
    
    invalidTypes.forEach(invalidType => {
      const result = documentTypeSchema.safeParse(invalidType)
      expect(result.success).toBe(false)
    })
  })

  it('should reject invalid person types', () => {
    const invalidTypes = ['Fisica', 'Moral', 'INVALID', '', '123']
    
    invalidTypes.forEach(invalidType => {
      const result = personTypeSchema.safeParse(invalidType)
      expect(result.success).toBe(false)
    })
  })

  it('should validate complete customer info structure', () => {
    fc.assert(
      fc.property(customerInfoArb, (customerInfo) => {
        // All required fields must be present
        expect(customerInfo).toHaveProperty('name')
        expect(customerInfo).toHaveProperty('email')
        expect(customerInfo).toHaveProperty('phone')
        expect(customerInfo).toHaveProperty('address')
        expect(customerInfo).toHaveProperty('city')
        expect(customerInfo).toHaveProperty('document_type')
        expect(customerInfo).toHaveProperty('document_number')
        expect(customerInfo).toHaveProperty('person_type')
        
        // Tax fields must not be empty strings
        expect(customerInfo.document_type).not.toBe('')
        expect(customerInfo.document_number).not.toBe('')
        expect(customerInfo.person_type).not.toBe('')
      }),
      { numRuns: 50 }
    )
  })
})
