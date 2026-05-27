-- =============================================================================
-- 20260527_storefront_facets_with_counts.sql
-- =============================================================================
--
-- Driver: slice v1.14.6 (search UX polish inspirado en Algolia).
--
-- Cambio: extender RPC public.storefront_facets para devolver tambien una
-- columna category_counts jsonb con shape [{"name": str, "count": int}]
-- ordenado alfabeticamente. Esto permite mostrar "Snacks (12)" en el panel
-- de filtros sin queries adicionales.
--
-- Backwards compat: la columna categories text[] se mantiene intacta para
-- callers existentes. Solo se AGREGA category_counts.
--
-- Idempotente: DROP FUNCTION IF EXISTS antes del CREATE.
-- =============================================================================

BEGIN;

-- Drop con la firma actual (no parametros). Es idempotente.
DROP FUNCTION IF EXISTS public.storefront_facets(uuid);

CREATE OR REPLACE FUNCTION public.storefront_facets(p_organization_id uuid)
RETURNS TABLE (
    categories text[],
    category_counts jsonb,
    min_price numeric,
    max_price numeric,
    product_count integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
    IF p_organization_id IS NULL THEN
        RAISE EXCEPTION 'organization_id cannot be null';
    END IF;

    -- Renombrado prod_price/prod_categories para evitar shadowing con
    -- las out-variables del RETURNS TABLE (mismo fix de 20260526b).
    RETURN QUERY
    WITH active_products AS (
        SELECT p.price AS prod_price, p.categories AS prod_categories
        FROM public.products p
        WHERE p.organization_id = p_organization_id
          AND p.is_active = true
    ),
    flat_categories AS (
        SELECT trim(cat) AS cat
        FROM active_products ap,
             LATERAL unnest(ap.prod_categories) AS cat
        WHERE cat IS NOT NULL AND length(trim(cat)) > 0
    ),
    grouped_categories AS (
        SELECT cat, COUNT(*)::integer AS cnt
        FROM flat_categories
        GROUP BY cat
        ORDER BY cat
    )
    SELECT
        COALESCE(
            (SELECT array_agg(cat ORDER BY cat) FROM grouped_categories),
            ARRAY[]::text[]
        ) AS categories,
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object('name', cat, 'count', cnt)
                    ORDER BY cat
                )
                FROM grouped_categories
            ),
            '[]'::jsonb
        ) AS category_counts,
        (SELECT MIN(prod_price) FROM active_products) AS min_price,
        (SELECT MAX(prod_price) FROM active_products) AS max_price,
        (SELECT COUNT(*)::integer FROM active_products) AS product_count;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.storefront_facets(uuid)
    TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.storefront_facets(uuid) IS
$comment$Devuelve facets para el panel de filtros del storefront: categorias unicas (text[] backwards-compat), category_counts jsonb [{name,count}] para mostrar conteos en UI, rango de precio min/max y conteo total de productos activos. SECURITY DEFINER con guarda por organization_id + is_active.$comment$;

NOTIFY pgrst, 'reload schema';

COMMIT;
