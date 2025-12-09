# Implementation Plan: E-Commerce Checkout & Order Management Flow

## Overview

This implementation plan breaks down the e-commerce checkout flow into discrete, testable tasks. Each task builds incrementally on previous work, with tests integrated throughout to ensure correctness.

---

## Phase 1: Database Schema & Core Models

- [x] 1. Update database schema for orders and transactions
  - Add `order_number` column to orders table with unique constraint
  - Add `payment_status` column to orders table
  - Add `invoice_data` JSONB column to orders table for future electronic invoicing
  - Ensure `store_transactions` table exists with all required columns
  - Update customers table to include tax fields (document_type, document_number, person_type, business_name)
  - Create indexes for performance (organization_id, status, created_at)
  - Add RLS policies for orders table
  - _Requirements: 2.6, 9.1, 9.2, 10.5, 10.6_

- [ ]* 1.1 Write unit tests for order schema validation
  - Test order creation with all required fields
  - Test order creation fails without required fields
  - Test order_number uniqueness constraint
  - _Requirements: 2.6_

---

## Phase 2: Payment Service Integration

- [x] 2. Create payment service module
  - Create `src/lib/payments/payment-service.ts`
  - Implement `PaymentService` class with `initiatePayment()` method
  - Implement `initiateWompiPayment()` private method
  - Implement `initiateEpaycoPayment()` private method
  - Handle gateway configuration retrieval from database
  - Generate proper return URLs for success/error/pending
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ]* 2.1 Write property test for payment URL generation
  - **Property 9: Payment URL Generation**
  - **Validates: Requirements 3.3, 3.6**
  - Test that generated URLs include correct return paths
  - Test with various order amounts and currencies

- [ ]* 2.2 Write unit tests for gateway selection logic
  - Test Wompi gateway selection when configured
  - Test ePayco gateway selection when configured
  - Test error when no gateway configured
  - _Requirements: 3.7_

---

## Phase 3: Enhanced Order Creation

- [x] 3. Update createOrder server action
  - Modify `src/app/chat/actions.ts`
  - Generate unique order_number (e.g., "ORD-20241209-001")
  - Validate and store tax information (document_type, document_number, person_type)
  - Store tax information in both customer_info (order) and customers table
  - After creating order, call PaymentService if payment_method is not "manual"
  - Return `{ success, order, paymentUrl }` to client
  - Handle errors gracefully and return user-friendly messages
  - _Requirements: 2.5, 2.6, 3.1, 3.4, 10.1, 10.2, 10.3, 10.5, 10.6_

- [ ]* 3.1 Write property test for order creation atomicity
  - **Property 2: Order Creation Atomicity**
  - **Validates: Requirements 2.5, 2.6**
  - Test that successful order creation always results in database record
  - Test that failed order creation does not leave partial data

- [ ]* 3.2 Write unit tests for order number generation
  - Test uniqueness of generated order numbers
  - Test format matches expected pattern
  - _Requirements: 2.6_

- [ ]* 3.3 Write property test for tax information completeness
  - **Property 11: Tax Information Completeness**
  - **Validates: Requirements 10.1, 10.2, 10.3, 10.5**
  - Test that all orders have required tax fields
  - Test with various document types and person types

---

## Phase 4: Checkout UI Enhancement

- [x] 4. Update checkout modal component
  - Modify `src/app/chat/components/checkout-modal.tsx`
  - Add tax information fields (document_type dropdown, document_number input, person_type radio)
  - Add conditional business_name field when person_type is "Jurídica"
  - Add client-side validation for tax fields
  - Add loading state during order creation
  - Handle `paymentUrl` in response and redirect user
  - Add error handling with user-friendly messages
  - Show different success flow for manual vs gateway payments
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.7, 10.1, 10.2, 10.3, 10.4, 11.6, 11.7_

- [ ]* 4.1 Write integration test for checkout flow
  - Test complete flow: fill form → submit → order created
  - Test validation errors display correctly
  - Test loading states appear during submission
  - _Requirements: 2.1, 2.2, 2.3_

