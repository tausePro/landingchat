# Implementation Plan

- [x] 1. Set up types infrastructure
  - [x] 1.1 Create `src/types/common.ts` with ActionResult and pagination types
    - Define `ActionResult<T>` type union
    - Define `PaginatedResult<T>` and `PaginationParams` types
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 1.2 Create `src/types/index.ts` to re-export all types
    - _Requirements: 3.1, 3.2_

- [x] 2. Create domain type files with Zod schemas
  - [x] 2.1 Create `src/types/product.ts` with Product schemas
    - Define `createProductSchema` and `updateProductSchema` with Zod
    - Export inferred types `CreateProductInput`, `UpdateProductInput`
    - Move `ProductData` interface from actions file
    - _Requirements: 1.1, 3.3, 3.4_
  - [x] 2.2 Write property test for product schema validation
    - **Property 2: Invalid input returns structured error**
    - **Validates: Requirements 1.2**
  - [x] 2.3 Create `src/types/customer.ts` with Customer schemas
    - Define `createCustomerSchema` with Zod
    - Move `Customer` interface from actions file
    - _Requirements: 1.1, 3.3, 3.4_
  - [x] 2.4 Write property test for customer schema validation
    - **Property 2: Invalid input returns structured error**
    - **Validates: Requirements 1.2**
  - [x] 2.5 Create `src/types/order.ts` with Order types
    - Move `Order` interface from actions file
    - Define order-related schemas
    - _Requirements: 3.3_
  - [x] 2.6 Create `src/types/organization.ts` with Organization schemas
    - Define `organizationDetailsSchema` for onboarding
    - _Requirements: 1.1, 3.3, 3.4_

- [x] 3. Refactor products actions
  - [x] 3.1 Update `src/app/dashboard/products/actions.ts`
    - Import types from `@/types/product`
    - Add Zod validation to `createProduct`
    - Change return type to `ActionResult<T>`
    - Wrap operations in try-catch, never throw
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4_
  - [x] 3.2 Write property test for createProduct action
    - **Property 5: No exceptions propagate**
    - **Validates: Requirements 2.4**
  - [x] 3.3 Refactor `updateProduct` and `deleteProduct` actions
    - Add validation and ActionResult return type
    - _Requirements: 1.1, 2.1, 2.4_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Refactor customers actions
  - [x] 5.1 Update `src/app/dashboard/customers/actions.ts`
    - Import types from `@/types/customer`
    - Add Zod validation to all mutation actions
    - Change return types to `ActionResult<T>`
    - Remove all `throw` statements, use try-catch
    - _Requirements: 1.1, 2.1, 2.4_
  - [x] 5.2 Write property test for customer actions
    - **Property 3: Success returns data wrapper**
    - **Property 4: Failure returns error wrapper**
    - **Validates: Requirements 2.2, 2.3**

- [x] 6. Refactor onboarding actions
  - [x] 6.1 Update `src/app/onboarding/actions.ts`
    - Import types from `@/types/organization`
    - Add Zod validation to `updateOrganizationDetails`
    - Change return types to `ActionResult<T>`
    - Handle redirect differently (return success, let client redirect)
    - _Requirements: 1.1, 2.1, 2.4_

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Actualizar comentarios del código
  - [x] 8.1 Actualizar comentarios en `src/lib/supabase/server.ts`
    - Mantener comentarios en español, mejorar claridad donde sea necesario
    - _Requirements: 4.1, 4.2_
  - [x] 8.2 Actualizar comentarios en `src/middleware.ts`
    - Mantener comentarios en español, mejorar claridad donde sea necesario
    - _Requirements: 4.1, 4.2_

- [x] 9. Organize SQL files
  - [x] 9.1 Move root SQL files to migrations folder
    - Move all `.sql` files from project root to `migrations/`
    - Rename with date prefix if missing (use 20241201 for existing files)
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 10. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

