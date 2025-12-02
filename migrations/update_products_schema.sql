-- Add new columns for advanced product features
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS options JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS is_subscription BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_configurable BOOLEAN DEFAULT false;

-- Add comment to explain the columns
COMMENT ON COLUMN products.options IS 'Stores personalization options for configurable products';
COMMENT ON COLUMN products.is_subscription IS 'Indicates if the product is sold as a subscription';
COMMENT ON COLUMN products.is_configurable IS 'Indicates if the product can be customized via agent';
