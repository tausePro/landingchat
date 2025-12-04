-- Migración: Integración WhatsApp con Evolution API
-- Fecha: 2024-12-04

-- 1. Tabla de instancias de WhatsApp por organización
CREATE TABLE IF NOT EXISTS whatsapp_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    instance_name TEXT NOT NULL UNIQUE, -- "org_{org_id}"
    instance_type TEXT NOT NULL CHECK (instance_type IN ('corporate', 'personal')),
    status TEXT DEFAULT 'disconnected' CHECK (status IN ('disconnected', 'connecting', 'connected', 'banned')),
    -- Información del número conectado
    phone_number TEXT, -- Número hasheado para privacidad
    phone_number_display TEXT, -- Últimos 4 dígitos para mostrar
    -- QR temporal para conexión
    qr_code TEXT,
    qr_expires_at TIMESTAMPTZ,
    -- Fechas de conexión
    connected_at TIMESTAMPTZ,
    disconnected_at TIMESTAMPTZ,
    -- Configuración de notificaciones (solo para personal)
    notifications_enabled BOOLEAN DEFAULT true,
    notify_on_sale BOOLEAN DEFAULT true,
    notify_on_low_stock BOOLEAN DEFAULT false,
    notify_on_new_conversation BOOLEAN DEFAULT false,
    -- Métricas de uso
    conversations_this_month INTEGER DEFAULT 0,
    messages_sent_this_month INTEGER DEFAULT 0,
    last_message_at TIMESTAMPTZ,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Una sola instancia corporativa por organización
    UNIQUE(organization_id, instance_type)
);

-- 2. Agregar columnas a tabla chats existente para soportar WhatsApp
ALTER TABLE chats ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'web' 
    CHECK (channel IN ('web', 'whatsapp'));
ALTER TABLE chats ADD COLUMN IF NOT EXISTS whatsapp_chat_id TEXT; -- ID del chat en WhatsApp
ALTER TABLE chats ADD COLUMN IF NOT EXISTS phone_number TEXT; -- Número del cliente (para identificación)

-- 3. Agregar campo max_whatsapp_conversations a tabla plans
ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_whatsapp_conversations INTEGER DEFAULT 0;

-- Actualizar planes existentes con límites de WhatsApp
UPDATE plans SET max_whatsapp_conversations = 50 WHERE slug = 'free';
UPDATE plans SET max_whatsapp_conversations = 200 WHERE slug = 'basic';
UPDATE plans SET max_whatsapp_conversations = 500 WHERE slug = 'pro';
UPDATE plans SET max_whatsapp_conversations = 1000 WHERE slug = 'enterprise';

-- 4. Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_org ON whatsapp_instances(organization_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_status ON whatsapp_instances(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_type ON whatsapp_instances(instance_type);
CREATE INDEX IF NOT EXISTS idx_chats_channel ON chats(channel);
CREATE INDEX IF NOT EXISTS idx_chats_phone ON chats(phone_number);
CREATE INDEX IF NOT EXISTS idx_chats_whatsapp_id ON chats(whatsapp_chat_id);

-- 5. RLS para whatsapp_instances
ALTER TABLE whatsapp_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org admins can view own whatsapp instances" ON whatsapp_instances;
CREATE POLICY "Org admins can view own whatsapp instances" ON whatsapp_instances 
    FOR SELECT USING (organization_id = get_my_org_id());

DROP POLICY IF EXISTS "Org admins can insert own whatsapp instances" ON whatsapp_instances;
CREATE POLICY "Org admins can insert own whatsapp instances" ON whatsapp_instances 
    FOR INSERT WITH CHECK (organization_id = get_my_org_id());

DROP POLICY IF EXISTS "Org admins can update own whatsapp instances" ON whatsapp_instances;
CREATE POLICY "Org admins can update own whatsapp instances" ON whatsapp_instances 
    FOR UPDATE USING (organization_id = get_my_org_id());

DROP POLICY IF EXISTS "Org admins can delete own whatsapp instances" ON whatsapp_instances;
CREATE POLICY "Org admins can delete own whatsapp instances" ON whatsapp_instances 
    FOR DELETE USING (organization_id = get_my_org_id());

-- Política para que webhooks puedan actualizar (usando service role)
DROP POLICY IF EXISTS "Service role can update whatsapp instances" ON whatsapp_instances;
CREATE POLICY "Service role can update whatsapp instances" ON whatsapp_instances 
    FOR UPDATE USING (true);

-- 6. Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_whatsapp_instance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_whatsapp_instance_updated_at ON whatsapp_instances;
CREATE TRIGGER trigger_whatsapp_instance_updated_at
    BEFORE UPDATE ON whatsapp_instances
    FOR EACH ROW EXECUTE FUNCTION update_whatsapp_instance_updated_at();

-- 7. Función para resetear contadores mensuales (ejecutar con cron)
CREATE OR REPLACE FUNCTION reset_whatsapp_monthly_counters()
RETURNS void AS $$
BEGIN
    UPDATE whatsapp_instances 
    SET 
        conversations_this_month = 0,
        messages_sent_this_month = 0,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- 8. Comentarios para documentación
COMMENT ON TABLE whatsapp_instances IS 'Instancias de WhatsApp conectadas por organización via Evolution API';
COMMENT ON COLUMN whatsapp_instances.instance_name IS 'Nombre único de la instancia en Evolution API (org_{org_id})';
COMMENT ON COLUMN whatsapp_instances.instance_type IS 'Tipo: corporate (ventas) o personal (notificaciones)';
COMMENT ON COLUMN whatsapp_instances.phone_number IS 'Número de teléfono hasheado para privacidad';
COMMENT ON COLUMN whatsapp_instances.conversations_this_month IS 'Contador de conversaciones únicas este mes';
