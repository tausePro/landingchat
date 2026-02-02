-- ============================================
-- Migración: Soporte para Meta WhatsApp Cloud API
-- Fecha: 2025-02-02
--
-- Agrega columnas a whatsapp_instances para soportar
-- Meta Cloud API como provider alternativo a Evolution API.
-- Las instancias existentes mantienen provider='evolution' por default.
-- ============================================

-- 1. Agregar columna provider con default 'evolution'
ALTER TABLE whatsapp_instances
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'evolution';

-- 2. Agregar constraint CHECK para valores válidos de provider
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'whatsapp_instances_provider_check'
  ) THEN
    ALTER TABLE whatsapp_instances
      ADD CONSTRAINT whatsapp_instances_provider_check
      CHECK (provider IN ('evolution', 'meta'));
  END IF;
END $$;

-- 3. Columnas específicas para Meta Cloud API
ALTER TABLE whatsapp_instances
  ADD COLUMN IF NOT EXISTS meta_phone_number_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_waba_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_access_token TEXT,
  ADD COLUMN IF NOT EXISTS meta_business_id TEXT;

-- 4. Índice para búsqueda por provider
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_provider
  ON whatsapp_instances(provider);

-- 5. Índice para búsqueda de instancia Meta por phone_number_id
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_meta_phone_number_id
  ON whatsapp_instances(meta_phone_number_id)
  WHERE meta_phone_number_id IS NOT NULL;

-- 6. Comentarios en columnas para documentación
COMMENT ON COLUMN whatsapp_instances.provider IS 'Provider de WhatsApp: evolution (Baileys) o meta (Cloud API oficial)';
COMMENT ON COLUMN whatsapp_instances.meta_phone_number_id IS 'ID del número de teléfono en Meta Graph API';
COMMENT ON COLUMN whatsapp_instances.meta_waba_id IS 'WhatsApp Business Account ID en Meta';
COMMENT ON COLUMN whatsapp_instances.meta_access_token IS 'Access token para Graph API (del Embedded Signup o System User)';
COMMENT ON COLUMN whatsapp_instances.meta_business_id IS 'Meta Business ID asociado al WABA';
