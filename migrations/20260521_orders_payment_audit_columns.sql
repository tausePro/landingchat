-- ============================================================================
-- Migración: 20260521 — orders payment audit columns
-- ============================================================================
--
-- Contexto (T1.6 — markOrderAsPaid):
-- El design.md §6.4 del spec i18n-fase-1 requiere registrar "quién y cuándo"
-- confirmó manualmente el pago de una orden, además de una nota opcional del
-- merchant. Hoy esa info vive embebida en `store_transactions.provider_response`
-- como JSON (no queryable directo).
--
-- Decisión arquitectónica: en lugar de crear una tabla `order_payment_audit`
-- separada, agregamos 3 columnas directas en `orders`. Razones:
--   - Caso de uso: solo necesitamos saber "último confirmador". No hay
--     requisito de histórico de cambios (revertir paid→pending no está en MVP).
--   - 1 query menos para mostrar quién confirmó el pago en la UI.
--   - Si futuro requiere audit trail completo, migración aparte sin pérdida.
--
-- Columnas nuevas:
--   - payment_confirmed_at TIMESTAMPTZ — timestamp UTC del momento de
--     confirmación manual desde el dashboard.
--   - payment_confirmed_by UUID — FK a auth.users(id) del operator que
--     confirmó. NULL si fue confirmado via webhook automático
--     (Wompi/ePayco rellenan solo payment_status; estas columnas son
--     exclusivas para confirmación manual humana).
--   - payment_confirmation_note TEXT — nota opcional del operator
--     (ej: "Transferencia verificada con captura en WhatsApp 21:43").
--
-- RLS: las nuevas columnas heredan las policies existentes de `orders`
-- (RLS habilitado, filtro por organization_id vía get_my_org_id()).
--
-- Backward compat: columnas nullable. Órdenes pre-T1.6 (confirmadas via
-- webhook o desde el `confirmOrderPayment` legacy) quedan con NULL en
-- las 3 columnas — la UI puede mostrar "Confirmado automáticamente" o
-- "Origen: webhook" según corresponda.
--
-- ============================================================================

-- 1. Agregar columnas (idempotente)
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMPTZ;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS payment_confirmed_by UUID
        REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS payment_confirmation_note TEXT;

-- 2. Índice para consultas dashboard tipo "qué pagos confirmé yo este mes"
CREATE INDEX IF NOT EXISTS idx_orders_payment_confirmed_by_at
    ON public.orders (payment_confirmed_by, payment_confirmed_at DESC)
    WHERE payment_confirmed_at IS NOT NULL;

-- 3. Comentarios en las columnas (autodocumentación de esquema)
COMMENT ON COLUMN public.orders.payment_confirmed_at IS
    'Timestamp UTC de confirmación manual del pago desde el dashboard. NULL si fue confirmado automáticamente vía webhook de gateway.';
COMMENT ON COLUMN public.orders.payment_confirmed_by IS
    'auth.users.id del operator que confirmó el pago manualmente. NULL en confirmaciones automáticas.';
COMMENT ON COLUMN public.orders.payment_confirmation_note IS
    'Nota libre opcional del operator al confirmar el pago (T1.6 — markOrderAsPaid).';
