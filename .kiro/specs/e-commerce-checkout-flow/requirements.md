# Requirements Document: E-Commerce Checkout & Order Management Flow

## Introduction

This specification defines the complete end-to-end e-commerce flow for LandingChat, enabling customers to purchase products through the storefront, process payments via integrated gateways (Wompi/ePayco), and track their orders. It also includes the organization owner's dashboard for order management and customer order tracking portal.

## Glossary

- **System**: LandingChat platform
- **Organization Owner**: Business owner who manages their store through the dashboard
- **Customer**: End user who purchases products from a storefront
- **Storefront**: Public-facing store accessible via subdomain or `/store/[slug]`
- **Cart**: Shopping cart managed client-side with Zustand
- **Checkout**: Multi-step process for collecting customer information and payment
- **Payment Gateway**: Third-party service (Wompi or ePayco) that processes payments
- **Order**: Record of a customer's purchase including items, total, and status
- **Transaction**: Payment record linked to an order with gateway details
- **Webhook**: HTTP callback from payment gateway to confirm payment status
- **Order Status**: Current state of an order (pending, confirmed, processing, shipped, delivered, cancelled)
- **Customer Portal**: Public page where customers can track their order status
- **Document Type**: Type of identification document (CC, NIT, CE, Passport)
- **Person Type**: Classification of customer as Natural (individual) or Jurídica (business entity)
- **Electronic Invoice**: Digital tax document issued for a transaction (future integration)

## Requirements

### Requirement 1: Shopping Cart Management

**User Story:** As a customer, I want to add products to my cart and manage quantities, so that I can prepare my purchase before checkout.

#### Acceptance Criteria

1. WHEN a customer clicks "Add to Cart" on a product THEN the System SHALL add the product to the cart with quantity 1
2. WHEN a customer adds a product already in the cart THEN the System SHALL increment the quantity by 1
3. WHEN a customer opens the cart drawer THEN the System SHALL display all cart items with name, image, price, and quantity
4. WHEN a customer updates item quantity THEN the System SHALL recalculate the cart total immediately
5. WHEN a customer removes an item THEN the System SHALL remove it from the cart and update the total
6. WHEN the cart is empty THEN the System SHALL display an empty state message
7. WHEN a customer closes the browser THEN the System SHALL persist the cart contents using local storage

### Requirement 2: Checkout Process

**User Story:** As a customer, I want to complete checkout by providing my information and selecting a payment method, so that I can finalize my purchase.

#### Acceptance Criteria

1. WHEN a customer clicks "Proceed to Checkout" THEN the System SHALL open a checkout modal with a contact information form
2. WHEN a customer submits contact information THEN the System SHALL validate all required fields (name, email, phone, address, city, document_type, document_number, person_type)
3. WHEN contact information is valid THEN the System SHALL proceed to the payment method selection step
4. WHEN a customer selects a payment method THEN the System SHALL display the order summary with subtotal, shipping, and total
5. WHEN a customer confirms the order THEN the System SHALL create an order record with status "pending"
6. WHEN an order is created THEN the System SHALL generate a unique order ID
7. WHEN the payment method is "manual" THEN the System SHALL display a success message locally without payment gateway integration

### Requirement 3: Payment Gateway Integration

**User Story:** As a customer, I want to pay securely through Wompi or ePayco, so that I can complete my purchase with my preferred payment method.

#### Acceptance Criteria

1. WHEN a customer selects Wompi as payment method THEN the System SHALL retrieve the organization's Wompi configuration
2. WHEN Wompi configuration exists THEN the System SHALL generate a payment link using Wompi API with order details
3. WHEN a payment link is generated THEN the System SHALL redirect the customer to the Wompi checkout page
4. WHEN a customer selects ePayco as payment method THEN the System SHALL retrieve the organization's ePayco configuration
5. WHEN ePayco configuration exists THEN the System SHALL generate a payment link using ePayco API with order details
6. WHEN a payment link is generated for ePayco THEN the System SHALL redirect the customer to the ePayco checkout page
7. WHEN payment gateway configuration is missing THEN the System SHALL display an error message and prevent checkout

### Requirement 4: Payment Confirmation via Webhooks

**User Story:** As the system, I need to receive payment confirmations from gateways, so that I can update order status and notify stakeholders.

#### Acceptance Criteria

1. WHEN Wompi sends a webhook with status "APPROVED" THEN the System SHALL update the order status to "confirmed"
2. WHEN ePayco sends a webhook with code "1" (approved) THEN the System SHALL update the order status to "confirmed"
3. WHEN a payment is confirmed THEN the System SHALL create a transaction record with gateway details
4. WHEN a payment is confirmed THEN the System SHALL send a notification to the organization owner via WhatsApp Personal
5. WHEN a payment is declined THEN the System SHALL update the order status to "cancelled"
6. WHEN a webhook is received THEN the System SHALL validate the signature to ensure authenticity
7. WHEN a webhook for an already-processed order is received THEN the System SHALL ignore it to ensure idempotency

### Requirement 5: Order Confirmation Pages

**User Story:** As a customer, I want to see a confirmation page after payment, so that I know my order was successful and can access order details.

#### Acceptance Criteria

