-- Migración: Configuración de Pasarelas de Pago para Organizaciones
-- Fecha: 2024-12-04

-- 1. Tabla de configuración de pasarelas de pago por organización
CREATE TABLE IF NOT EXISTS payment_gateway_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('wompi', 'epayco')),
    is_active BOOLEAN DEFAULT false,
    is_test_mode BOOLEAN DEFAULT true,
    -- Credenciales (encriptadas en la aplicación)
    public_key TEXT,
    private_key_encrypted TEXT,
    integrity_secret_encrypted TEXT,
    -- Configuración adicional
    webhook_url TEXT,
    config JSONB DEFAULT '{}',
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Una sola configuración por proveedor por organización
    UNIQUE(organization_id, provider)
);

-- 2. Tabla de transacciones de tienda
CREATE TABLE IF NOT EXISTS store_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    order_id UUID REFERENCES orders(id),
    customer_id UUID REFERENCES customers(id),
    -- Datos de transacción
    amount INTEGER NOT NULL, -- En centavos
    currency TEXT DEFAULT 'COP',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'voided', 'error')),
    -- Datos del proveedor
    provider TEXT NOT NULL,
    provider_transaction_id TEXT,
    provider_reference TEXT,
    provider_response JSONB,
    -- Método de pago
    payment_method TEXT, -- 'card', 'pse', 'nequi', etc.
    payment_method_details JSONB,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- 3. Índices
CREATE INDEX IF NOT EXISTS idx_payment_gateway_configs_org ON payment_gateway_configs(organization_id);
CREATE INDEX IF NOT EXISTS idx_store_transactions_org ON store_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_store_transactions_order ON store_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_store_transactions_status ON store_transactions(status);
CREATE INDEX IF NOT EXISTS idx_store_transactions_provider_ref ON store_transactions(provider_reference);

-- 4. RLS para payment_gateway_configs
ALTER TABLE payment_gateway_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org admins can view own gateway configs" ON payment_gateway_configs;
CREATE POLICY "Org admins can view own gateway configs" ON payment_gateway_configs 
    FOR SELECT USING (organization_id = get_my_org_id());

DROP POLICY IF EXISTS "Org admins can insert own gateway configs" ON payment_gateway_configs;
CREATE POLICY "Org admins can insert own gateway configs" ON payment_gateway_configs 
    FOR INSERT WITH CHECK (organization_id = get_my_org_id());

DROP POLICY IF EXISTS "Org admins can update own gateway configs" ON payment_gateway_configs;
CREATE POLICY "Org admins can update own gateway configs" ON payment_gateway_configs 
    FOR UPDATE USING (organization_id = get_my_org_id());

DROP POLICY IF EXISTS "Org admins can delete own gateway configs" ON payment_gateway_configs;
CREATE POLICY "Org admins can delete own gateway configs" ON payment_gateway_configs 
    FOR DELETE USING (organization_id = get_my_org_id());

-- 5. RLS para store_transactions
ALTER TABLE store_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org admins can view own transactions" ON store_transactions;
CREATE POLICY "Org admins can view own transactions" ON store_transactions 
    FOR SELECT USING (organization_id = get_my_org_id());

DROP POLICY IF EXISTS "Public can create transactions" ON store_transactions;
CREATE POLICY "Public can create transactions" ON store_transactions 
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can update transactions" ON store_transactions;
CREATE POLICY "Service role can update transactions" ON store_transactions 
    FOR UPDATE USING (true);

-- 6. Agregar campo payment_status a orders si no existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'payment_status') THEN
        ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'processing', 'paid', 'failed', 'refunded'));
    END IF;
END $$;

-- 7. Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_payment_gateway_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_payment_gateway_config_updated_at ON payment_gateway_configs;
CREATE TRIGGER trigger_payment_gateway_config_updated_at
    BEFORE UPDATE ON payment_gateway_configs
    FOR EACH ROW EXECUTE FUNCTION update_payment_gateway_config_updated_at();

DROP TRIGGER IF EXISTS trigger_store_transaction_updated_at ON store_transactions;
CREATE TRIGGER trigger_store_transaction_updated_at
    BEFORE UPDATE ON store_transactions
    FOR EACH ROW EXECUTE FUNCTION update_payment_gateway_config_updated_at();