---

## Phase 5: Webhook Enhancement

- [x] 5. Enhance Wompi webhook handler
  - Modify `src/app/api/webhooks/payments/wompi/route.ts`
  - Implement webhook signature validation
  - Check for existing transaction (idempotency)
  - Create/update transaction record in store_transactions
  - Update order status to "confirmed" when payment approved
  - Set order.payment_status to "paid"
  - Set order.confirmed_at timestamp
  - Trigger notification to organization owner
  - Log all webhook events to webhook_logs
  - _Requirements: 4.1, 4.3, 4.4, 4.6, 4.7, 9.1, 9.2, 9.3_

- [ ]* 5.1 Write property test for webhook idempotency
  - **Property 4: Webhook Idempotency**
  - **Validates: Requirements 4.7**
  - Test that duplicate webhooks don't create duplicate transactions
  - Test with same provider_transaction_id sent multiple times

- [ ]* 5.2 Write property test for webhook signature validation
  - **Property 10: Webhook Signature Validation**
  - **Validates: Requirements 4.6, 10.2**
  - Test that valid signatures are accepted
  - Test that invalid signatures are rejected
  - Test with various payload combinations

- [ ]* 5.3 Write unit tests for webhook processing
  - Test approved payment updates order correctly
  - Test declined payment updates order to cancelled
  - Test transaction record creation
  - _Requirements: 4.1, 4.3, 4.5_

- [x] 6. Enhance ePayco webhook handler
  - Modify `src/app/api/webhooks/payments/epayco/route.ts`
  - Implement same enhancements as Wompi webhook
  - Handle ePayco-specific response codes
  - _Requirements: 4.2, 4.3, 4.4, 4.6, 4.7_

- [ ]* 6.1 Write unit tests for ePayco webhook
  - Test ePayco status code mapping
  - Test signature validation with ePayco format
  - _Requirements: 4.2, 4.6_

---

## Phase 6: Order Confirmation Pages

- [ ] 7. Create order success page
  - Create `src/app/store/[slug]/order/[orderId]/success/page.tsx`
  - Fetch order details by ID
  - Display order number, items, total, customer info
  - Show success message and next steps
  - Add "Return to Store" button
  - _Requirements: 5.1, 5.2, 5.7_

- [ ] 8. Create order error page
  - Create `src/app/store/[slug]/order/[orderId]/error/page.tsx`
  - Fetch order details by ID
  - Display error message and reason
  - Add "Retry Payment" button that regenerates payment link
  - Add "Return to Store" button
  - _Requirements: 5.3, 5.4, 5.7_

- [ ] 9. Create order pending page
  - Create `src/app/store/[slug]/order/[orderId]/pending/page.tsx`
  - Fetch order details by ID
  - Display pending message with instructions
  - Add "Check Status" button that refreshes order status
  - Add "Return to Store" button
  - _Requirements: 5.5, 5.6, 5.7_

- [ ]* 9.1 Write integration tests for confirmation pages
  - Test success page displays correct order data
  - Test error page shows error message
  - Test pending page shows instructions
  - Test invalid order ID shows 404
  - _Requirements: 5.1, 5.3, 5.5, 10.5_

---

## Phase 7: Customer Order Tracking

- [ ] 10. Create customer order tracking page
  - Create `src/app/store/[slug]/order/[orderId]/page.tsx`
  - Fetch order by ID and verify it belongs to the organization
  - Display order status timeline with visual indicators
  - Show order details (items, total, shipping info)
  - Display status-specific messages
  - Handle invalid order IDs with 404 page
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

- [ ] 10.1 Create order tracking server action
  - Create `src/app/store/[slug]/order/actions.ts`
  - Implement `getOrderForCustomer(orderId, slug)` function
  - Verify order belongs to organization
  - Return order with status and timeline data
  - _Requirements: 7.1_