1. WHEN payment is successful THEN the payment gateway SHALL redirect the customer to `/store/[slug]/order/[orderId]/success`
2. WHEN a customer accesses the success page THEN the System SHALL display order number, items purchased, total paid, and shipping information
3. WHEN payment fails THEN the payment gateway SHALL redirect the customer to `/store/[slug]/order/[orderId]/error`
4. WHEN a customer accesses the error page THEN the System SHALL display the failure reason and a "Retry Payment" button
5. WHEN payment is pending (e.g., PSE) THEN the payment gateway SHALL redirect to `/store/[slug]/order/[orderId]/pending`
6. WHEN a customer accesses the pending page THEN the System SHALL display instructions and a "Check Status" button
7. WHEN a customer clicks "Return to Store" THEN the System SHALL redirect to the storefront homepage

### Requirement 6: Organization Owner Order Management

**User Story:** As an organization owner, I want to view and manage all orders in my dashboard, so that I can fulfill customer purchases and track sales.

#### Acceptance Criteria

1. WHEN an organization owner accesses `/dashboard/orders` THEN the System SHALL display a list of all orders for their organization
2. WHEN displaying orders THEN the System SHALL show order number, customer name, total, status, and date for each order
3. WHEN an organization owner clicks on an order THEN the System SHALL display full order details including items, customer info, and payment status
4. WHEN an organization owner updates order status THEN the System SHALL save the new status and update the timestamp
5. WHEN order status changes to "confirmed" THEN the System SHALL send a notification to the customer
6. WHEN order status changes to "shipped" THEN the System SHALL send a notification to the customer with tracking information
7. WHEN an organization owner filters orders by status THEN the System SHALL display only orders matching the selected status

### Requirement 7: Customer Order Tracking Portal

**User Story:** As a customer, I want to track my order status without logging in, so that I can see the progress of my purchase.

#### Acceptance Criteria

1. WHEN a customer accesses `/store/[slug]/order/[orderId]` THEN the System SHALL display the order status and details
2. WHEN displaying order status THEN the System SHALL show a visual timeline with current status highlighted
3. WHEN an order is in "confirmed" status THEN the System SHALL display "Order Confirmed - Being Prepared"
4. WHEN an order is in "processing" status THEN the System SHALL display "Order in Progress"
5. WHEN an order is in "shipped" status THEN the System SHALL display "Order Shipped" with tracking number if available
6. WHEN an order is in "delivered" status THEN the System SHALL display "Order Delivered"
7. WHEN a customer accesses an invalid order ID THEN the System SHALL display a "Order Not Found" message

### Requirement 8: Notifications System

**User Story:** As an organization owner, I want to receive notifications when orders are placed, so that I can fulfill them promptly.

#### Acceptance Criteria

1. WHEN an order payment is confirmed THEN the System SHALL send a WhatsApp notification to the organization owner's personal number
2. WHEN sending a notification THEN the System SHALL include order number, customer name, total, and items purchased
3. WHEN WhatsApp Personal is not connected THEN the System SHALL log the notification failure but not block order processing
4. WHEN the `notify_on_sale` setting is disabled THEN the System SHALL not send sale notifications
5. WHEN an order is cancelled by the customer THEN the System SHALL send a cancellation notification to the organization owner

### Requirement 9: Transaction Records

**User Story:** As the system, I need to maintain accurate transaction records, so that payments can be reconciled and audited.

#### Acceptance Criteria

1. WHEN a payment is confirmed THEN the System SHALL create a transaction record in `store_transactions` table
2. WHEN creating a transaction THEN the System SHALL store order_id, provider (wompi/epayco), amount, currency, and provider_transaction_id
3. WHEN a transaction already exists for a provider_transaction_id THEN the System SHALL update it instead of creating a duplicate
4. WHEN a transaction is created THEN the System SHALL link it to the corresponding order via order_id
5. WHEN a refund is processed THEN the System SHALL create a new transaction record with negative amount

### Requirement 10: Electronic Invoicing Data Collection

**User Story:** As an organization owner, I need to collect customer tax information during checkout, so that I can issue electronic invoices and comply with tax regulations.

#### Acceptance Criteria

1. WHEN a customer provides checkout information THEN the System SHALL collect document_type (CC, NIT, CE, Passport)
2. WHEN a customer provides checkout information THEN the System SHALL collect document_number
3. WHEN a customer provides checkout information THEN the System SHALL collect person_type (Natural or Jurídica)
4. WHEN person_type is "Jurídica" THEN the System SHALL optionally collect business_name
5. WHEN storing order data THEN the System SHALL include tax information in customer_info JSONB field
6. WHEN storing customer data THEN the System SHALL include tax information in customers table for future use
7. WHEN the system stores tax information THEN the System SHALL structure it to be compatible with future electronic invoicing integrations

### Requirement 11: Error Handling and Resilience

**User Story:** As the system, I need to handle errors gracefully, so that customers and owners have a good experience even when issues occur.

#### Acceptance Criteria

1. WHEN payment gateway API is unavailable THEN the System SHALL display an error message and suggest trying again later
2. WHEN webhook signature validation fails THEN the System SHALL reject the webhook and log the security event
3. WHEN order creation fails THEN the System SHALL display an error message and not charge the customer
4. WHEN a webhook fails to process THEN the System SHALL log the error in `webhook_logs` table for debugging
5. WHEN a customer accesses a non-existent order THEN the System SHALL display a 404 page with a link to return to the store
6. WHEN document_number validation fails THEN the System SHALL display an inline error message
7. WHEN required tax fields are missing THEN the System SHALL prevent checkout submission
