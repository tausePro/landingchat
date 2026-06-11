-- =============================================================================
-- Solicitud de reseñas post-compra: tracking en orders
-- =============================================================================
--
-- Contexto:
--   Slice "review requests": cron diario que, para tenants con la función
--   activada (organizations.settings.reviews.request_enabled), envía al
--   cliente un link tokenizado para reseñar los productos de su orden
--   pagada. `review_request_sent_at` garantiza idempotencia (una solicitud
--   por orden, nunca spam).
--
-- Garantías:
--   - Aditiva e idempotente (IF NOT EXISTS).
--   - Default NULL: ninguna orden existente se considera "ya solicitada";
--     el cron acota por ventana de fecha para no contactar órdenes viejas.
--   - Sin cambios de RLS: hereda las políticas existentes de orders.
--
-- IMPORTANTE deploy: aplicar ANTES de desplegar el código (el cron filtra
-- por esta columna).
-- =============================================================================

BEGIN;

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS review_request_sent_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN orders.review_request_sent_at IS
    'Cuándo se envió la solicitud de reseña post-compra (NULL = nunca). Idempotencia del cron /api/cron/reviews/request-reviews';

-- Índice parcial para el scan diario del cron: órdenes pagadas sin solicitud
CREATE INDEX IF NOT EXISTS idx_orders_pending_review_request
    ON orders (payment_confirmed_at)
    WHERE review_request_sent_at IS NULL AND payment_status = 'paid';

COMMIT;
