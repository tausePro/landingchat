-- ============================================
-- T0.5.1.1 — RLS pública en properties para storefront real estate
-- ============================================
--
-- Contexto:
--   El storefront público de tenants real estate (Tantor's House, etc.)
--   carga las propiedades para mostrar en la home y en las páginas de
--   detalle. Hasta hoy, el código usaba `createServiceClient()` con un
--   comentario "Usar service client para evitar restricciones RLS en
--   acceso público (subdominios)" — un workaround a RLS pública faltante.
--
--   Esta migración garantiza que el rol `anon` puede leer SELECT sobre
--   propiedades con `status = 'active'`. Es lo que cualquier visitante
--   anónimo del catálogo inmobiliario público necesita ver.
--
-- Política multi-tenant:
--   La policy NO filtra por organization_id porque los catálogos
--   inmobiliarios son inherentemente públicos (Google indexa cada listing
--   y cualquier visitante puede acceder al subdominio del tenant). La
--   query del storefront filtra por organization_id explícitamente, así
--   que cada subdominio sólo muestra sus propias propiedades.
--
-- Aditiva e idempotente:
--   - `ENABLE ROW LEVEL SECURITY` (si no estaba habilitado).
--   - `DROP POLICY IF EXISTS` para los 2 nombres posibles
--     (doc original "Public can view active properties" y el nombre
--     nuevo `properties_public_read_active`).
--   - `CREATE POLICY` con `TO anon, authenticated`.
--   - `GRANT SELECT` al rol `anon` (necesario aunque RLS pase, el GRANT
--     a nivel de tabla puede no existir si la tabla se creó vía Supabase
--     UI con defaults distintos).
--
-- Slice: F0.5.1 / T0.5.1.1 — refactor/reduce-service-client-surface
-- ============================================

BEGIN;

-- Asegurar RLS habilitado
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- Asegurar que anon puede SELECT (necesario para que la policy aplique)
GRANT SELECT ON public.properties TO anon;
GRANT SELECT ON public.properties TO authenticated;

-- Limpiar policies previas con el mismo propósito (idempotencia)
DROP POLICY IF EXISTS "Public can view active properties" ON public.properties;
DROP POLICY IF EXISTS properties_public_read_active ON public.properties;

-- Policy pública: cualquier visitante anon puede leer propiedades activas.
-- El filtrado por organization_id lo hace la query del storefront.
CREATE POLICY properties_public_read_active
    ON public.properties
    FOR SELECT
    TO anon, authenticated
    USING (status = 'active');

COMMENT ON POLICY properties_public_read_active ON public.properties IS
    'Acceso público de lectura para storefront real estate. Limita a status=active.';

COMMIT;
