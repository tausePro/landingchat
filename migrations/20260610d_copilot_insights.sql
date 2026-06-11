-- =============================================================================
-- Copilot Merchant Loop v0 / T4.2: tabla copilot_insights (feed accionable)
-- =============================================================================
--
-- Feed de insights generados por el copilot semanal. Cada org ve solo los
-- suyos (RLS); INSERT solo vía service role (worker). UPDATE permitido a
-- miembros del org para aprobar/rechazar.
--
-- Diseño: .kiro/specs/copilot-merchant-loop-v0/design.md §1.2
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.copilot_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    scope TEXT NOT NULL DEFAULT 'weekly' CHECK (scope IN ('weekly', 'daily', 'on_demand')),
    iso_week TEXT,                                                  -- 'YYYY-Www' para idempotencia weekly
    status TEXT NOT NULL DEFAULT 'proposed'
        CHECK (status IN ('proposed', 'approved', 'executed', 'dismissed', 'expired')),
    title TEXT NOT NULL,
    body TEXT NOT NULL,                                             -- markdown
    proposed_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
    metrics_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    decided_at TIMESTAMPTZ,
    decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    decision_note TEXT,
    executed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotencia per (org, scope, iso_week) para weekly
CREATE UNIQUE INDEX IF NOT EXISTS idx_copilot_insights_org_week_unique
    ON public.copilot_insights (organization_id, scope, iso_week)
    WHERE iso_week IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_copilot_insights_org_status_time
    ON public.copilot_insights (organization_id, status, generated_at DESC);

ALTER TABLE public.copilot_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS copilot_insights_org_read ON public.copilot_insights;
CREATE POLICY copilot_insights_org_read
    ON public.copilot_insights
    FOR SELECT
    TO authenticated
    USING (organization_id = public.get_my_org_id());

DROP POLICY IF EXISTS copilot_insights_org_update ON public.copilot_insights;
CREATE POLICY copilot_insights_org_update
    ON public.copilot_insights
    FOR UPDATE
    TO authenticated
    USING (organization_id = public.get_my_org_id())
    WITH CHECK (organization_id = public.get_my_org_id());

-- INSERT solo via service role (worker). No policy pública.

COMMENT ON TABLE public.copilot_insights IS
    'Feed de insights generados por el copilot. Cada org ve sólo los suyos. Updates permitidos para aprobar/rechazar.';

COMMIT;
