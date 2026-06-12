-- =============================================================================
-- Roles del equipo de plataforma: profiles.admin_role (Admin S1)
-- =============================================================================
--
-- Hasta hoy el acceso al super admin era binario (is_superadmin). Para el
-- equipo: 'finance' (números: consumo, costos, suscripciones, pagos) y
-- 'tech' (configs: notificaciones, Evolution, Meta, instancias, webhooks).
-- NULL = sin acceso al panel. is_superadmin=true sigue siendo el rol máximo
-- (compat con todos los checks existentes).
--
-- Aditiva e idempotente.
-- =============================================================================

BEGIN;

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS admin_role TEXT
    CHECK (admin_role IS NULL OR admin_role IN ('superadmin', 'finance', 'tech'));

COMMENT ON COLUMN profiles.admin_role IS
    'Rol en el panel de plataforma: superadmin (todo), finance (números), tech (configs). NULL = sin acceso';

-- Backfill: superadmins existentes obtienen el rol explícito
UPDATE profiles SET admin_role = 'superadmin'
WHERE is_superadmin = true AND admin_role IS NULL;

COMMIT;
