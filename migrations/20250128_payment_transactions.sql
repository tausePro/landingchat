-- Tabla para registrar transacciones de pago de suscripciones
-- Esta tabla almacena el historial de pagos de las organizaciones a LandingChat

CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,

    -- Monto y moneda
    amount DECIMAL(12,2) NOT NULL,
    currency TEXT DEFAULT 'COP',

    -- Estado del pago
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'declined', 'voided', 'error', 'refunded')),

    -- Información del proveedor de pago
    provider TEXT NOT NULL, -- 'wompi', 'stripe', etc.
    provider_transaction_id TEXT UNIQUE,
    provider_reference TEXT,
    provider_response JSONB DEFAULT '{}'::jsonb,

    -- Método de pago
    payment_method TEXT, -- 'card', 'pse', 'nequi', etc.

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_payment_transactions_subscription ON payment_transactions(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_organization ON payment_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_provider_tx ON payment_transactions(provider_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created ON payment_transactions(created_at DESC);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_payment_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_payment_transactions_updated_at
    BEFORE UPDATE ON payment_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_transactions_updated_at();

-- RLS: Solo superadmins pueden ver todas las transacciones
-- Las organizaciones pueden ver sus propias transacciones
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- Política para superadmins
CREATE POLICY "Superadmins can manage payment transactions" ON payment_transactions
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_superadmin = true
        )
    );

-- Política para que organizaciones vean sus propias transacciones
CREATE POLICY "Organizations can view own payment transactions" ON payment_transactions
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM profiles
            WHERE profiles.id = auth.uid()
        )
    );

COMMENT ON TABLE payment_transactions IS 'Historial de pagos de suscripciones de las organizaciones';
COMMENT ON COLUMN payment_transactions.subscription_id IS 'Referencia a la suscripción que se está pagando';
COMMENT ON COLUMN payment_transactions.provider_transaction_id IS 'ID único de la transacción en el proveedor de pago';
COMMENT ON COLUMN payment_transactions.provider_response IS 'Respuesta completa del proveedor para auditoría';
