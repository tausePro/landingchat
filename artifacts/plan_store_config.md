# Implementation Plan: Store Configuration, Home & Checkout

## Goal
Enable users to fully configure their "LandingChat" business (payments, shipping, branding) and implement the end-to-end checkout flow, starting from a branded Storefront Home.

## User Review Required
> [!IMPORTANT]
> We will add a `settings` JSONB column to the `organizations` table.
> We will implement a "Storefront Home" at `/store/[slug]` (or root of subdomain) that displays the logo and products.

## Proposed Changes

### 1. Database Schema
#### [MODIFY] `schema.sql` (and execute migration)
- Add `settings` column to `organizations` table:
  ```sql
  ALTER TABLE organizations ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}'::jsonb;
  ```
- Create `orders` table:
  ```sql
  CREATE TABLE orders (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id uuid REFERENCES organizations(id) NOT NULL,
    customer_info jsonb NOT NULL,
    items jsonb NOT NULL,
    total decimal(10,2) NOT NULL,
    status text DEFAULT 'pending',
    payment_method text,
    created_at timestamp with time zone DEFAULT now()
  );
  ```

### 2. Dashboard Settings (`/dashboard/settings`)
#### [MODIFY] `src/app/dashboard/settings/components/organization-form.tsx`
- Refactor into tabs: "General", "Pagos", "Envíos", "Apariencia".
- **Apariencia**: Upload Logo (saves to `organizations.logo_url`) and Primary Color.

### 3. Storefront Home (`/store/[slug]`)
#### [NEW] `src/app/store/[slug]/page.tsx`
- **Header**: Displays Organization Logo and Name.
- **Hero Section**: Featured product or welcome message.
- **Product Grid**: List of active products.
- **Chat Button**: Floating button to open the chat (`/chat/[slug]`).
- **Design**: Based on `Stitch Conversational E-commerce (4)` prototype.

### 4. Checkout Logic (`/chat/[slug]`)
#### [NEW] `src/app/chat/components/checkout-modal.tsx`
- Modal for "Ir a Pagar".
- Collects user info.
- Shows order summary.
- Payment selection (Wompi/Manual).
- Creates order in DB.

## Verification Plan
1.  **Configure**: Upload logo in Dashboard.
2.  **Home**: Visit `/store/[slug]`, verify logo and product list.
3.  **Chat**: Click "Chat" to enter conversation.
4.  **Checkout**: Complete purchase and verify order in DB.
