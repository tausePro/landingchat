-- Migration: WhatsApp Operator Controls (whitelist + soft-pause)
-- Fecha: 2026-05-13
-- Permite a operadores humanos controlar la IA desde WhatsApp:
--   1. Marcar contactos como "solo humano" (whitelist permanente).
--   2. Pausa suave (soft-pause) con expiración automática cuando un humano responde.
--   La pausa hard manual existente (chats.ai_enabled = false) NO se modifica.

-- =============================================================================
-- 1. Whitelist de contactos human-only
-- =============================================================================

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS is_human_only BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN customers.is_human_only IS
  'Si true, la IA NUNCA responderá automáticamente a este cliente. '
  'Sus mensajes solo serán atendidos por operadores humanos. '
  'Se activa con el comando /whitelist desde WhatsApp del operador.';

-- Índice parcial para queries de "clientes human-only" (mucho más eficiente que indexar toda la tabla)
CREATE INDEX IF NOT EXISTS idx_customers_human_only
  ON customers(organization_id, is_human_only)
  WHERE is_human_only = true;

-- =============================================================================
-- 2. Soft-pause con expiración por chat
-- =============================================================================

ALTER TABLE chats
  ADD COLUMN IF NOT EXISTS ai_paused_until TIMESTAMPTZ;

COMMENT ON COLUMN chats.ai_paused_until IS
  'Si NOT NULL y > NOW(), la IA está en pausa suave hasta esa fecha. '
  'Cuando expire, la IA se reanuda automáticamente al recibir el siguiente mensaje. '
  'Se activa automáticamente cuando el operador responde desde WhatsApp (fromMe sin comando) '
  'o manualmente con comando /yo. NO afecta el flag ai_enabled (pausa hard manual).';

-- Índice parcial para queries de "chats con pausa activa" (auto-reanudación, dashboards)
CREATE INDEX IF NOT EXISTS idx_chats_ai_paused_until
  ON chats(organization_id, ai_paused_until)
  WHERE ai_paused_until IS NOT NULL;

-- =============================================================================
-- 3. Verificación
-- =============================================================================

DO $$
BEGIN
  -- Validar que las columnas se crearon correctamente
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'is_human_only'
  ) THEN
    RAISE EXCEPTION 'Migration failed: customers.is_human_only not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chats' AND column_name = 'ai_paused_until'
  ) THEN
    RAISE EXCEPTION 'Migration failed: chats.ai_paused_until not created';
  END IF;

  RAISE NOTICE 'Migration 20260513_whatsapp_operator_controls.sql completed successfully';
END $$;
