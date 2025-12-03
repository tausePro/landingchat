-- Migration: Optimize RLS Policies for Performance
-- This migration fixes auth_rls_initplan warnings by wrapping auth functions in SELECT
-- and consolidates multiple permissive policies where possible

-- ============================================
-- 1. DROP DUPLICATE INDEX
-- ============================================
DROP INDEX IF EXISTS idx_messages_chat_created;

-- ============================================
-- 2. OPTIMIZE BADGES POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users can view badges from their organization" ON badges;
DROP POLICY IF EXISTS "Users can insert badges for their organization" ON badges;
DROP POLICY IF EXISTS "Users can update badges for their organization" ON badges;
DROP POLICY IF EXISTS "Users can delete badges for their organization" ON badges;

CREATE POLICY "Users can view badges from their organization" ON badges
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id 
            FROM profiles 
            WHERE id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Users can insert badges for their organization" ON badges
    FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id 
            FROM profiles 
            WHERE id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Users can update badges for their organization" ON badges
    FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id 
            FROM profiles 
            WHERE id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Users can delete badges for their organization" ON badges
    FOR DELETE
    USING (
        organization_id IN (
            SELECT organization_id 
            FROM profiles 
            WHERE id = (SELECT auth.uid())
        )
    );

-- ============================================
-- 3. OPTIMIZE ORGANIZATIONS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON organizations;

CREATE POLICY "Authenticated users can create organizations" ON organizations
    FOR INSERT
    WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- ============================================
-- 4. OPTIMIZE PROFILES POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can create own profile" ON profiles;

CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT
    USING (id = (SELECT auth.uid()));

CREATE POLICY "Users can create own profile" ON profiles
    FOR INSERT
    WITH CHECK (id = (SELECT auth.uid()));

-- ============================================
-- 5. OPTIMIZE MARKETPLACE_ITEMS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Superadmin write marketplace" ON marketplace_items;

CREATE POLICY "Superadmin write marketplace" ON marketplace_items
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = (SELECT auth.uid()) 
            AND role = 'superadmin'
        )
    );

-- ============================================
-- 6. OPTIMIZE PLANS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Superadmin write plans" ON plans;

CREATE POLICY "Superadmin write plans" ON plans
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = (SELECT auth.uid()) 
            AND role = 'superadmin'
        )
    );

-- ============================================
-- 7. OPTIMIZE AGENT_TEMPLATES POLICIES
-- ============================================
DROP POLICY IF EXISTS "Superadmin write agent templates" ON agent_templates;

CREATE POLICY "Superadmin write agent templates" ON agent_templates
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = (SELECT auth.uid()) 
            AND role = 'superadmin'
        )
    );

-- ============================================
-- 8. OPTIMIZE SUBSCRIPTIONS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Superadmin all subscriptions" ON subscriptions;

CREATE POLICY "Superadmin all subscriptions" ON subscriptions
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = (SELECT auth.uid()) 
            AND role = 'superadmin'
        )
    );

-- ============================================
-- 9. OPTIMIZE PROMOTIONS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users can view promotions from their organization" ON promotions;
DROP POLICY IF EXISTS "Users can insert promotions for their organization" ON promotions;
DROP POLICY IF EXISTS "Users can update promotions for their organization" ON promotions;
DROP POLICY IF EXISTS "Users can delete promotions for their organization" ON promotions;

CREATE POLICY "Users can view promotions from their organization" ON promotions
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id 
            FROM profiles 
            WHERE id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Users can insert promotions for their organization" ON promotions
    FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id 
            FROM profiles 
            WHERE id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Users can update promotions for their organization" ON promotions
    FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id 
            FROM profiles 
            WHERE id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Users can delete promotions for their organization" ON promotions
    FOR DELETE
    USING (
        organization_id IN (
            SELECT organization_id 
            FROM profiles 
            WHERE id = (SELECT auth.uid())
        )
    );

-- ============================================
-- 10. OPTIMIZE STOREFRONT_TEMPLATES POLICIES
-- ============================================
DROP POLICY IF EXISTS "Only superadmins can manage templates" ON storefront_templates;

CREATE POLICY "Only superadmins can manage templates" ON storefront_templates
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = (SELECT auth.uid()) 
            AND role = 'superadmin'
        )
    );

-- ============================================
-- 11. OPTIMIZE AGENTS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users can create agents in own organization" ON agents;
DROP POLICY IF EXISTS "Users can view agents in own organization" ON agents;

CREATE POLICY "Users can create agents in own organization" ON agents
    FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id 
            FROM profiles 
            WHERE id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Users can view agents in own organization" ON agents
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id 
            FROM profiles 
            WHERE id = (SELECT auth.uid())
        )
    );

-- ============================================
-- 12. OPTIMIZE SYSTEM_SETTINGS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Only superadmins can modify system settings" ON system_settings;

CREATE POLICY "Only superadmins can modify system settings" ON system_settings
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = (SELECT auth.uid()) 
            AND role = 'superadmin'
        )
    );

-- ============================================
-- NOTES ON MULTIPLE PERMISSIVE POLICIES
-- ============================================
-- The warnings about multiple permissive policies are expected behavior
-- when you have different policies for different roles (public vs authenticated)
-- These are intentional and provide the correct access control.
-- The performance impact is minimal for most use cases.
