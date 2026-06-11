-- =============================================================================
-- Productos reservables (servicios): products.is_bookable
-- =============================================================================
--
-- Contexto:
--   Booking Fase 2b — los servicios de un tenant (ej: hospedajes de Tantor's
--   House) son productos del catálogo. Con este flag, el PDP del producto
--   muestra el panel de reserva (mismo patrón que el BookingPanel de
--   propiedades en la vertical inmobiliaria), con el servicio prefijado.
--
-- Garantías:
--   - Aditiva e idempotente. Default false: ningún producto existente cambia.
--   - El panel solo aparece si ADEMÁS la org tiene el módulo `appointments`
--     (doble gating: producto + tenant).
-- =============================================================================

BEGIN;

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS is_bookable BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN products.is_bookable IS
    'Si true (y la org tiene módulo appointments), el PDP muestra el panel de reserva de cita para este servicio';

COMMIT;
