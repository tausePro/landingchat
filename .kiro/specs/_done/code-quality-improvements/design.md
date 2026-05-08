# Design Document: Code Quality Improvements

## Overview

This design establishes standardized patterns for validation, error handling, and code organization across the LandingChat codebase. The goal is to create consistent, maintainable code that reduces bugs and improves developer experience.

## Architecture

### Current State
- Server actions use inconsistent error handling (some throw, some return objects)
- Types are defined inline in action files, leading to duplication
- No input validation with Zod despite it being installed
- Mixed language comments (Spanish/English)
- SQL files scattered in project root

### Target State
- All server actions use Zod validation and return `ActionResult<T>`
- Shared types centralized in `src/types/`
- English comments throughout codebase
- SQL files organized in `migrations/`

```
src/
├── types/
│   ├── index.ts          # Re-exports all types
│   ├── common.ts         # ActionResult, pagination types
│   ├── product.ts        # Product schemas and types
│   ├── customer.ts       # Customer schemas and types
│   ├── order.ts          # Order schemas and types
│   └── organization.ts   # Organization schemas and types
├── lib/
│   └── actions/
│       └── utils.ts      # Action helper utilities
```

## Components and Interfaces

### ActionResult Type

```typescript
// src/types/common.ts
export type ActionResult<T = void> = 
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> }
```

### Zod Schema Pattern

```typescript
// src/types/product.ts
import { z } from "zod"

export const createProductSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().optional(),
  price: z.number().positive("Price must be positive"),
  stock: z.number().int().min(0).default(0),
  // ... other fields
})

export type CreateProductInput = z.infer<typeof createProductSchema>
```

### Server Action Pattern

```typescript
// src/app/dashboard/products/actions.ts
"use server"

import { createProductSchema, type CreateProductInput } from "@/types/product"
import type { ActionResult } from "@/types/common"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function createProduct(
  input: CreateProductInput
): Promise<ActionResult<{ id: string }>> {
  // 1. Validate input
  const parsed = createProductSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors
    }
  }

  // 2. Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: "Unauthorized" }
  }

  // 3. Get org context
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single()

  if (!profile?.organization_id) {
    return { success: false, error: "No organization found" }
  }

  // 4. Execute operation (wrapped in try-catch)
  try {
    const { data, error } = await supabase
      .from("products")
      .insert({ ...parsed.data, organization_id: profile.organization_id })
      .select("id")
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath("/dashboard/products")
    return { success: true, data: { id: data.id } }
  } catch (err) {
    return { 
      success: false, 
      error: err instanceof Error ? err.message : "Unknown error" 
    }
  }
}
```

## Data Models

### Type Files Structure

| File | Contents |
|------|----------|
| `common.ts` | `ActionResult<T>`, `PaginatedResult<T>`, `PaginationParams` |
| `product.ts` | `Product`, `CreateProductInput`, `UpdateProductInput`, schemas |
| `customer.ts` | `Customer`, `CreateCustomerInput`, schemas |
| `order.ts` | `Order`, `OrderItem`, `OrderStatus` |
| `organization.ts` | `Organization`, `OrganizationSettings` |
| `agent.ts` | `Agent`, `AgentConfig`, `AgentType` |

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Based on the prework analysis, the following testable properties were identified:

### Property 1: Validation occurs before processing
*For any* server action that accepts input and *for any* input data, the Zod schema validation SHALL be invoked before any database operation occurs.
**Validates: Requirements 1.1**

### Property 2: Invalid input returns structured error
*For any* server action and *for any* input that fails Zod validation, the return value SHALL have shape `{ success: false, error: string, fieldErrors: Record<string, string[]> }` where fieldErrors contains the validation errors.
**Validates: Requirements 1.2**

### Property 3: Success returns data wrapper
*For any* server action that completes successfully, the return value SHALL have shape `{ success: true, data: T }` where T matches the expected return type.
**Validates: Requirements 2.2**

### Property 4: Failure returns error wrapper
*For any* server action that fails (validation, auth, database, or other error), the return value SHALL have shape `{ success: false, error: string }` with optional `fieldErrors`.
**Validates: Requirements 2.3**

### Property 5: No exceptions propagate
*For any* server action and *for any* input (valid or invalid), calling the action SHALL NOT throw an exception; all errors SHALL be caught and returned as `ActionResult`.
**Validates: Requirements 2.4**

## Error Handling

### Error Categories

1. **Validation Errors**: Return with `fieldErrors` containing per-field messages
2. **Auth Errors**: Return `{ success: false, error: "Unauthorized" }`
3. **Not Found Errors**: Return `{ success: false, error: "Resource not found" }`
4. **Database Errors**: Return `{ success: false, error: <db_error_message> }`
5. **Unknown Errors**: Catch-all with generic message

### Error Response Examples

```typescript
// Validation error
{
  success: false,
  error: "Validation failed",
  fieldErrors: {
    name: ["Name is required"],
    price: ["Price must be positive"]
  }
}

// Auth error
{
  success: false,
  error: "Unauthorized"
}

// Database error
{
  success: false,
  error: "duplicate key value violates unique constraint"
}
```

## Testing Strategy

### Property-Based Testing

We will use **fast-check** as the property-based testing library for TypeScript/JavaScript.

Each property test will:
1. Generate random inputs using fast-check arbitraries
2. Call the server action
3. Assert the response matches the expected shape
4. Run minimum 100 iterations per property

### Test File Organization

```
src/
├── __tests__/
│   └── actions/
│       ├── product.property.test.ts
│       ├── customer.property.test.ts
│       └── common.test.ts
```

### Property Test Example

```typescript
// src/__tests__/actions/product.property.test.ts
import * as fc from "fast-check"
import { createProduct } from "@/app/dashboard/products/actions"

describe("createProduct", () => {
  // **Feature: code-quality-improvements, Property 2: Invalid input returns structured error**
  it("returns fieldErrors for invalid input", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: fc.constant(""), // Invalid: empty name
          price: fc.integer({ max: -1 }), // Invalid: negative price
        }),
        async (input) => {
          const result = await createProduct(input as any)
          expect(result.success).toBe(false)
          if (!result.success) {
            expect(result.fieldErrors).toBeDefined()
            expect(typeof result.error).toBe("string")
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  // **Feature: code-quality-improvements, Property 5: No exceptions propagate**
  it("never throws exceptions", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.anything(),
        async (input) => {
          // Should not throw, regardless of input
          const result = await createProduct(input as any)
          expect(result).toHaveProperty("success")
        }
      ),
      { numRuns: 100 }
    )
  })
})
```

### Unit Tests

Unit tests will cover:
- Specific edge cases (empty strings, null values, boundary numbers)
- Integration with Supabase (mocked)
- Specific business logic scenarios

