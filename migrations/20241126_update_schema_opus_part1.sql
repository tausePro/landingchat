-- ============================================
-- MIGRACIÓN: AI Agent Infrastructure (Opus Part 1)
-- ============================================

-- 1. Índices para performance
CREATE INDEX IF NOT EXISTS idx_customers_org_email ON customers(organization_id, email);
CREATE INDEX IF NOT EXISTS idx_customers_org_phone ON customers(organization_id, phone);
CREATE INDEX IF NOT EXISTS idx_chats_customer ON chats(customer_id);
CREATE INDEX IF NOT EXISTS idx_chats_org_status ON chats(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_products_org_active ON products(organization_id, is_active);

-- 2. Tabla de descuentos/cupones
CREATE TABLE IF NOT EXISTS discounts (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id uuid REFERENCES organizations(id) NOT NULL,
    code text NOT NULL,
    type text CHECK (type IN ('percentage', 'fixed')) NOT NULL,
    value decimal(10,2) NOT NULL,
    min_purchase decimal(10,2) DEFAULT 0,
    max_uses integer,
    used_count integer DEFAULT 0,
    valid_from timestamp with time zone DEFAULT now(),
    valid_until timestamp with time zone,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(organization_id, code)
);

ALTER TABLE discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can manage discounts" ON discounts 
    FOR ALL USING (organization_id = get_my_org_id());

CREATE POLICY "Public can view active discounts" ON discounts 
    FOR SELECT USING (is_active = true);

-- 3. Agregar campos útiles a customers si no existen
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_interaction_at timestamp with time zone;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_orders integer DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_spent decimal(10,2) DEFAULT 0;

-- 4. Función para actualizar stats del customer
CREATE OR REPLACE FUNCTION update_customer_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status = 'paid' THEN
        UPDATE customers SET 
            total_orders = total_orders + 1,
            total_spent = total_spent + NEW.total,
            updated_at = now()
        WHERE id = NEW.customer_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_customer_stats ON orders;
CREATE TRIGGER trigger_update_customer_stats
    AFTER INSERT OR UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_customer_stats();
