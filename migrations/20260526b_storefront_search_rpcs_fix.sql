-- =============================================================================
-- 20260526b_storefront_search_rpcs_fix.sql
-- =============================================================================
--
-- Patch correctivo para 20260526_products_search_and_filters.sql.
--
-- Bugs detectados en smoke prod:
--   E. storefront_facets: ambiguedad "categories" entre out-variable del
--      RETURNS TABLE y columna del CTE active_products.
--   G. search_products fallback fuzzy: "similarity * 0.5" promociona a
--      double precision, no encaja con RETURNS TABLE similarity real.
--
-- Esta migracion redefine SOLO las 2 RPCs (DROP + CREATE). NO toca la
-- columna products.search_tsv ni los indices, que estan correctos en prod.
--
-- Idempotente: usa DROP FUNCTION IF EXISTS antes de cada CREATE.
-- =============================================================================

BEGIN;

-- =============================================================================
-- Fix Bug G: search_products fallback fuzzy castea GREATEST a real
-- =============================================================================

DROP FUNCTION IF EXISTS public.search_products(uuid, text, numeric, numeric, text[], integer);

CREATE OR REPLACE FUNCTION public.search_products(
    p_organization_id uuid,
    p_query text,
    p_min_price numeric DEFAULT NULL,
    p_max_price numeric DEFAULT NULL,
    p_categories text[] DEFAULT NULL,
    p_limit integer DEFAULT 50
)
RETURNS TABLE (
    product_id uuid,
    rank real,
    similarity real
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_ts_query tsquery;
    v_query_unaccent text;
    v_query_lower text;
    v_sanitized_limit integer;
BEGIN
    IF p_organization_id IS NULL THEN
        RAISE EXCEPTION 'organization_id cannot be null';
    END IF;

    IF p_query IS NULL OR length(trim(p_query)) < 1 THEN
        RAISE EXCEPTION 'query cannot be empty';
    END IF;

    v_sanitized_limit := COALESCE(NULLIF(p_limit, 0), 50);
    IF v_sanitized_limit < 1 THEN
        v_sanitized_limit := 50;
    END IF;
    IF v_sanitized_limit > 100 THEN
        v_sanitized_limit := 100;
    END IF;

    v_query_unaccent := public.f_unaccent(trim(p_query));
    v_query_lower := lower(v_query_unaccent);

    v_ts_query := websearch_to_tsquery('spanish', v_query_unaccent);

    -- Paso 1: FTS con ranking
    RETURN QUERY
    SELECT
        p.id AS product_id,
        ts_rank(p.search_tsv, v_ts_query) AS rank,
        0::real AS similarity
    FROM public.products p
    WHERE p.organization_id = p_organization_id
      AND p.is_active = true
      AND p.search_tsv @@ v_ts_query
      AND (p_min_price IS NULL OR p.price >= p_min_price)
      AND (p_max_price IS NULL OR p.price <= p_max_price)
      AND (p_categories IS NULL OR p.categories && p_categories)
    ORDER BY rank DESC, p.created_at DESC
    LIMIT v_sanitized_limit;

    IF FOUND THEN
        RETURN;
    END IF;

    -- Paso 2: fallback fuzzy con pg_trgm
    -- FIX G: cast a real porque "* 0.5" promociona a double precision.
    RETURN QUERY
    SELECT
        p.id AS product_id,
        0::real AS rank,
        GREATEST(
            similarity(public.f_unaccent(lower(p.name)), v_query_lower),
            similarity(
                public.f_unaccent(lower(coalesce(p.description, ''))),
                v_query_lower
            ) * 0.5
        )::real AS similarity
    FROM public.products p
    WHERE p.organization_id = p_organization_id
      AND p.is_active = true
      AND (
          public.f_unaccent(lower(p.name)) % v_query_lower
          OR public.f_unaccent(lower(coalesce(p.description, ''))) % v_query_lower
      )
      AND (p_min_price IS NULL OR p.price >= p_min_price)
      AND (p_max_price IS NULL OR p.price <= p_max_price)
      AND (p_categories IS NULL OR p.categories && p_categories)
    ORDER BY similarity DESC, p.created_at DESC
    LIMIT v_sanitized_limit;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.search_products(uuid, text, numeric, numeric, text[], integer)
    TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.search_products(uuid, text, numeric, numeric, text[], integer) IS
$comment$Busqueda de productos por tenant con FTS espanol (websearch_to_tsquery + ts_rank) y fallback fuzzy via pg_trgm. Devuelve product_id ordenado por relevancia. Aplica filtros opcionales de precio y categorias. SECURITY DEFINER con guarda por organization_id + is_active.$comment$;

-- =============================================================================
-- Fix Bug E: storefront_facets renombra columnas del CTE para evitar shadowing
-- =============================================================================

DROP FUNCTION IF EXISTS public.storefront_facets(uuid);

CREATE OR REPLACE FUNCTION public.storefront_facets(p_organization_id uuid)
RETURNS TABLE (
    categories text[],
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

    -- FIX E: renombramos las columnas del CTE a prod_price/prod_categories
    -- para que no colisionen con las out-variables price/categories del
    -- RETURNS TABLE (que dentro de PL/pgSQL son variables implicitas).
    RETURN QUERY
    WITH active_products AS (
        SELECT p.price AS prod_price, p.categories AS prod_categories
        FROM public.products p
        WHERE p.organization_id = p_organization_id
          AND p.is_active = true
    ),
    flat_categories AS (
        SELECT DISTINCT trim(cat) AS cat
        FROM active_products ap,
             LATERAL unnest(ap.prod_categories) AS cat
        WHERE cat IS NOT NULL AND length(trim(cat)) > 0
    )
    SELECT
        COALESCE(
            (SELECT array_agg(cat ORDER BY cat) FROM flat_categories),
            ARRAY[]::text[]
        ) AS categories,
        (SELECT MIN(prod_price) FROM active_products) AS min_price,
        (SELECT MAX(prod_price) FROM active_products) AS max_price,
        (SELECT COUNT(*)::integer FROM active_products) AS product_count;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.storefront_facets(uuid)
    TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.storefront_facets(uuid) IS
$comment$Devuelve facets para el panel de filtros del storefront: categorias unicas, rango de precio min/max y conteo de productos activos. SECURITY DEFINER con guarda por organization_id + is_active.$comment$;

-- =============================================================================
-- Refresh PostgREST schema cache
-- =============================================================================

NOTIFY pgrst, 'reload schema';

COMMIT;
