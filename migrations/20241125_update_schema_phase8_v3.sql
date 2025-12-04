-- Phase 8 v3: Business Logic, Checkout & Feedback Improvements (Final)

-- 1. Add 'settings' column to 'organizations'
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}'::jsonb;

-- 2. Create 'customers' table (CRM foundation)
CREATE TABLE IF NOT EXISTS customers (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id uuid REFERENCES organizations(id) NOT NULL,
    email text,
    phone text,
    full_name text,
    metadata jsonb DEFAULT '{}'::jsonb, -- For storing preferences, sizes, etc.
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(organization_id, email),
    UNIQUE(organization_id, phone)
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org admins can manage customers" ON customers;
CREATE POLICY "Org admins can manage customers" ON customers FOR ALL USING (organization_id = get_my_org_id());

-- 3. Create 'carts' table (Abandoned cart tracking)
CREATE TABLE IF NOT EXISTS carts (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id uuid REFERENCES organizations(id) NOT NULL,
    chat_id uuid REFERENCES chats(id), -- Link to conversation
    customer_id uuid REFERENCES customers(id), -- Optional, if known
    items jsonb DEFAULT '[]'::jsonb, -- Current items in cart
    status text DEFAULT 'active', -- active, abandoned, converted
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE carts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can manage carts" ON carts;
CREATE POLICY "Public can manage carts" ON carts FOR ALL USING (true); -- Simplified for demo

-- 4. Create 'orders' table (Linked to Chat & Customer)
CREATE TABLE IF NOT EXISTS orders (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id uuid REFERENCES organizations(id) NOT NULL,
    chat_id uuid REFERENCES chats(id), -- Link to the chat session (ROI tracking)
    customer_id uuid REFERENCES customers(id), -- Link to CRM
    
    -- Snapshot data (in case customer/product changes)
    customer_info jsonb NOT NULL, 
    items jsonb NOT NULL, 
    
    -- Financials
    subtotal decimal(10,2) NOT NULL,
    shipping_cost decimal(10,2) DEFAULT 0,
    total decimal(10,2) NOT NULL,
    
    -- Status & Payment
    status text CHECK (status IN ('pending', 'paid', 'shipped', 'delivered', 'cancelled')) DEFAULT 'pending',
    payment_method text,
    payment_details jsonb DEFAULT '{}'::jsonb,
    
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org admins can view own orders" ON orders;
CREATE POLICY "Org admins can view own orders" ON orders FOR SELECT USING (organization_id = get_my_org_id());

DROP POLICY IF EXISTS "Org admins can update own orders" ON orders;
CREATE POLICY "Org admins can update own orders" ON orders FOR UPDATE USING (organization_id = get_my_org_id());

DROP POLICY IF EXISTS "Public can create orders" ON orders;
CREATE POLICY "Public can create orders" ON orders FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public can view orders" ON orders;
CREATE POLICY "Public can view orders" ON orders FOR SELECT USING (true);

-- 5. Add 'metadata' to 'messages' (for Rich Messages/Product Cards)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- 6. Create 'categories' table
CREATE TABLE IF NOT EXISTS categories (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id uuid REFERENCES organizations(id) NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    image_url text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(organization_id, slug)
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org admins can manage categories" ON categories;
CREATE POLICY "Org admins can manage categories" ON categories FOR ALL USING (organization_id = get_my_org_id());

DROP POLICY IF EXISTS "Public can view categories" ON categories;
CREATE POLICY "Public can view categories" ON categories FOR SELECT USING (true);
