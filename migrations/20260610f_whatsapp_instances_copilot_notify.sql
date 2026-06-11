-- =============================================================================
-- Copilot Merchant Loop v0 / T4.2: whatsapp_instances.notify_on_copilot_insight
-- =============================================================================
--
-- Toggle de entrega del insight semanal por WhatsApp Personal del owner.
-- Default true para instancias personal conectadas (la mayoría querrá el
-- reporte); el owner puede apagarlo desde /dashboard/copilot/settings.
--
-- Diseño: .kiro/specs/copilot-merchant-loop-v0/design.md §1.4
-- =============================================================================

BEGIN;

ALTER TABLE public.whatsapp_instances
    ADD COLUMN IF NOT EXISTS notify_on_copilot_insight BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.whatsapp_instances.notify_on_copilot_insight IS
    'Solo aplica a instance_type=personal. Si true, el copilot envía insights semanales al teléfono del owner.';

COMMIT;
