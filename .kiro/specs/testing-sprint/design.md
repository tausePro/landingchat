# Testing Sprint - Design Document

## Overview

This design document outlines the implementation of comprehensive testing for critical system components. The goal is to increase test coverage from 4% to >70% by focusing on high-risk areas: payment webhooks, encryption utilities, middleware routing, rate limiting, and security headers.

## Architecture

The testing architecture follows a dual approach:
- **Property-based testing** using fast-check for universal properties
- **Unit testing** for specific examples and edge cases
- **Integration testing** for end-to-end workflows

## Components and Interfaces

### Test Infrastructure
- **Vitest** as the test runner with coverage reporting
- **fast-check** for property-based test generation
- **@vitest/coverage-v8** for code coverage analysis
- **Upstash Redis** for rate limiting tests

### Test Categories
1. **Payment Webhook Tests** - Critical for financial integrity
2. **Encryption Tests** - Critical for security
3. **Middleware Tests** - Critical for routing
4. **Rate Limiting Tests** - Important for API protection
5. **Security Header Tests** - Important for compliance

## Data Models

### Test Data Generators
- Payment webhook payloads with valid/invalid signatures
- Encrypted/decrypted string pairs
- HTTP request/response objects
- Subdomain and path combinations

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Payment Webhook Properties

**Property 1: Valid signature processing**
*For any* valid payment webhook payload with correct signature, the system should process the payment successfully
**Validates: Requirements 1.1**

**Property 2: Invalid signature rejection**
*For any* payment webhook payload with invalid signature, the system should return 401 and not process payment
**Validates: Requirements 1.2**

**Property 3: Idempotent duplicate handling**
*For any* payment webhook event sent multiple times, only one order should be created regardless of repetition count
**Validates: Requirements 1.3**

**Property 4: APPROVED status updates**
*For any* transaction with APPROVED status, the corresponding order status should be updated to 'paid'
**Validates: Requirements 1.4**

**Property 5: DECLINED status preservation**
*For any* transaction with DECLINED status, the order status should remain unchanged
**Validates: Requirements 1.5**

### Encryption Properties

**Property 6: Round-trip consistency**
*For any* string input, encrypting then decrypting should return the original value
**Validates: Requirements 2.1**

**Property 7: Wrong key error handling**
*For any* encrypted string and wrong decryption key, the decrypt function should throw an error
**Validates: Requirements 2.2**

**Property 8: Corrupted data error handling**
*For any* corrupted encrypted string, the decrypt function should throw an error without leaking plaintext
**Validates: Requirements 2.3, 2.4**

**Property 9: Encryption detection accuracy**
*For any* encrypted string, isEncrypted() should return true, and for any plain string, it should return false
**Validates: Requirements 2.5, 2.6**

### Middleware Properties

**Property 10: Query parameter rewriting**
*For any* valid store name in query parameter, the middleware should rewrite to `/store/{name}`
**Validates: Requirements 3.2**

**Property 11: Dashboard path preservation**
*For any* path starting with `/dashboard`, the middleware should not rewrite and should check authentication
**Validates: Requirements 3.3**

**Property 12: API path preservation**
*For any* path starting with `/api`, the middleware should not perform rewriting
**Validates: Requirements 3.4**

**Property 13: Reserved subdomain handling**
*For any* reserved subdomain (www, api, admin), the middleware should not perform rewriting
**Validates: Requirements 3.5**

### Rate Limiting Properties

**Property 14: Rate limit enforcement**
*For any* IP address making more than 10 requests per minute, the system should return 429 status
**Validates: Requirements 5.1**

**Property 15: Rate limit headers**
*For any* rate-limited request, the response should include Retry-After header
**Validates: Requirements 5.2**

**Property 16: Sliding window behavior**
*For any* sequence of requests within time windows, the rate limiting should follow sliding window algorithm
**Validates: Requirements 5.3**

### Security Header Properties

**Property 17: Universal security headers**
*For any* HTTP response, all required security headers should be present with correct values
**Validates: Requirements 6.1, 6.2, 6.3**

## Error Handling

- All test failures should provide clear error messages
- Property test failures should include the failing example
- Test setup/teardown should handle cleanup properly
- Database state should be isolated between tests

## Testing Strategy

### Property-Based Testing Framework
- **Library**: fast-check for TypeScript
- **Iterations**: Minimum 100 iterations per property
- **Generators**: Custom generators for domain-specific data
- **Shrinking**: Automatic reduction to minimal failing cases

### Unit Testing Approach
- **Examples**: Specific test cases for known edge cases
- **Integration**: End-to-end workflow testing
- **Mocking**: Minimal mocking, prefer real implementations

### Coverage Configuration
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/lib/**', 'src/app/api/**'],
      exclude: ['**/*.test.ts', '**/node_modules/**'],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70
        }
      }
    }
  }
})
```

### Test Organization
- Property tests: `src/__tests__/**/*.property.test.ts`
- Unit tests: `src/__tests__/**/*.test.ts`
- Integration tests: `src/__tests__/integration/**/*.test.ts`
- Test utilities: `src/__tests__/utils/`