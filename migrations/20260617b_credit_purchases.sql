-- Migración: Compras de packs de créditos de conversaciones (Slice C)
-- Fecha: 2026-06-17
--
-- Rastrea cada compra de un pack de créditos (merchant → plataforma, pago Wompi
-- one-time, mismo patrón que las suscripciones). Da idempotencia (reference único
-- + credited_at) y auditoría. El webhook acredita con add_conversation_credits
-- SOLO una vez (cuando status pasa a 'approved' y credited_at sigue NULL).
--
-- Packs (catálogo): se modelan como marketplace_items existentes con
--   type = 'service', billing_period = 'one_time',
--   config_schema = { "kind": "conversation_credits", "credit_amount": N }
-- → NO requiere cambios al esquema de marketplace_items (sin ALTER TYPE).

-- 1. Tabla de compras de créditos
CREATE TABLE IF NOT EXISTS credit_purchases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    marketplace_item_id uuid REFERENCES marketplace_items(id) ON DELETE SET NULL,
    credit_amount integer NOT NULL CHECK (credit_amount > 0),
    amount_paid numeric(12, 2) NOT NULL CHECK (amount_paid >= 0),
    currency text NOT NULL DEFAULT 'COP',
    reference text NOT NULL UNIQUE,
    provider text NOT NULL DEFAULT 'wompi',
    provider_transaction_id text,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'error')),
    credited_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_purchases_org ON credit_purchases(organization_id);
CREATE INDEX IF NOT EXISTS idx_credit_purchases_status ON credit_purchases(status);

-- 2. RLS: el merchant solo LEE sus propias compras. La escritura (insert por la
--    server action, update por el webhook) la hace el servidor con service_role,
--    que bypassa RLS. No se crean policies de INSERT/UPDATE para authenticated.
ALTER TABLE credit_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org reads own credit_purchases" ON credit_purchases;
CREATE POLICY "org reads own credit_purchases"
    ON credit_purchases FOR SELECT
    USING (organization_id = get_my_org_id());

-- 3. Comentarios
COMMENT ON TABLE credit_purchases IS 'Compras de packs de créditos de conversaciones (pago Wompi one-time merchant→plataforma). Idempotencia vía reference único + credited_at.';
COMMENT ON COLUMN credit_purchases.reference IS 'Referencia Wompi (formato credits_<id>_<timestamp>); única para reconciliar el webhook.';
COMMENT ON COLUMN credit_purchases.credited_at IS 'Timestamp cuando se acreditaron los créditos; NULL hasta acreditar (garantiza acreditar una sola vez).';
