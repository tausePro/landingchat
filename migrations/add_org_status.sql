-- Add status column to organizations
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS status text CHECK (status IN ('active', 'suspended', 'archived')) DEFAULT 'active';

-- Update existing rows
UPDATE organizations SET status = 'active' WHERE status IS NULL;
