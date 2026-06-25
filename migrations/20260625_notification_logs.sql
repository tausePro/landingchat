-- =============================================================================
-- Notif Slice 2: tabla notification_logs (visibilidad + base para reintentos)
-- =============================================================================
--
-- Contexto:
--   Las notificaciones (WhatsApp venta al dueño, email/WhatsApp de estado al
--   comprador, etc.) eran fire-and-forget: si Evolution/Resend fallaba, se perdía
--   EN SILENCIO sin rastro (raíz del bug "no me llegan las notificaciones").
--   Esta tabla persiste CADA intento (canal, estado, error) → auditabilidad y
--   base para un cron de reintento posterior (Slice 2b).
--
-- Garantías:
--   - Aditiva e idempotente (IF NOT EXISTS / DROP POLICY IF EXISTS).
--   - RLS: SELECT solo para miembros del org (get_my_org_id()).
--     INSERT solo vía service role (sin policy de INSERT pública) — igual que
--     platform_events. El logging corre en webhooks/crons/server actions con
--     service client.
--   - kind/channel_used SIN CHECK estrecho: el catálogo evoluciona en TS sin
--     migración. channel y status SÍ acotados (dominios estables).
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    order_id UUID,                                                  -- nullable: no toda notif es de orden (ej. copilot)
    kind TEXT NOT NULL,                                             -- 'sale' | 'order_status' | 'copilot_insight' | 'system' | ...
    channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email')),
    recipient_type TEXT CHECK (recipient_type IN ('owner', 'buyer')),
    status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
    channel_used TEXT,                                             -- 'personal' | 'platform' | 'evolution' | 'meta' | 'resend'
    error TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lookup principal: por org + tiempo
CREATE INDEX IF NOT EXISTS idx_notification_logs_org_time
    ON public.notification_logs (organization_id, created_at DESC);

-- Por orden (para ver el historial de notifs de un pedido)
CREATE INDEX IF NOT EXISTS idx_notification_logs_order
    ON public.notification_logs (order_id)
    WHERE order_id IS NOT NULL;

-- Para encontrar fallos rápido (base del reintento)
CREATE INDEX IF NOT EXISTS idx_notification_logs_org_status_time
    ON public.notification_logs (organization_id, status, created_at DESC);

ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_logs_org_read ON public.notification_logs;
CREATE POLICY notification_logs_org_read
    ON public.notification_logs
    FOR SELECT
    TO authenticated
    USING (organization_id = public.get_my_org_id());

-- INSERT solo via service role (sin policy de INSERT pública).

COMMENT ON TABLE public.notification_logs IS
    'Registro de cada intento de notificación (venta, estado de pedido, etc.). Visibilidad + base de reintentos. INSERT solo service role.';
COMMENT ON COLUMN public.notification_logs.kind IS
    'Tipo de notificación. Sin CHECK estrecho — el catálogo vive en TS para evolución sin migración.';
COMMENT ON COLUMN public.notification_logs.channel_used IS
    'Subcanal real usado: personal/platform (WhatsApp) o evolution/meta/resend (proveedor).';

COMMIT;
