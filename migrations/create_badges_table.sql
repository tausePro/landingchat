-- Create badges table
CREATE TABLE IF NOT EXISTS badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    display_text TEXT NOT NULL,
    background_color TEXT NOT NULL DEFAULT '#000000',
    text_color TEXT NOT NULL DEFAULT '#FFFFFF',
    icon TEXT,
    type TEXT NOT NULL CHECK (type IN ('manual', 'automatic')),
    rules JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Users can view badges from their organization" ON badges;
CREATE POLICY "Users can view badges from their organization" ON badges
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert badges for their organization" ON badges;
CREATE POLICY "Users can insert badges for their organization" ON badges
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update badges for their organization" ON badges;
CREATE POLICY "Users can update badges for their organization" ON badges
    FOR UPDATE USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete badges for their organization" ON badges;
CREATE POLICY "Users can delete badges for their organization" ON badges
    FOR DELETE USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Create index
CREATE INDEX IF NOT EXISTS idx_badges_organization_id ON badges(organization_id);
