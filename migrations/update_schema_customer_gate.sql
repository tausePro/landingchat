-- =============================================
-- MIGRACIÓN: MVP LandingChat - Customer Gate
-- =============================================

-- 1. Agregar customer_id a chats (si no existe)
ALTER TABLE chats ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id);

-- 2. Índices para performance
CREATE INDEX IF NOT EXISTS idx_customers_org_phone ON customers(organization_id, phone);
CREATE INDEX IF NOT EXISTS idx_customers_org_email ON customers(organization_id, email);
CREATE INDEX IF NOT EXISTS idx_chats_customer ON chats(customer_id);
CREATE INDEX IF NOT EXISTS idx_chats_org_status ON chats(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_messages_chat_created ON messages(chat_id, created_at DESC);

-- 3. Campos adicionales en customers (si no existen)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_orders integer DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_spent decimal(10,2) DEFAULT 0;

-- 4. Verificar que todo está OK
SELECT 
    table_name, 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name IN ('customers', 'chats') 
AND column_name IN ('customer_id', 'total_orders', 'total_spent', 'phone')
ORDER BY table_name, column_name;
