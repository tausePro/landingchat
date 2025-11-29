-- Fix customers table to resolve registration errors

-- 1. Create customers table if not exists
CREATE TABLE IF NOT EXISTS customers (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id uuid REFERENCES organizations(id) NOT NULL,
    email text,
    phone text,
    full_name text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(organization_id, email),
    UNIQUE(organization_id, phone)
);

-- 2. Enable RLS if not enabled
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies if they exist
DROP POLICY IF EXISTS "Org admins can manage customers" ON customers;
DROP POLICY IF EXISTS "Public can create customers" ON customers;
DROP POLICY IF EXISTS "Public can read customers" ON customers;

-- 4. Create RLS policies for customers
CREATE POLICY "Org admins can manage customers" ON customers 
    FOR ALL USING (organization_id = get_my_org_id());

CREATE POLICY "Public can create customers" ON customers 
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can read customers" ON customers 
    FOR SELECT USING (true);

-- 5. Create carts table if not exists (needed for cart functionality)
CREATE TABLE IF NOT EXISTS carts (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id uuid REFERENCES organizations(id) NOT NULL,
    chat_id uuid REFERENCES chats(id),
    customer_id uuid REFERENCES customers(id),
    items jsonb DEFAULT '[]'::jsonb,
    status text DEFAULT 'active',
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Enable RLS for carts
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;

-- 7. Create cart policies
DROP POLICY IF EXISTS "Public can manage carts" ON carts;
CREATE POLICY "Public can manage carts" ON carts FOR ALL USING (true);

-- 8. Create orders table if not exists (needed for checkout)
CREATE TABLE IF NOT EXISTS orders (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id uuid REFERENCES organizations(id) NOT NULL,
    chat_id uuid REFERENCES chats(id),
    customer_id uuid REFERENCES customers(id),
    customer_info jsonb NOT NULL,
    items jsonb NOT NULL,
    subtotal decimal(10,2) NOT NULL,
    shipping_cost decimal(10,2) DEFAULT 0,
    total decimal(10,2) NOT NULL,
    status text CHECK (status IN ('pending', 'paid', 'shipped', 'delivered', 'cancelled')) DEFAULT 'pending',
    payment_method text,
    payment_details jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. Enable RLS for orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- 10. Create orders policies
DROP POLICY IF EXISTS "Org admins can view own orders" ON orders;
DROP POLICY IF EXISTS "Org admins can update own orders" ON orders;
DROP POLICY IF EXISTS "Public can create orders" ON orders;
DROP POLICY IF EXISTS "Public can view orders" ON orders;

CREATE POLICY "Org admins can view own orders" ON orders 
    FOR SELECT USING (organization_id = get_my_org_id());

CREATE POLICY "Org admins can update own orders" ON orders 
    FOR UPDATE USING (organization_id = get_my_org_id());

CREATE POLICY "Public can create orders" ON orders 
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can view orders" ON orders 
    FOR SELECT USING (true);