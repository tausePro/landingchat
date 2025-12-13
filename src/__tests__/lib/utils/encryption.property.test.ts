/**
 * Property-based tests for encryption utilities
 * **Feature: testing-sprint, Property 6-9: Encryption correctness properties**
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as fc from 'fast-check'
import { encrypt, decrypt, isEncrypted } from '@/lib/utils/encryption'

describe('Encryption Utilities - Property Tests', () => {
  const originalEncryptionKey = process.env.ENCRYPTION_KEY

  beforeAll(() => {
    // Set a test encryption key
    process.env.ENCRYPTION_KEY = 'test-encryption-key-for-testing-purposes'
  })

  afterAll(() => {
    // Restore original encryption key
    if (originalEncryptionKey) {
      process.env.ENCRYPTION_KEY = originalEncryptionKey
    } else {
      delete process.env.ENCRYPTION_KEY
    }
  })

  describe('Property 6: Round-trip consistency', () => {
    it('should return original value after encrypt then decrypt', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 20 }),
          (originalText) => {
            // **Feature: testing-sprint, Property 6: Round-trip consistency**
            // **Validates: Requirements 2.1**
            const encrypted = encrypt(originalText)
            const decrypted = decrypt(encrypted)
            expect(decrypted).toBe(originalText)
          }
        ),
        { numRuns: 5 }
      )
    })
  })

  describe('Property 7: Wrong key error handling', () => {
    it('should throw error when decrypting with wrong key', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 10, maxLength: 20 }),
          (originalText, wrongKey) => {
            // **Feature: testing-sprint, Property 7: Wrong key error handling**
            // **Validates: Requirements 2.2**
            
            // Encrypt with original key
            const encrypted = encrypt(originalText)
            
            // Change to wrong key
            const originalKey = process.env.ENCRYPTION_KEY
            process.env.ENCRYPTION_KEY = wrongKey
            
            try {
              // Should throw error with wrong key
              expect(() => decrypt(encrypted)).toThrow()
            } finally {
              // Restore original key
              process.env.ENCRYPTION_KEY = originalKey
            }
          }
        ),
        { numRuns: 3 }
      )
    })
  })

  describe('Property 8: Corrupted data error handling', () => {
    it('should throw error for malformed encrypted format', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(''), // Empty string
            fc.constant('single-part'), // Single part
            fc.constant('two:parts') // Two parts
          ),
          (malformedData) => {
            // Should throw error for malformed data
            expect(() => decrypt(malformedData)).toThrow()
          }
        ),
        { numRuns: 3 }
      )
    })
  })

  describe('Property 9: Encryption detection accuracy', () => {
    it('should correctly identify encrypted vs plain text', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }),
          (originalText) => {
            // **Feature: testing-sprint, Property 9: Encryption detection accuracy**
            // **Validates: Requirements 2.5, 2.6**
            
            // Plain text should not be detected as encrypted
            expect(isEncrypted(originalText)).toBe(false)
            
            // Encrypted text should be detected as encrypted
            const encrypted = encrypt(originalText)
            expect(isEncrypted(encrypted)).toBe(true)
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should handle empty string correctly', () => {
      // Empty string should not be detected as encrypted
      expect(isEncrypted('')).toBe(false)
    })
  })

  describe('Error handling without environment key', () => {
    it('should throw error when ENCRYPTION_KEY is not set', () => {
      const originalKey = process.env.ENCRYPTION_KEY
      delete process.env.ENCRYPTION_KEY
      
      try {
        expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY no está configurada en las variables de entorno')
        expect(() => decrypt('a:b:c')).toThrow('ENCRYPTION_KEY no está configurada en las variables de entorno')
      } finally {
        process.env.ENCRYPTION_KEY = originalKey
      }
    })
  })
})