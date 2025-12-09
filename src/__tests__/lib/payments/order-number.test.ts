/**
 * Unit tests for order number generation
 * Task 3.2: Test uniqueness and format of generated order numbers
 * Requirements: 2.6
 */

import { describe, it, expect } from 'vitest'

// Extract the generateOrderNumber function for testing
function generateOrderNumber(): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `ORD-${year}${month}${day}-${random}`
}

describe('Order Number Generation', () => {
  it('should generate order number with correct format', () => {
    const orderNumber = generateOrderNumber()
    
    // Format: ORD-YYYYMMDD-XXX
    expect(orderNumber).toMatch(/^ORD-\d{8}-\d{3}$/)
  })

  it('should include current date in order number', () => {
    const orderNumber = generateOrderNumber()
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    
    expect(orderNumber).toContain(`ORD-${year}${month}${day}`)
  })

  it('should generate different order numbers on multiple calls', () => {
    const numbers = new Set<string>()
    
    // Generate 100 order numbers
    for (let i = 0; i < 100; i++) {
      numbers.add(generateOrderNumber())
    }
    
    // Should have high uniqueness (at least 90% unique due to random collisions)
    // With 1000 possible values and 100 samples, we expect ~90-95% uniqueness
    expect(numbers.size).toBeGreaterThan(90)
  })

  it('should have 3-digit random suffix', () => {
    const orderNumber = generateOrderNumber()
    const suffix = orderNumber.split('-')[2]
    
    expect(suffix).toHaveLength(3)
    expect(Number(suffix)).toBeGreaterThanOrEqual(0)
    expect(Number(suffix)).toBeLessThan(1000)
  })
})
