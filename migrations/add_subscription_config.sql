-- Add subscription_config column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS subscription_config JSONB DEFAULT NULL;

-- Add comment explaining the structure
COMMENT ON COLUMN products.subscription_config IS 'Subscription configuration: {enabled: boolean, price: number, interval: "day"|"week"|"month"|"year", interval_count: number, trial_days: number, discount_percentage: number}';

-- Create index for querying subscription products
CREATE INDEX IF NOT EXISTS idx_products_subscription_enabled ON products ((subscription_config->>'enabled')) WHERE subscription_config IS NOT NULL;