- [ ]* 10.2 Write property test for customer order access
  - **Property 8: Customer Order Access**
  - **Validates: Requirements 7.1**
  - Test that orders are only accessible for correct organization
  - Test that invalid organization returns null

- [ ]* 10.3 Write unit tests for order tracking
  - Test order status display for each status
  - Test timeline rendering
  - Test 404 for invalid order ID
  - _Requirements: 7.3, 7.4, 7.5, 7.6, 7.7_

---

## Phase 8: Organization Dashboard - Orders List

- [ ] 11. Create orders list page
  - Create `src/app/dashboard/orders/page.tsx`
  - Display table of all orders for organization
  - Show order number, customer name, total, status, date
  - Implement status filter dropdown
  - Implement search by order number or customer name
  - Add pagination (20 orders per page)
  - _Requirements: 6.1, 6.2, 6.7_

- [ ] 11.1 Create orders list server actions
  - Create `src/app/dashboard/orders/actions.ts`
  - Implement `getOrders(filters)` function
  - Support filtering by status
  - Support search by order number or customer
  - Support pagination
  - _Requirements: 6.1, 6.7_

- [ ]* 11.2 Write unit tests for orders list
  - Test filtering by status works correctly
  - Test search functionality
  - Test pagination
  - _Requirements: 6.7_

---

## Phase 9: Organization Dashboard - Order Detail & Management

- [ ] 12. Create order detail page
  - Create `src/app/dashboard/orders/[id]/page.tsx`
  - Display full order details (items, customer, payment, shipping)
  - Show order status with timeline
  - Add status update dropdown
  - Add notes/comments section
  - Display linked transaction records
  - _Requirements: 6.3, 6.4_

- [ ] 12.1 Create order management server actions
  - Add `getOrderById(orderId)` to actions.ts
  - Add `updateOrderStatus(orderId, status, notes)` to actions.ts
  - Validate status transitions
  - Trigger notifications on status change
  - Update timestamps (confirmed_at, shipped_at, delivered_at)
  - _Requirements: 6.3, 6.4, 6.5, 6.6_

- [ ]* 12.2 Write property test for order status transitions
  - **Property 5: Order Status Transition Validity**
  - **Validates: Requirements 6.4**
  - Test valid transitions are allowed
  - Test invalid transitions are rejected
  - Test with all possible status combinations

- [ ]* 12.3 Write unit tests for order management
  - Test order detail retrieval
  - Test status update with valid transition
  - Test status update with invalid transition fails
  - Test timestamps are updated correctly
  - _Requirements: 6.3, 6.4_

---

## Phase 10: Notifications Integration

- [ ] 13. Integrate sale notifications
  - Ensure `sendSaleNotification()` is called from webhooks
  - Pass correct order data (id, total, customer, items)
  - Handle notification failures gracefully (log but don't block)
  - Respect `notify_on_sale` setting
  - _Requirements: 4.4, 8.1, 8.2, 8.3, 8.4_

- [ ] 13.1 Add order status change notifications
  - Create `sendOrderStatusNotification()` in notifications service
  - Call when order status changes to "confirmed", "shipped", "delivered"
  - Include order number and new status in message
  - _Requirements: 6.5, 6.6_

- [ ]* 13.2 Write property test for notification triggering
  - **Property 6: Notification Trigger on Payment Confirmation**
  - **Validates: Requirements 4.4, 8.1, 8.2**
  - Test that confirmed orders trigger notifications
  - Test that disabled notifications are not sent
  - Test with various order configurations

- [ ]* 13.3 Write unit tests for notifications
  - Test notification sent on payment confirmation
  - Test notification sent on status change
  - Test notification respects settings
  - Test notification failure doesn't block order processing
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

---

## Phase 11: Error Handling & Resilience

- [ ] 14. Implement comprehensive error handling
  - Add try-catch blocks in all server actions
  - Log errors to console and database where appropriate
  - Return user-friendly error messages
  - Implement webhook error logging to webhook_logs
  - Add 404 page for invalid orders
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ]* 14.1 Write unit tests for error scenarios
  - Test payment gateway unavailable
  - Test invalid webhook signature
  - Test order creation failure
  - Test webhook processing failure
  - Test invalid order access
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

