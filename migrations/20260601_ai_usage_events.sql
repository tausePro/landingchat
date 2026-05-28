-- ═══════════════════════════════════════════════════════════════════
-- Migration: ai_usage_events
-- Purpose:   Telemetría LLM por evento (tokens, costo, latencia, mode/channel)
--            por tenant/agente/conversación.
--
-- Lectura:
--   - Superadmins: ven todo (dashboard /admin/ai-usage)
--   - Org members: ven solo lo de su organización (get_my_org_id())
--
-- Escritura:
--   - Inserts desde el server (service role) — NO desde el cliente.
--   - Sin políticas INSERT/UPDATE/DELETE para authenticated (cerrado por default).
--
-- Notas operativas:
--   - Fire-and-forget desde processMessage(): si el insert falla,
--     el chat sigue respondiendo al usuario.
--   - Volumen esperado: 1 fila por turno de Claude (no por mensaje del usuario).
--     Con un loop de 3 turnos promedio: ~3 filas por mensaje de usuario.
--
-- Refs:
--   - Estilo: migrations/20260426_analytics_events.sql
--   - Plan:   docs-private/INFORME_2_OBSERVABILIDAD_TOKENS_MULTIAGENT.md §1.3
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.ai_usage_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Tenant / agent / conversation
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    agent_id        UUID REFERENCES public.agents(id) ON DELETE SET NULL,
    chat_id         UUID REFERENCES public.chats(id) ON DELETE SET NULL,
    message_id      UUID REFERENCES public.messages(id) ON DELETE SET NULL,

    -- LLM model + tokens (Anthropic response.usage)
    model                          TEXT NOT NULL,
    input_tokens                   INTEGER NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
    output_tokens                  INTEGER NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
    cache_creation_input_tokens    INTEGER NOT NULL DEFAULT 0 CHECK (cache_creation_input_tokens >= 0),
    cache_read_input_tokens        INTEGER NOT NULL DEFAULT 0 CHECK (cache_read_input_tokens >= 0),

    -- Cost (centavos USD, calculado server-side al insertar usando src/lib/ai/pricing.ts)
    cost_usd_cents  INTEGER NOT NULL DEFAULT 0 CHECK (cost_usd_cents >= 0),

    -- Contexto del turno
    mode            TEXT CHECK (mode IS NULL OR mode IN ('ecommerce', 'real_estate', 'hybrid')),
    channel         TEXT CHECK (channel IS NULL OR channel IN ('web', 'whatsapp', 'instagram', 'messenger')),
    agent_role      TEXT,                       -- futuro multi-agent: 'router'|'sales'|'checkout'|'support'|'supervisor'
    tools_used      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    tool_count      INTEGER NOT NULL DEFAULT 0 CHECK (tool_count >= 0),
    loop_count      INTEGER NOT NULL DEFAULT 1 CHECK (loop_count >= 1),

    -- Performance
    latency_ms      INTEGER NOT NULL DEFAULT 0 CHECK (latency_ms >= 0),
    error_code      TEXT,                       -- '429' | '500' | 'timeout' | etc; NULL si OK

    -- Metadata abierta para campos futuros sin migration
    metadata        JSONB NOT NULL DEFAULT '{}'::JSONB,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para queries de dashboard
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_org_created
    ON public.ai_usage_events (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_created
    ON public.ai_usage_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_org_model
    ON public.ai_usage_events (organization_id, model, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_org_channel
    ON public.ai_usage_events (organization_id, channel, created_at DESC)
    WHERE channel IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_chat
    ON public.ai_usage_events (chat_id, created_at DESC)
    WHERE chat_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_errors
    ON public.ai_usage_events (organization_id, created_at DESC)
    WHERE error_code IS NOT NULL;

-- RLS: cerrado por default; service role bypassa RLS (los inserts vienen del server).
ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

-- Org members ven SOLO lo de su organización
DROP POLICY IF EXISTS org_members_view_ai_usage_events ON public.ai_usage_events;
CREATE POLICY org_members_view_ai_usage_events
    ON public.ai_usage_events
    FOR SELECT
    TO authenticated
    USING (organization_id = get_my_org_id());

-- Superadmins ven todo (dashboard /admin/ai-usage)
DROP POLICY IF EXISTS superadmin_view_ai_usage_events ON public.ai_usage_events;
CREATE POLICY superadmin_view_ai_usage_events
    ON public.ai_usage_events
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.is_superadmin = TRUE
        )
    );

COMMENT ON TABLE public.ai_usage_events IS
    'Telemetría LLM por turno (input/output/cache tokens, cost, latency, tools). '
    'Una fila por llamada a Anthropic dentro del loop de processMessage(). '
    'Inserts fire-and-forget desde el server; lectura via RLS por org o superadmin.';
