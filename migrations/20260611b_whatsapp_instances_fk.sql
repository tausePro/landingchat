-- =============================================================================
-- FK whatsapp_instances → organizations (Platform Notifier v0 — T0b)
-- =============================================================================
--
-- Hallazgo 2026-06-11: la FK no existe en prod — PostgREST no puede resolver
-- joins embebidos (organizations(slug), whatsapp_instances!inner) y existen
-- filas huérfanas apuntando a organizations borradas.
--
-- ⚠️ PASO 1 ES DESTRUCTIVO: elimina las instancias huérfanas (su org ya no
--    existe — son datos muertos irrecuperables de orgs borradas).
--    Verificado antes de proponer: 2 filas huérfanas (instancias 'personal'
--    de orgs eliminadas).
-- =============================================================================

BEGIN;

-- 1. Limpiar huérfanas (org inexistente)
DELETE FROM whatsapp_instances wi
WHERE NOT EXISTS (
    SELECT 1 FROM organizations o WHERE o.id = wi.organization_id
);

-- 2. Crear la FK con CASCADE (idempotente)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'whatsapp_instances_organization_id_fkey'
          AND table_name = 'whatsapp_instances'
    ) THEN
        ALTER TABLE whatsapp_instances
            ADD CONSTRAINT whatsapp_instances_organization_id_fkey
            FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Refrescar el schema cache de PostgREST (habilita joins embebidos)
NOTIFY pgrst, 'reload schema';

COMMIT;
