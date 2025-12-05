-- Migración: Contador de conversaciones WhatsApp en organizaciones
-- Fecha: 2024-12-04

-- 1. Agregar columna de contador a organizations
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS whatsapp_conversations_used INTEGER DEFAULT 0;

-- 2. Función RPC para incrementar contador de conversaciones
CREATE OR REPLACE FUNCTION increment_whatsapp_conversations(org_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE organizations 
    SET whatsapp_conversations_used = COALESCE(whatsapp_conversations_used, 0) + 1
    WHERE id = org_id;
    
    -- También actualizar el contador en la instancia de WhatsApp
    UPDATE whatsapp_instances
    SET conversations_this_month = COALESCE(conversations_this_month, 0) + 1
    WHERE organization_id = org_id AND instance_type = 'corporate';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Función para resetear contadores mensuales de todas las organizaciones
CREATE OR REPLACE FUNCTION reset_all_whatsapp_counters()
RETURNS void AS $$
BEGIN
    -- Resetear contador en organizations
    UPDATE organizations 
    SET whatsapp_conversations_used = 0;
    
    -- Resetear contadores en instancias
    UPDATE whatsapp_instances 
    SET 
        conversations_this_month = 0,
        messages_sent_this_month = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Índice para optimizar consultas de límites
CREATE INDEX IF NOT EXISTS idx_organizations_whatsapp_usage 
ON organizations(whatsapp_conversations_used);

-- 5. Comentarios
COMMENT ON COLUMN organizations.whatsapp_conversations_used IS 'Contador de conversaciones WhatsApp únicas este mes';
COMMENT ON FUNCTION increment_whatsapp_conversations IS 'Incrementa el contador de conversaciones WhatsApp para una organización';
COMMENT ON FUNCTION reset_all_whatsapp_counters IS 'Resetea todos los contadores de WhatsApp (ejecutar mensualmente)';
