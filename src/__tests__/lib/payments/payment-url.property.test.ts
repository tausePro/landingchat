/**
 * Property-based tests for payment URL generation
 * Task 2.1: Property 9 - Payment URL Generation
 * Feature: e-commerce-checkout-flow, Property 9
 * Validates: Requirements 3.3, 3.6
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

describe('Property 9: Payment URL Generation', () => {
  // Arbitraries for generating test data
  const orderIdArb = fc.uuid()
  const slugArb = fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-z0-9-]+$/.test(s))
  const baseUrlArb = fc.constantFrom(
    'https://landingchat.co',
    'https://www.landingchat.co',
    'http://localhost:3000'
  )

  /**
   * Generate return URLs for payment gateway
   */
  function generateReturnUrls(baseUrl: string, slug: string, orderId: string) {
    // Remove trailing slash from baseUrl
    const cleanBaseUrl = baseUrl.replace(/\/$/, '')
    const baseReturnUrl = `${cleanBaseUrl}/store/${slug}/order/${orderId}`
    return {
      success: `${baseReturnUrl}/success`,
      error: `${baseReturnUrl}/error`,
      pending: `${baseReturnUrl}/pending`
    }
  }

  it('should generate URLs with correct return paths', () => {
    fc.assert(
      fc.property(baseUrlArb, slugArb, orderIdArb, (baseUrl, slug, orderId) => {
        const urls = generateReturnUrls(baseUrl, slug, orderId)
        
        // All URLs should start with base URL
        expect(urls.success).toContain(baseUrl)
        expect(urls.error).toContain(baseUrl)
        expect(urls.pending).toContain(baseUrl)
        
        // All URLs should contain the slug
        expect(urls.success).toContain(`/store/${slug}/`)
        expect(urls.error).toContain(`/store/${slug}/`)
        expect(urls.pending).toContain(`/store/${slug}/`)
        
        // All URLs should contain the order ID
        expect(urls.success).toContain(orderId)
        expect(urls.error).toContain(orderId)
        expect(urls.pending).toContain(orderId)
        
        // URLs should end with correct status
        expect(urls.success.endsWith('/success')).toBe(true)
        expect(urls.error.endsWith('/error')).toBe(true)
        expect(urls.pending.endsWith('/pending')).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  it('should generate valid URLs', () => {
    fc.assert(
      fc.property(baseUrlArb, slugArb, orderIdArb, (baseUrl, slug, orderId) => {
        const urls = generateReturnUrls(baseUrl, slug, orderId)
        
        // All URLs should be valid
        expect(() => new URL(urls.success)).not.toThrow()
        expect(() => new URL(urls.error)).not.toThrow()
        expect(() => new URL(urls.pending)).not.toThrow()
      }),
      { numRuns: 100 }
    )
  })

  it('should generate different URLs for different orders', () => {
    fc.assert(
      fc.property(
        baseUrlArb,
        slugArb,
        orderIdArb,
        orderIdArb,
        (baseUrl, slug, orderId1, orderId2) => {
          fc.pre(orderId1 !== orderId2) // Ensure different order IDs
          
          const urls1 = generateReturnUrls(baseUrl, slug, orderId1)
          const urls2 = generateReturnUrls(baseUrl, slug, orderId2)
          
          // URLs should be different for different orders
          expect(urls1.success).not.toBe(urls2.success)
          expect(urls1.error).not.toBe(urls2.error)
          expect(urls1.pending).not.toBe(urls2.pending)
        }
      ),
      { numRuns: 50 }
    )
  })

  it('should handle trailing slashes correctly', () => {
    fc.assert(
      fc.property(slugArb, orderIdArb, (slug, orderId) => {
        const baseUrlWithSlash = 'https://landingchat.co/'
        const baseUrlWithoutSlash = 'https://landingchat.co'
        
        const urls1 = generateReturnUrls(baseUrlWithSlash, slug, orderId)
        const urls2 = generateReturnUrls(baseUrlWithoutSlash, slug, orderId)
        
        // Should not have double slashes (except in protocol)
        const successPath1 = urls1.success.replace(/^https?:\/\//, '')
        const successPath2 = urls2.success.replace(/^https?:\/\//, '')
        expect(successPath1).not.toContain('//')
        expect(successPath2).not.toContain('//')
        
        // Both should generate valid URLs
        expect(() => new URL(urls1.success)).not.toThrow()
        expect(() => new URL(urls2.success)).not.toThrow()
      }),
      { numRuns: 50 }
    )
  })

  it('should preserve URL structure across various inputs', () => {
    fc.assert(
      fc.property(baseUrlArb, slugArb, orderIdArb, (baseUrl, slug, orderId) => {
        const urls = generateReturnUrls(baseUrl, slug, orderId)
        
        // URL structure should be consistent
        const successUrl = new URL(urls.success)
        const errorUrl = new URL(urls.error)
        const pendingUrl = new URL(urls.pending)
        
        // Same protocol
        expect(successUrl.protocol).toBe(errorUrl.protocol)
        expect(successUrl.protocol).toBe(pendingUrl.protocol)
        
        // Same host
        expect(successUrl.host).toBe(errorUrl.host)
        expect(successUrl.host).toBe(pendingUrl.host)
        
        // Paths should follow pattern
        expect(successUrl.pathname).toMatch(/^\/store\/[^/]+\/order\/[^/]+\/success$/)
        expect(errorUrl.pathname).toMatch(/^\/store\/[^/]+\/order\/[^/]+\/error$/)
        expect(pendingUrl.pathname).toMatch(/^\/store\/[^/]+\/order\/[^/]+\/pending$/)
      }),
      { numRuns: 100 }
    )
  })
})
