-- Suspensión PROGRAMADA por fecha.
-- El operador agenda `suspend_at`; el cron /api/cron/suspension/process-scheduled
-- flipa status → 'suspended' cuando la fecha llega. La suspensión EFECTIVA ya se
-- aplica en resolvePublicOrganization + el layout del storefront (Admin S2):
-- esto solo agrega el disparo programado por fecha.
--
-- One-shot: al flipar, el cron limpia `suspend_at` (así reactivar luego no
-- re-dispara una fecha vieja).

ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS suspend_at timestamptz DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS suspended_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN organizations.suspend_at IS 'Fecha/hora programada de suspensión automática (one-shot; el cron la limpia al disparar). NULL = sin programar.';
COMMENT ON COLUMN organizations.suspended_at IS 'Cuándo se suspendió efectivamente (auditoría).';
