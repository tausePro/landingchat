-- Migration: Enable RLS on missing tables and fix function search paths
-- This migration fixes security errors and warnings from Supabase linter

-- ============================================
-- 1. ENABLE RLS ON MISSING TABLES
-- ============================================

-- Enable RLS on coupon_usage table
ALTER TABLE coupon_usage ENABLE ROW LEVEL SECURITY;

-- Enable RLS on shipping_settings table
ALTER TABLE shipping_settings ENABLE ROW LEVEL SECURITY;

-- Enable RLS on coupons table
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. CREATE RLS POLICIES FOR COUPON_USAGE
-- ============================================

-- Public can view coupon usage (for validation)
CREATE POLICY "Public can view coupon usage" ON coupon_usage
    FOR SELECT
    USING (true);

-- Only authenticated users from the organization can insert coupon usage
CREATE POLICY "Users can track coupon usage" ON coupon_usage
    FOR INSERT
    WITH CHECK (
        coupon_id IN (
            SELECT id FROM coupons 
            WHERE organization_id IN (
                SELECT organization_id 
                FROM profiles 
                WHERE id = (SELECT auth.uid())
            )
        )
    );

-- ============================================
-- 3. CREATE RLS POLICIES FOR SHIPPING_SETTINGS
-- ============================================

-- Public can view shipping settings
CREATE POLICY "Public can view shipping settings" ON shipping_settings
    FOR SELECT
    USING (true);

-- Only users from the organization can manage shipping settings
CREATE POLICY "Users can manage shipping settings" ON shipping_settings
    FOR ALL
    USING (
        organization_id IN (
            SELECT organization_id 
            FROM profiles 
            WHERE id = (SELECT auth.uid())
        )
    );

-- ============================================
-- 4. CREATE RLS POLICIES FOR COUPONS
-- ============================================

-- Public can view active coupons
CREATE POLICY "Public can view active coupons" ON coupons
    FOR SELECT
    USING (
        is_active = true 
        AND (valid_from IS NULL OR valid_from <= NOW())
        AND (valid_until IS NULL OR valid_until >= NOW())
    );

-- Users can view all coupons from their organization
CREATE POLICY "Users can view organization coupons" ON coupons
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id 
            FROM profiles 
            WHERE id = (SELECT auth.uid())
        )
    );

-- Users can manage coupons in their organization
CREATE POLICY "Users can manage organization coupons" ON coupons
    FOR ALL
    USING (
        organization_id IN (
            SELECT organization_id 
            FROM profiles 
            WHERE id = (SELECT auth.uid())
        )
    );

-- ============================================
-- 5. FIX FUNCTION SEARCH PATHS
-- ============================================

-- Fix update_customer_stats function
CREATE OR REPLACE FUNCTION update_customer_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Update customer statistics when an order is created/updated
    UPDATE customers
    SET 
        total_orders = (
            SELECT COUNT(*) 
            FROM orders 
            WHERE customer_id = NEW.customer_id
        ),
        total_spent = (
            SELECT COALESCE(SUM(total), 0) 
            FROM orders 
            WHERE customer_id = NEW.customer_id 
            AND status = 'completed'
        ),
        last_interaction_at = NOW()
    WHERE id = NEW.customer_id;
    
    RETURN NEW;
END;
$$;

-- Fix update_storefront_templates_updated_at function
CREATE OR REPLACE FUNCTION update_storefront_templates_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- ============================================
-- NOTES
-- ============================================
-- The "auth_leaked_password_protection" warning must be enabled 
-- from the Supabase Dashboard under Authentication > Settings
-- This cannot be done via SQL migration.
