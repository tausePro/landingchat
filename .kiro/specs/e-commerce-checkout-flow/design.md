# Design Document: E-Commerce Checkout & Order Management Flow

## Overview

This design implements a complete e-commerce checkout flow for LandingChat, integrating with Wompi and ePayco payment gateways. The system handles the entire customer journey from adding products to cart, through payment processing, to order tracking. It also provides organization owners with a comprehensive order management dashboard.

The design follows a three-tier architecture:
1. **Client Layer**: React components with Zustand state management for cart
2. **API Layer**: Next.js Server Actions and API routes for business logic
3. **Integration Layer**: Payment gateway clients and webhook handlers

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT LAYER                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Storefront (Public)          Organization Dashboard        │
│  ├─ Product Pages             ├─ Orders List               │
│  ├─ Cart Drawer (Zustand)     ├─ Order Detail              │
│  ├─ Checkout Modal            └─ Status Management         │
│  └─ Order Tracking                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      API LAYER                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Server Actions              API Routes                     │
│  ├─ createOrder()            ├─ /api/webhooks/payments/    │
│  ├─ updateOrderStatus()      │   ├─ wompi/route.ts         │
│  ├─ getOrder()               │   └─ epayco/route.ts        │
│  └─ getOrders()              └─ /api/payments/init         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  INTEGRATION LAYER                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Payment Service             Notification Service           │
│  ├─ WompiGateway            ├─ WhatsApp (Evolution)        │
│  ├─ EpaycoGateway           └─ Email (Future)              │
│  └─ PaymentService                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    DATA LAYER                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Supabase PostgreSQL                                        │
│  ├─ orders                                                  │
│  ├─ store_transactions                                      │
│  ├─ customers                                               │
│  ├─ payment_gateway_configs                                 │
│  └─ webhook_logs                                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Cart Management (Client-Side)

**File**: `src/store/cart-store.ts`

Already implemented with Zustand. Provides:
- `addItem(product, quantity)`: Add product to cart
- `removeItem(productId)`: Remove product from cart
- `updateQuantity(productId, quantity)`: Update item quantity
- `clearCart()`: Empty the cart
- `total()`: Calculate cart total
- `toggleCart()`: Open/close cart drawer

### 2. Checkout Flow Components

**Files**:
- `src/app/chat/components/cart-drawer.tsx`: Cart UI (exists)
- `src/app/chat/components/checkout-modal.tsx`: Checkout UI (exists, needs enhancement)

**Enhancements Needed**:
- Add loading states during order creation
- Add error handling and display
- Integrate with payment service for gateway redirection

### 3. Payment Service

**File**: `src/lib/payments/payment-service.ts` (NEW)

```typescript
interface InitiatePaymentParams {
  orderId: string
  organizationId: string
  amount: number
  currency: string
  customerEmail: string
  customerName: string
  returnUrl: string
}

interface PaymentResponse {
  success: boolean
  paymentUrl?: string
  error?: string
}

class PaymentService {
  async initiatePayment(params: InitiatePaymentParams): Promise<PaymentResponse>
  private async initiateWompiPayment(config, params): Promise<string>
  private async initiateEpaycoPayment(config, params): Promise<string>
}
```

### 4. Order Management Actions

**File**: `src/app/dashboard/orders/actions.ts` (NEW)

```typescript
// Server Actions for order management
export async function getOrders(filters?: OrderFilters): Promise<Order[]>
export async function getOrderById(orderId: string): Promise<Order | null>
export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<Result>
export async function getOrderForCustomer(orderId: string, slug: string): Promise<Order | null>
```

### 5. Webhook Handlers

**Files**:
- `src/app/api/webhooks/payments/wompi/route.ts` (exists, needs enhancement)
- `src/app/api/webhooks/payments/epayco/route.ts` (exists, needs enhancement)

**Enhancements**:
- Validate webhook signatures
- Implement idempotency checks
- Create transaction records
- Trigger notifications
- Handle all payment statuses (approved, declined, pending, voided)

## Data Models

### Orders Table Schema

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  customer_id UUID REFERENCES customers(id),
  
  -- Order Details
  order_number TEXT UNIQUE, -- Human-readable order number
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
  
  -- Financial
  subtotal DECIMAL(10,2) NOT NULL,
  shipping_cost DECIMAL(10,2) DEFAULT 0,
  tax DECIMAL(10,2) DEFAULT 0,
  discount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'COP',
  
  -- Items (JSONB)
  items JSONB NOT NULL, -- Array of {product_id, name, quantity, price, total}
  
  -- Customer Info (embedded for historical record)
  customer_info JSONB NOT NULL, -- {name, email, phone, address, city, document_type, document_number, person_type, business_name?}
  
  -- Tax/Invoicing (for future electronic invoicing)
  invoice_data JSONB, -- {invoice_number, invoice_date, invoice_url, provider, status}
  
  -- Shipping
  shipping_address JSONB,
  tracking_number TEXT,
  
  -- Payment
  payment_method TEXT, -- 'wompi', 'epayco', 'manual'
  payment_status TEXT CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  
  -- Metadata
  notes TEXT,
  metadata JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);

CREATE INDEX idx_orders_organization ON orders(organization_id);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
```

### Store Transactions Table Schema

```sql
CREATE TABLE store_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  order_id UUID REFERENCES orders(id),
  
  -- Transaction Details
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'COP',
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'declined', 'voided', 'error')),
  
  -- Gateway Info
  provider TEXT NOT NULL CHECK (provider IN ('wompi', 'epayco', 'manual')),
  provider_transaction_id TEXT UNIQUE,
  provider_reference TEXT, -- Our reference sent to provider
  provider_response JSONB, -- Full webhook payload
  
  -- Payment Method
  payment_method TEXT, -- 'card', 'pse', 'nequi', etc.
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_transactions_order ON store_transactions(order_id);
CREATE INDEX idx_transactions_provider_id ON store_transactions(provider_transaction_id);
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Cart Total Consistency
*For any* cart state, the displayed total should equal the sum of (item.price × item.quantity) for all items in the cart.
**Validates: Requirements 1.4**

