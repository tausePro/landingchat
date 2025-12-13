# Testing Sprint - Critical Coverage

## Introduction

Increase test coverage on critical paths from 4% to >70% before production deployment. The current codebase has only 10 test files for 249 source files, leaving critical areas like payment webhooks, encryption utilities, and middleware routing completely untested.

## Glossary

- **System**: The LandingChat application
- **Payment_Webhook**: Server endpoint that processes payment notifications from external gateways
- **Encryption_Utility**: Functions that encrypt/decrypt sensitive data like payment credentials
- **Middleware_Router**: Next.js middleware that handles subdomain routing and authentication
- **Property_Test**: Test that verifies universal properties across many generated inputs
- **Coverage_Report**: Analysis showing percentage of code executed by tests

## Requirements

### Requirement 1: Payment Webhook Tests

**User Story:** As a developer, I want payment webhooks thoroughly tested so that we don't lose money due to bugs.

#### Acceptance Criteria

1. WHEN a valid Wompi signature is received THEN the System SHALL process the payment
2. WHEN an invalid signature is received THEN the System SHALL return 401 and NOT process payment
3. WHEN a duplicate event is received THEN the System SHALL be idempotent (no duplicate orders)
4. WHEN transaction status is APPROVED THEN the System SHALL update order status to 'paid'
5. WHEN transaction status is DECLINED THEN the System SHALL NOT change order status
6. WHEN organization has no payment credentials THEN the System SHALL handle error gracefully

### Requirement 2: Encryption Utility Tests

**User Story:** As a developer, I want encryption utilities tested so that credentials are never exposed.

#### Acceptance Criteria

1. WHEN encrypt() then decrypt() is called THEN the System SHALL return original value
2. WHEN decrypt() is called with wrong key THEN the System SHALL throw error
3. WHEN decrypt() is called with corrupted data THEN the System SHALL throw error
4. WHEN an error occurs THEN the System SHALL NOT leak plaintext in error messages
5. WHEN isEncrypted() is called on encrypted text THEN the System SHALL return true
6. WHEN isEncrypted() is called on plain text THEN the System SHALL return false

### Requirement 3: Middleware Routing Tests

**User Story:** As a developer, I want middleware routing tested so that stores always load correctly.

#### Acceptance Criteria

1. WHEN subdomain is `tez.landingchat.co` THEN the System SHALL rewrite to `/store/tez`
2. WHEN query param `?store=demo` is present THEN the System SHALL rewrite to `/store/demo`
3. WHEN path starts with `/dashboard` THEN the System SHALL NOT rewrite and check auth
4. WHEN path starts with `/api` THEN the System SHALL NOT rewrite
5. WHEN subdomain is reserved (www, api, admin) THEN the System SHALL NOT rewrite

### Requirement 4: Coverage Configuration

**User Story:** As a developer, I want coverage reporting so that I can track progress.

#### Acceptance Criteria

1. WHEN `npm test -- --coverage` is run THEN the System SHALL generate coverage report
2. THE coverage report SHALL include text and HTML formats
3. THE coverage SHALL track `src/lib/**` and `src/app/api/**`
4. THE coverage SHALL exclude test files and node_modules

### Requirement 5: Rate Limiting

**User Story:** As a developer, I want rate limiting on AI chat so that we don't get DDoS'd or run up API costs.

#### Acceptance Criteria

1. WHEN more than 10 requests/minute from same IP THEN the System SHALL return 429
2. WHEN rate limit is hit THEN the System SHALL include Retry-After header
3. THE rate limiting SHALL use sliding window algorithm
4. THE rate limiting SHALL be applied to `/api/ai-chat` endpoint

### Requirement 6: Security Headers

**User Story:** As a developer, I want security headers so that we pass security audits.

#### Acceptance Criteria

1. ALL responses SHALL include `X-Frame-Options: SAMEORIGIN`
2. ALL responses SHALL include `X-Content-Type-Options: nosniff`
3. ALL responses SHALL include `Referrer-Policy: strict-origin-when-cross-origin`
4. THE headers SHALL be configured in `next.config.js`