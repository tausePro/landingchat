-- Add system_prompt to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS system_prompt text;

-- Ensure configuration column exists (it should, but just in case)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS configuration jsonb DEFAULT '{}'::jsonb;

-- Ensure RLS policies allow access
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view agents" ON agents;
CREATE POLICY "Public can view agents" ON agents FOR SELECT USING (true);

DROP POLICY IF EXISTS "Org admins can manage agents" ON agents;
CREATE POLICY "Org admins can manage agents" ON agents FOR ALL USING (organization_id = get_my_org_id());
