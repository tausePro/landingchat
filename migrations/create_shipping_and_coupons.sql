-- Create shipping_settings table for global free shipping configuration
CREATE TABLE IF NOT EXISTS shipping_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Free shipping configuration
    free_shipping_enabled BOOLEAN DEFAULT FALSE,
    free_shipping_min_amount DECIMAL(10, 2) DEFAULT NULL,
    free_shipping_zones TEXT[] DEFAULT NULL, -- Geographic zones where free shipping applies
    
    -- Shipping rates
    default_shipping_rate DECIMAL(10, 2) DEFAULT 0,
    express_shipping_rate DECIMAL(10, 2) DEFAULT NULL,
    
    -- Settings
    estimated_delivery_days INTEGER DEFAULT 3,
    express_delivery_days INTEGER DEFAULT 1,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(organization_id)
);

COMMENT ON TABLE shipping_settings IS 'Global shipping configuration per organization';

-- Create coupons table
CREATE TABLE IF NOT EXISTS coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Coupon details
    code VARCHAR(50) NOT NULL,
    description TEXT,
    
    -- Discount configuration
    type VARCHAR(20) NOT NULL CHECK (type IN ('percentage', 'fixed', 'free_shipping')),
    value DECIMAL(10, 2) NOT NULL,
    
    -- Conditions
    min_purchase_amount DECIMAL(10, 2) DEFAULT NULL,
    max_discount_amount DECIMAL(10, 2) DEFAULT NULL,
    applies_to VARCHAR(20) DEFAULT 'all' CHECK (applies_to IN ('all', 'products', 'categories')),
    target_ids UUID[] DEFAULT NULL,
    
    -- Usage limits
    max_uses INTEGER DEFAULT NULL,
    max_uses_per_customer INTEGER DEFAULT 1,
    current_uses INTEGER DEFAULT 0,
    
    -- Validity
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    valid_until TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(organization_id, code)
);

COMMENT ON TABLE coupons IS 'Discount coupons and promotional codes';

-- Create coupon_usage table to track usage
CREATE TABLE IF NOT EXISTS coupon_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    
    discount_amount DECIMAL(10, 2) NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_shipping_settings_org ON shipping_settings(organization_id);
CREATE INDEX IF NOT EXISTS idx_coupons_org ON coupons(organization_id);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_coupon_usage_coupon ON coupon_usage(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_customer ON coupon_usage(customer_id);