### Property 2: Order Creation Atomicity
*For any* checkout submission, if order creation succeeds, then a corresponding order record with status "pending" must exist in the database.
**Validates: Requirements 2.5, 2.6**

### Property 3: Payment Gateway Selection
*For any* order with payment_method set to "wompi" or "epayco", the system must have retrieved valid gateway configuration before generating a payment link.
**Validates: Requirements 3.1, 3.4, 3.7**

### Property 4: Webhook Idempotency
*For any* webhook with a provider_transaction_id that already exists in store_transactions, the system must not create a duplicate transaction record.
**Validates: Requirements 4.7**

### Property 5: Order Status Transition Validity
*For any* order status update, the new status must be a valid transition from the current status (e.g., "pending" → "confirmed" is valid, but "delivered" → "pending" is not).
**Validates: Requirements 6.4**

### Property 6: Notification Trigger on Payment Confirmation
*For any* order that transitions to "confirmed" status via webhook, if notify_on_sale is enabled, then a notification must be sent to the organization owner.
**Validates: Requirements 4.4, 8.1, 8.2**

### Property 7: Transaction-Order Linkage
*For any* transaction record created, it must reference a valid order_id that exists in the orders table.
**Validates: Requirements 9.2, 9.4**

### Property 8: Customer Order Access
*For any* customer accessing `/store/[slug]/order/[orderId]`, the system must verify that the order belongs to the specified organization before displaying details.
**Validates: Requirements 7.1**

### Property 9: Payment URL Generation
*For any* order requiring payment gateway integration, the generated payment URL must include the correct return URLs for success, error, and pending states.
**Validates: Requirements 3.3, 3.6, 5.1, 5.3, 5.5**

### Property 10: Webhook Signature Validation
*For any* incoming webhook request, if the gateway configuration includes a signature secret, the system must validate the signature before processing the webhook.
**Validates: Requirements 4.6, 11.2**

### Property 11: Tax Information Completeness
*For any* order created, the customer_info must include document_type, document_number, and person_type fields.
**Validates: Requirements 10.1, 10.2, 10.3, 10.5**

## Error Handling

### Client-Side Errors
- **Network Failures**: Display toast notification, allow retry
- **Validation Errors**: Show inline field errors
- **Payment Gateway Unavailable**: Show error modal with support contact

### Server-Side Errors
- **Database Errors**: Log error, return generic message to client
- **Gateway API Errors**: Log full error, return user-friendly message
- **Webhook Processing Errors**: Log to webhook_logs table, return 200 to prevent retries

### Error Recovery
- **Failed Payment**: Provide "Retry Payment" button on error page
- **Webhook Timeout**: Implement exponential backoff for gateway retries
- **Order Creation Failure**: Do not charge customer, log error for manual review

## Testing Strategy

### Unit Tests
- Cart store operations (add, remove, update, clear)
- Order validation logic
- Payment service gateway selection
- Webhook signature validation
- Order status transition validation

### Property-Based Tests
- **Property 1**: Cart total calculation across random item combinations
- **Property 6**: Notification triggering for all confirmed orders
- **Property 7**: Transaction-order linkage integrity
- **Property 10**: Webhook signature validation with various payloads

### Integration Tests
- Complete checkout flow (cart → checkout → order creation)
- Webhook processing (receive → validate → update order → notify)
- Order management (list → detail → update status)

### End-to-End Tests
1. **Happy Path**: Add to cart → Checkout → Pay (Wompi test mode) → Confirm → Track order
2. **Payment Failure**: Add to cart → Checkout → Pay → Decline → See error page
3. **Manual Payment**: Add to cart → Checkout → Select manual → See success
4. **Order Management**: Owner views orders → Updates status → Customer sees update
5. **Notification Flow**: Payment confirmed → Webhook received → Owner notified

### Test Data Requirements
- Test payment gateway credentials (Wompi/ePayco sandbox)
- Sample products with various prices
- Test customer information
- Mock webhook payloads for all payment statuses

## Security Considerations

1. **Webhook Validation**: Always validate signatures before processing
2. **Order Access Control**: Verify organization ownership before displaying orders
3. **Payment Data**: Never store full credit card numbers
4. **RLS Policies**: Ensure orders table has proper Row Level Security
5. **API Rate Limiting**: Implement rate limiting on checkout endpoints
6. **CSRF Protection**: Use Next.js built-in CSRF protection for forms

## Performance Considerations

1. **Cart Persistence**: Use local storage to avoid server calls
2. **Order List Pagination**: Implement cursor-based pagination for large order lists
3. **Webhook Processing**: Process asynchronously to return 200 quickly
4. **Database Indexes**: Index on organization_id, status, created_at for fast queries
5. **Caching**: Cache payment gateway configs to reduce database queries

## Deployment Considerations

1. **Environment Variables**: Ensure all gateway credentials are in production env
2. **Webhook URLs**: Configure correct webhook URLs in Wompi/ePayco dashboards
3. **Database Migrations**: Run migrations before deploying new code
4. **Rollback Plan**: Keep previous version deployable in case of issues
5. **Monitoring**: Set up alerts for webhook failures and payment errors
