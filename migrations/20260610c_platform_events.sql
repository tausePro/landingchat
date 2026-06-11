-- =============================================================================
-- Copilot Merchant Loop v0 / T4.1: tabla platform_events (backbone event-sourced)
-- =============================================================================
--
-- Contexto:
--   Primer slice del copilot proactivo (spec .kiro/specs/copilot-merchant-loop-v0).
--   Backbone de eventos del dominio que alimenta los insights semanales.
--   Convive con `analytics_events` legacy SIN reemplazarla (NO objetivo v0).
--
-- Garantías:
--   - Aditiva e idempotente (IF NOT EXISTS / DROP POLICY IF EXISTS).
--   - RLS: SELECT solo para miembros del org (get_my_org_id()).
--     INSERT solo vía service role (sin policy de INSERT pública).
--   - event_type SIN CHECK estrecho intencionalmente: el catálogo vive en
--     src/lib/events/platform-event-types.ts para evolucionar sin migración.
--
-- Diseño: .kiro/specs/copilot-merchant-loop-v0/design.md §1.1
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.platform_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,                                       -- catálogo en TS, no en CHECK
    event_version INT NOT NULL DEFAULT 1,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    source TEXT NOT NULL CHECK (source IN ('web', 'whatsapp', 'webhook', 'system', 'copilot')),
    actor_id TEXT,                                                  -- user_id | customer_id | 'system'
    idempotency_key TEXT,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotencia per organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_events_org_idempotency
    ON public.platform_events (organization_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- Lookup principal: por org + tipo + tiempo
CREATE INDEX IF NOT EXISTS idx_platform_events_org_type_time
    ON public.platform_events (organization_id, event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_events_org_time
    ON public.platform_events (organization_id, occurred_at DESC);

ALTER TABLE public.platform_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_events_org_read ON public.platform_events;
CREATE POLICY platform_events_org_read
    ON public.platform_events
    FOR SELECT
    TO authenticated
    USING (organization_id = public.get_my_org_id());

-- INSERT solo via service role o RPC controlada (no policy de INSERT pública).

COMMENT ON TABLE public.platform_events IS
    'Backbone event-sourced del dominio. Catálogo de event_type vive en src/lib/events/platform-event-types.ts';
COMMENT ON COLUMN public.platform_events.event_type IS
    'Tipo del evento. Sin CHECK estrecho intencionalmente — la catalogación vive en TS para evolución sin migración.';
COMMENT ON COLUMN public.platform_events.idempotency_key IS
    'Clave externa única por org para evitar duplicados (ej. webhook_id, cron_run_id+iso_week).';

COMMIT;
