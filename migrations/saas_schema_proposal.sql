-- SaaS Infrastructure Schema Proposal
-- Based on "Shopify for LATAM" architecture

-- 1. Subscriptions Table
-- Manages the current plan, status, and limits for each organization.
CREATE TABLE IF NOT EXISTS subscriptions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    
    -- Plan Details
    plan_id text NOT NULL, -- 'free', 'starter', 'pro', 'enterprise'
    status text NOT NULL CHECK (status IN ('active', 'cancelled', 'past_due', 'trialing', 'incomplete')),
    
    -- Billing Cycle
    current_period_start timestamptz NOT NULL,
    current_period_end timestamptz NOT NULL,
    cancel_at_period_end boolean DEFAULT false,
    
    -- Payment Provider Info (for mapping to Stripe/Wompi)
    provider_subscription_id text,
    provider_customer_id text,
    
    -- Plan Limits (Cached from plan definition for quick access)
    max_products integer DEFAULT 100,
    max_agents integer DEFAULT 1,
    max_monthly_conversations integer DEFAULT 500,
    
    -- Financials
    currency text DEFAULT 'COP',
    price decimal(12,2) DEFAULT 0,
    commission_rate decimal(5,4) DEFAULT 0.0, -- 0.02 = 2% transaction fee
    
    -- Feature Flags (Granular control per subscription)
    -- Example: { "whatsapp": true, "analytics": true, "custom_domain": false }
    features jsonb DEFAULT '{}'::jsonb,
    
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Ensure one active subscription per organization (optional, depends on logic)
-- For now, we index for fast lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- 2. Usage Metrics Table
-- Tracks consumption for billing and analytics
CREATE TABLE IF NOT EXISTS usage_metrics (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    
    -- Period
    period_start timestamptz NOT NULL,
    period_end timestamptz NOT NULL,
    
    -- Metrics
    conversations_count integer DEFAULT 0,
    messages_count integer DEFAULT 0,
    orders_count integer DEFAULT 0,
    gmv decimal(12,2) DEFAULT 0, -- Gross Merchandise Value
    
    -- Snapshot of limits at that time (optional, for audit)
    plan_snapshot jsonb,
    
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    -- Ensure unique metric record per org per period
    UNIQUE(organization_id, period_start, period_end)
);

-- 3. RLS Policies (Security)
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_metrics ENABLE ROW LEVEL SECURITY;

-- Organizations can view their own subscription
CREATE POLICY "Organizations can view own subscription" ON subscriptions
    FOR SELECT
    USING (organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE profiles.id = auth.uid()
    ));

-- Organizations can view their own metrics
CREATE POLICY "Organizations can view own metrics" ON usage_metrics
    FOR SELECT
    USING (organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE profiles.id = auth.uid()
    ));

-- Only service role (admin/billing system) can insert/update
-- No INSERT/UPDATE policies for public/authenticated users
