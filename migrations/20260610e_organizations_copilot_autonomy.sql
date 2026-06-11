-- =============================================================================
-- Copilot Merchant Loop v0 / T4.2: organizations.copilot_autonomy_level
-- =============================================================================
--
-- Nivel de autonomía declarativo por organización. Aditiva: todos los
-- tenants existentes quedan en level_1_propose (solo propone, no ejecuta).
-- Level 2 es opt-in explícito desde /dashboard/copilot/settings.
-- v0 trata level_3 como level_2 (reservado por contrato).
--
-- Diseño: .kiro/specs/copilot-merchant-loop-v0/design.md §1.3
-- =============================================================================

BEGIN;

ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS copilot_autonomy_level TEXT NOT NULL DEFAULT 'level_1_propose';

ALTER TABLE public.organizations
    DROP CONSTRAINT IF EXISTS organizations_copilot_autonomy_level_check;

ALTER TABLE public.organizations
    ADD CONSTRAINT organizations_copilot_autonomy_level_check
    CHECK (copilot_autonomy_level IN ('level_1_propose', 'level_2_act_with_whitelist', 'level_3_full_autonomy'));

COMMENT ON COLUMN public.organizations.copilot_autonomy_level IS
    'Nivel de autonomía del copilot. Default level_1_propose (solo lectura). v0 ejecuta level_3 como level_2.';

COMMIT;
