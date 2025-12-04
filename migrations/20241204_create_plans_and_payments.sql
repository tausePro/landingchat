-- Migración: Crear tablas de planes y transacciones de pago
-- Fecha: 2024-12-04
-- Feature: plan-subscription-management

-- 1. Tabla de Planes
-- Define los diferentes niveles de suscripción disponibles
CREATE TABLE IF NOT EXISTS plans (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Identificación
    name text NOT NULL UNIQUE,
    slug text NOT NULL UNIQUE,
    description text,
    
    -- Precio y facturación
    price decimal(12,2) NOT NULL CHECK (price >= 0),
    currency text NOT NULL DEFAULT 'COP' CHECK (currency IN ('COP', 'USD')),
    billing_period text NOT NULL DEFAULT 'monthly' CHECK (billing_period IN ('monthly', 'yearly')),
    
    -- Límites del plan
    max_products integer NOT NULL DEFAULT 100,
    max_agents integer NOT NULL DEFAULT 1,
    max_monthly_conversations integer NOT NULL DEFAULT 500,
    
    -- Features habilitadas (JSON)
    -- Ejemplo: { "whatsapp": true, "analytics": true, "custom_domain": false }
    features jsonb DEFAULT '{}'::jsonb,
    
    -- Estado
    is_active boolean DEFAULT true,
    
    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Índices para plans
CREATE INDEX IF NOT EXISTS idx_plans_slug ON plans(slug);
CREATE INDEX IF NOT EXISTS idx_plans_is_active ON plans(is_active);

-- 2. Tabla de Transacciones de Pago
-- Registra todas las transacciones procesadas con Wompi
CREATE TABLE IF NOT EXISTS payment_transactions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Relación con suscripción
    subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
    
    -- Detalles del pago
    amount decimal(12,2) NOT NULL,
    currency text NOT NULL DEFAULT 'COP',
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'error', 'voided')),
    
    -- Información del proveedor
    provider text NOT NULL DEFAULT 'wompi',
    provider_transaction_id text,
    provider_response jsonb,
    
    -- Metadata adicional
    metadata jsonb DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Índices para payment_transactions
CREATE INDEX IF NOT EXISTS idx_payment_transactions_subscription ON payment_transactions(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_provider_id ON payment_transactions(provider_transaction_id);

-- 3. Insertar planes por defecto
INSERT INTO plans (name, slug, description, price, currency, billing_period, max_products, max_agents, max_monthly_conversations, features, is_active)
VALUES 
    ('Gratis', 'free', 'Plan gratuito para comenzar', 0, 'COP', 'monthly', 10, 1, 100, '{"whatsapp": false, "analytics": false, "custom_domain": false}'::jsonb, true),
    ('Starter', 'starter', 'Ideal para pequeños negocios', 99000, 'COP', 'monthly', 50, 2, 500, '{"whatsapp": true, "analytics": false, "custom_domain": false}'::jsonb, true),
    ('Pro', 'pro', 'Para negocios en crecimiento', 249000, 'COP', 'monthly', 200, 5, 2000, '{"whatsapp": true, "analytics": true, "custom_domain": false}'::jsonb, true),
    ('Enterprise', 'enterprise', 'Solución completa para grandes empresas', 599000, 'COP', 'monthly', 1000, 20, 10000, '{"whatsapp": true, "analytics": true, "custom_domain": true}'::jsonb, true)
ON CONFLICT (slug) DO NOTHING;

-- 4. RLS Policies para plans
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

-- Todos pueden ver planes activos (para mostrar en pricing)
CREATE POLICY "Anyone can view active plans" ON plans
    FOR SELECT
    USING (is_active = true);

-- Solo service role puede modificar planes
-- (No se crean políticas INSERT/UPDATE/DELETE para usuarios normales)

-- 5. RLS Policies para payment_transactions
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- Organizaciones pueden ver sus propias transacciones
CREATE POLICY "Organizations can view own transactions" ON payment_transactions
    FOR SELECT
    USING (
        subscription_id IN (
            SELECT s.id FROM subscriptions s
            JOIN profiles p ON p.organization_id = s.organization_id
            WHERE p.id = auth.uid()
        )
    );

-- Solo service role puede insertar/actualizar transacciones
-- (No se crean políticas INSERT/UPDATE para usuarios normales)

-- 6. Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
DROP TRIGGER IF EXISTS update_plans_updated_at ON plans;
CREATE TRIGGER update_plans_updated_at
    BEFORE UPDATE ON plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payment_transactions_updated_at ON payment_transactions;
CREATE TRIGGER update_payment_transactions_updated_at
    BEFORE UPDATE ON payment_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
