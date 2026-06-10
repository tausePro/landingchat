-- =============================================================================
-- Política de devoluciones por tenant (shipping_settings)
-- =============================================================================
--
-- Contexto:
--   Google Search Console (Fichas de comerciantes) marca "Falta el campo
--   hasMerchantReturnPolicy" en las offers del JSON-LD de productos. No se
--   puede emitir sin data real: estos campos permiten que cada merchant
--   configure SU política y el storefront la declare en el structured data.
--
-- Semántica:
--   - returns_accepted NULL  → política NO configurada → no se emite JSON-LD
--   - returns_accepted FALSE → MerchantReturnNotPermitted
--   - returns_accepted TRUE  → MerchantReturnFiniteReturnWindow con
--     return_window_days (+ return_fees si está configurado)
--
-- Garantías:
--   - Aditiva e idempotente (IF NOT EXISTS / DROP CONSTRAINT IF EXISTS).
--   - Default NULL: ningún tenant existente emite política sin configurarla.
--   - Sin cambios de RLS: hereda las políticas existentes de shipping_settings.
--
-- IMPORTANTE deploy: aplicar esta migración ANTES de desplegar el código que
-- la consume (getShippingConfig agrega las columnas al SELECT explícito).
-- =============================================================================

BEGIN;

ALTER TABLE shipping_settings
    ADD COLUMN IF NOT EXISTS returns_accepted BOOLEAN DEFAULT NULL;

ALTER TABLE shipping_settings
    ADD COLUMN IF NOT EXISTS return_window_days INTEGER DEFAULT NULL;

ALTER TABLE shipping_settings
    ADD COLUMN IF NOT EXISTS return_fees TEXT DEFAULT NULL;

-- DROP + ADD para idempotencia (re-aplicar no falla)
ALTER TABLE shipping_settings
    DROP CONSTRAINT IF EXISTS shipping_settings_return_fees_check;
ALTER TABLE shipping_settings
    ADD CONSTRAINT shipping_settings_return_fees_check
    CHECK (return_fees IS NULL OR return_fees IN ('free', 'customer'));

ALTER TABLE shipping_settings
    DROP CONSTRAINT IF EXISTS shipping_settings_return_window_days_check;
ALTER TABLE shipping_settings
    ADD CONSTRAINT shipping_settings_return_window_days_check
    CHECK (return_window_days IS NULL OR return_window_days > 0);

COMMENT ON COLUMN shipping_settings.returns_accepted IS
    'Política de devoluciones: NULL = no configurada (no se emite en JSON-LD), TRUE = acepta, FALSE = no acepta';
COMMENT ON COLUMN shipping_settings.return_window_days IS
    'Ventana de devolución en días (CO: el retracto legal son 5 días hábiles en ventas a distancia)';
COMMENT ON COLUMN shipping_settings.return_fees IS
    'Quién asume el envío de la devolución: free = el merchant (gratis para el cliente), customer = el cliente';

COMMIT;
