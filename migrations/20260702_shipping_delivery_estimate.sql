-- =============================================================================
-- Promesa de entrega configurable por tenant (shipping_settings)
-- =============================================================================
--
-- Contexto:
--   La promesa de entrega estaba semi-inventada: el executor del chat mostraba
--   "N a N+2 días hábiles" (el +2 no era configurable) y un default forzado de
--   3 días. El merchant no podía expresar "entrega hoy mismo" (0 días) ni un
--   rango real (ej. 2-4 días).
--
-- Semántica:
--   - estimated_delivery_days      → MÍNIMO de días (ya existía). 0 = hoy mismo.
--   - estimated_delivery_days_max  → MÁXIMO opcional. NULL = sin rango (solo min).
--   - Ambos NULL → promesa NO configurada → el storefront/chat no inventa nada.
--
-- Garantías:
--   - Aditiva e idempotente (IF NOT EXISTS / DROP CONSTRAINT IF EXISTS).
--   - Default NULL: ningún tenant cambia de comportamiento sin configurarlo.
--   - Sin cambios de RLS: hereda las políticas existentes de shipping_settings.
--
-- IMPORTANTE deploy: aplicar esta migración ANTES de desplegar el código que
-- la consume (getShippingConfig agrega la columna al SELECT explícito).
-- =============================================================================

BEGIN;

ALTER TABLE shipping_settings
    ADD COLUMN IF NOT EXISTS estimated_delivery_days_max INTEGER DEFAULT NULL;

ALTER TABLE shipping_settings
    DROP CONSTRAINT IF EXISTS shipping_settings_delivery_days_check;
ALTER TABLE shipping_settings
    ADD CONSTRAINT shipping_settings_delivery_days_check
    CHECK (
        (estimated_delivery_days IS NULL OR estimated_delivery_days >= 0)
        AND (estimated_delivery_days_max IS NULL OR estimated_delivery_days_max >= 0)
    );

COMMENT ON COLUMN shipping_settings.estimated_delivery_days IS
    'Mínimo de días hábiles de entrega estándar. 0 = entrega hoy mismo. NULL = promesa no configurada.';
COMMENT ON COLUMN shipping_settings.estimated_delivery_days_max IS
    'Máximo opcional de días hábiles (rango min-max). NULL = sin rango, se usa solo el mínimo.';

COMMIT;
