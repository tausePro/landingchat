-- Fix Agent Templates Schema

-- 1. Create agent_templates table if it doesn't exist
CREATE TABLE IF NOT EXISTS agent_templates (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id uuid REFERENCES organizations(id) NOT NULL,
    name text NOT NULL,
    description text,
    system_prompt text,
    configuration jsonb DEFAULT '{}'::jsonb, -- Stores greeting, tone, personality, etc.
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable RLS
ALTER TABLE agent_templates ENABLE ROW LEVEL SECURITY;

-- 3. Policies
DROP POLICY IF EXISTS "Org admins can manage agents" ON agent_templates;
CREATE POLICY "Org admins can manage agents" ON agent_templates 
    FOR ALL 
    USING (organization_id = get_my_org_id());

DROP POLICY IF EXISTS "Public can view active agents" ON agent_templates;
CREATE POLICY "Public can view active agents" ON agent_templates 
    FOR SELECT 
    USING (is_active = true);

-- 4. Add configuration column if table existed but column didn't
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_templates' AND column_name = 'configuration') THEN
        ALTER TABLE agent_templates ADD COLUMN configuration jsonb DEFAULT '{}'::jsonb;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_templates' AND column_name = 'system_prompt') THEN
        ALTER TABLE agent_templates ADD COLUMN system_prompt text;
    END IF;
END $$;
