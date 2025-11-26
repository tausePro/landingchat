-- Phase 8: Business Logic & Checkout Schema Updates

-- 1. Add 'settings' column to 'organizations' table
-- Stores configuration for Payments, Shipping, and Branding
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}'::jsonb;

-- 2. Create 'orders' table
CREATE TABLE IF NOT EXISTS orders (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id uuid REFERENCES organizations(id) NOT NULL,
    
    -- Customer Information (Snapshot at time of purchase)
    customer_info jsonb NOT NULL, -- { name, email, phone, address, city }
    
    -- Order Items (Snapshot of cart)
    items jsonb NOT NULL, -- [{ product_id, name, price, quantity, image_url }]
    
    -- Financials
    subtotal decimal(10,2) NOT NULL,
    shipping_cost decimal(10,2) DEFAULT 0,
    total decimal(10,2) NOT NULL,
    
    -- Status & Payment
    status text CHECK (status IN ('pending', 'paid', 'shipped', 'delivered', 'cancelled')) DEFAULT 'pending',
    payment_method text, -- 'wompi', 'manual', etc.
    payment_details jsonb DEFAULT '{}'::jsonb, -- Transaction ID, etc.
    
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Enable RLS for 'orders'
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for 'orders'

-- Organization Admins can view all orders for their organization
DROP POLICY IF EXISTS "Org admins can view own orders" ON orders;
CREATE POLICY "Org admins can view own orders"
ON orders FOR SELECT
USING (organization_id = get_my_org_id());

-- Organization Admins can update orders (e.g., change status)
DROP POLICY IF EXISTS "Org admins can update own orders" ON orders;
CREATE POLICY "Org admins can update own orders"
ON orders FOR UPDATE
USING (organization_id = get_my_org_id());

-- Public (Customers) can create orders
DROP POLICY IF EXISTS "Public can create orders" ON orders;
CREATE POLICY "Public can create orders"
ON orders FOR INSERT
WITH CHECK (true);

-- Public (Customers) can view their own orders (if we implement customer accounts later, for now maybe restrict or allow by ID/token)
-- For now, let's allow public to view orders if they have the ID (e.g. for confirmation page), 
-- but in a real app we'd want a secure token. 
-- For MVP/Demo: Allow select if true (simplification) OR restrict to created session.
-- Let's restrict to organization members for SELECT for now to be safe, 
-- and maybe allow a specific "read by ID" function or policy later if needed for the success page.
-- Actually, for the success page, the user might need to read the order they just created.
-- Let's allow public SELECT for now to facilitate the demo flow, but note this is insecure for production.
DROP POLICY IF EXISTS "Public can view orders" ON orders;
CREATE POLICY "Public can view orders"
ON orders FOR SELECT
USING (true); 
