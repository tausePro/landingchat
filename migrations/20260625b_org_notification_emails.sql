-- =============================================================================
-- Notif Slice 3: correos adicionales de notificación por merchant
-- =============================================================================
--
-- Permite que el merchant agregue correos extra (además de contact_email) que
-- reciben las notificaciones de nueva venta al dueño. Aditiva e idempotente.
-- =============================================================================

BEGIN;

ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS notification_emails text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.organizations.notification_emails IS
    'Correos adicionales (además de contact_email) que reciben las notificaciones de venta al dueño. Gestionado en /dashboard/settings.';

COMMIT;
