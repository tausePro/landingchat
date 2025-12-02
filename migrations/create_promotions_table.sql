-- Create promotions table
CREATE TABLE IF NOT EXISTS promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed', 'bogo')),
    value DECIMAL(10, 2) NOT NULL,
    applies_to TEXT NOT NULL CHECK (applies_to IN ('all', 'category', 'products')),
    target_ids JSONB DEFAULT '[]'::jsonb,
    min_purchase DECIMAL(10, 2),
    new_customers_only BOOLEAN DEFAULT false,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    chat_message TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Users can view promotions from their organization" ON promotions;
CREATE POLICY "Users can view promotions from their organization" ON promotions
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert promotions for their organization" ON promotions;
CREATE POLICY "Users can insert promotions for their organization" ON promotions
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update promotions for their organization" ON promotions;
CREATE POLICY "Users can update promotions for their organization" ON promotions
    FOR UPDATE USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete promotions for their organization" ON promotions;
CREATE POLICY "Users can delete promotions for their organization" ON promotions
    FOR DELETE USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Create index
CREATE INDEX IF NOT EXISTS idx_promotions_organization_id ON promotions(organization_id);
