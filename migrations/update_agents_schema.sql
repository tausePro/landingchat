-- Add personalization_config to agents table
ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS personalization_config JSONB DEFAULT '{}'::jsonb;

-- Add comment
COMMENT ON COLUMN agents.personalization_config IS 'Stores configuration for the personalization agent (products, rules, etc.)';
