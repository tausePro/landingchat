-- =============================================================================
-- Teléfono de notificación del merchant (Platform Notifier v0 — T2)
-- =============================================================================
--
-- Destino del fallback de la cadena notifyMerchant: cuando el tenant NO
-- tiene instancia personal de WhatsApp conectada, la plataforma le notifica
-- (copilot, ventas) desde su propio canal a este número.
--
-- Aditiva e idempotente. NULL = sin fallback (solo dashboard).
-- =============================================================================

BEGIN;

ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS notification_phone TEXT;

COMMENT ON COLUMN organizations.notification_phone IS
    'WhatsApp del dueño para notificaciones de la plataforma (E.164 sin +). Fallback cuando no hay instancia personal conectada';

COMMIT;
