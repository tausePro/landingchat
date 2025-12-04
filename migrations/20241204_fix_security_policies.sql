# LandingChat Project - Security Issues & Fixes

-- Fix overly permissive RLS policies
-- This is a CRITICAL security fix

-- 1. Fix customers policies
DROP POLICY IF EXISTS "Public can read customers" ON customers;
CREATE POLICY "Customers can read own data" ON customers 
    FOR SELECT USING (
        phone IN (
            SELECT phone FROM customers 
            WHERE organization_id = auth.uid()::uuid
        )
        OR organization_id = auth.uid()::uuid
    );

-- 2. Fix carts policies  
DROP POLICY IF EXISTS "Public can manage carts" ON carts;
CREATE POLICY "Users can manage own carts" ON carts 
    FOR ALL USING (
        customer_id IN (
            SELECT id FROM customers 
            WHERE organization_id = auth.uid()::uuid
        )
        OR organization_id = auth.uid()::uuid
    );

-- 3. Fix orders policies
DROP POLICY IF EXISTS "Public can view orders" ON orders;
CREATE POLICY "Users can view own orders" ON orders 
    FOR SELECT USING (
        customer_id IN (
            SELECT id FROM customers 
            WHERE organization_id = auth.uid()::uuid
        )
        OR organization_id = auth.uid()::uuid
    );

-- 4. Fix agents policies
DROP POLICY IF EXISTS "Public can view agents" ON agents;
CREATE POLICY "Org members can view agents" ON agents 
    FOR SELECT USING (organization_id = auth.uid()::uuid);

-- 5. Fix categories policies
DROP POLICY IF EXISTS "Public can view categories" ON categories;
CREATE POLICY "Org members can view categories" ON categories 
    FOR SELECT USING (organization_id = auth.uid()::uuid);