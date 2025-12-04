-- Phase 8 v2: Business Logic, Checkout & Feedback Improvements

-- 1. Add 'settings' column to 'organizations' (if not exists)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}'::jsonb;

-- 2. Create 'orders' table (with chat_id link)
CREATE TABLE IF NOT EXISTS orders (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id uuid REFERENCES organizations(id) NOT NULL,
    chat_id uuid REFERENCES chats(id), -- Link to the chat session
    
    -- Customer Information
    customer_info jsonb NOT NULL, -- { name, email, phone, address, city }
    
    -- Order Items
    items jsonb NOT NULL, -- [{ product_id, name, price, quantity, image_url }]
    
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

-- 3. Enable RLS for 'orders'
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for 'orders'
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

-- 6. Create 'categories' table (for better structure, even if we use array for now)
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
