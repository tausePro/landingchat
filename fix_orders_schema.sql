-- Fix Orders Schema to match v3 requirements

-- 1. Ensure customers table exists (CRM foundation)
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

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org admins can manage customers" ON customers;
CREATE POLICY "Org admins can manage customers" ON customers FOR ALL USING (organization_id = get_my_org_id());

-- 2. Add customer_id to orders if missing (Critical for joins)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'customer_id') THEN
        ALTER TABLE orders ADD COLUMN customer_id uuid REFERENCES customers(id);
    END IF;
END $$;

-- 3. Add items column if missing (Critical for data)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'items') THEN
        ALTER TABLE orders ADD COLUMN items jsonb DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- 4. Ensure total column exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'total') THEN
        ALTER TABLE orders ADD COLUMN total decimal(10,2) DEFAULT 0;
    END IF;
END $$;

-- 5. Refresh RLS policies for orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org admins can view own orders" ON orders;
CREATE POLICY "Org admins can view own orders" ON orders FOR SELECT USING (organization_id = get_my_org_id());

DROP POLICY IF EXISTS "Org admins can update own orders" ON orders;
CREATE POLICY "Org admins can update own orders" ON orders FOR UPDATE USING (organization_id = get_my_org_id());

DROP POLICY IF EXISTS "Public can create orders" ON orders;
CREATE POLICY "Public can create orders" ON orders FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public can view orders" ON orders;
CREATE POLICY "Public can view orders" ON orders FOR SELECT USING (true);