---

## Phase 12: End-to-End Testing

- [ ] 15. Write E2E test for complete purchase flow (Wompi)
  - Add product to cart
  - Open checkout modal
  - Fill customer information
  - Select Wompi payment method
  - Confirm order
  - Verify redirect to Wompi (mock in test)
  - Simulate webhook callback
  - Verify order status updated to "confirmed"
  - Verify notification sent
  - Verify customer can access order tracking page
  - _Requirements: All_

- [ ] 16. Write E2E test for complete purchase flow (ePayco)
  - Same flow as above but with ePayco
  - _Requirements: All_

- [ ] 17. Write E2E test for manual payment flow
  - Add product to cart
  - Complete checkout with manual payment
  - Verify success message shown
  - Verify order created with "pending" status
  - _Requirements: 2.7_

- [ ] 18. Write E2E test for payment failure flow
  - Complete checkout
  - Simulate declined payment webhook
  - Verify redirect to error page
  - Verify order status is "cancelled"
  - Verify retry button works
  - _Requirements: 4.5, 5.3, 5.4_

- [ ] 19. Write E2E test for order management flow
  - Organization owner logs in
  - Views orders list
  - Filters by status
  - Opens order detail
  - Updates order status to "shipped"
  - Verifies customer sees updated status on tracking page
  - Verifies notification sent
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 7.1, 7.5_

---

## Phase 13: Final Integration & Polish

- [ ] 20. Integration checkpoint
  - Ensure all tests pass
  - Verify all features work together
  - Test with real Wompi sandbox credentials
  - Test with real ePayco sandbox credentials
  - Verify webhooks are received correctly
  - Verify notifications are sent
  - Ask user if questions arise

- [ ] 21. Performance optimization
  - Add database indexes if missing
  - Implement order list pagination
  - Cache payment gateway configs
  - Optimize webhook processing speed
  - _Design: Performance Considerations_

- [ ] 22. Security audit
  - Verify webhook signature validation
  - Verify RLS policies on orders table
  - Verify order access control
  - Test CSRF protection
  - Review error messages for information leakage
  - _Design: Security Considerations_

- [ ] 23. Documentation and deployment prep
  - Document webhook URLs for Wompi/ePayco configuration
  - Document environment variables needed
  - Create deployment checklist
  - Update README with testing instructions
  - _Design: Deployment Considerations_

---

## Testing Summary

### Unit Tests (Phase-specific)
- Order schema validation (1.1)
- Gateway selection logic (2.2)
- Order number generation (3.2)
- Webhook processing (5.3, 6.1)
- Order tracking (10.3)
- Orders list filtering (11.2)
- Order management (12.3)
- Notifications (13.3)
- Error scenarios (14.1)

### Property-Based Tests
- Property 1: Cart total consistency (existing in cart-store)
- Property 2: Order creation atomicity (3.1)
- Property 4: Webhook idempotency (5.1)
- Property 5: Order status transitions (12.2)
- Property 6: Notification triggering (13.2)
- Property 8: Customer order access (10.2)
- Property 9: Payment URL generation (2.1)
- Property 10: Webhook signature validation (5.2)
- Property 11: Tax information completeness (3.3)

### Integration Tests
- Checkout flow (4.1)
- Confirmation pages (9.1)

### End-to-End Tests
- Complete purchase flow - Wompi (15)
- Complete purchase flow - ePayco (16)
- Manual payment flow (17)
- Payment failure flow (18)
- Order management flow (19)

---

## Completion Criteria

All tasks must be completed and all tests must pass before considering this feature complete. The system should handle the complete customer journey from cart to order tracking, with proper error handling, notifications, and organization owner management capabilities.
