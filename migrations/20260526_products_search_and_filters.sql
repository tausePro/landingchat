-- =============================================================================
-- 20260526_products_search_and_filters.sql
-- =============================================================================
--
-- Objetivo: mejorar el buscador del storefront agregando full-text search en
-- espanol con tolerancia a acentos, stemming y ranking, mas filtros de precio
-- y categorias. Driver: merchant Tez (Quality Pets como segundo caso).
--
-- Componentes:
--   1. Extensiones pg_trgm + unaccent
--   2. Helper IMMUTABLE f_unaccent (requerido para columnas generadas e indices)
--   3. Columna generada products.search_tsv con pesos:
--        A name, B description, C categories
--   4. Indices GIN: search_tsv + trigram sobre name/description (fallback fuzzy)
--   5. RPC search_products: FTS espanol + ranking ts_rank + fallback pg_trgm
--      con filtros opcionales de precio y categorias
--   6. RPC storefront_facets: devuelve categorias + min/max price para el
--      panel de filtros
--
-- Compatibilidad: tablas existentes no se modifican excepto por la nueva
-- columna generada. La lectura sigue funcionando si la app no usa search_tsv.
-- Idempotente: todas las creaciones usan IF NOT EXISTS o DROP IF EXISTS.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Extensiones requeridas
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- =============================================================================
-- 2. Wrapper IMMUTABLE para unaccent
-- =============================================================================
-- Postgres marca unaccent() como STABLE por default. Las columnas generadas
-- y los indices funcionales requieren funciones IMMUTABLE. Este wrapper fija
-- el diccionario explicitamente y se declara IMMUTABLE.

CREATE OR REPLACE FUNCTION public.f_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE PARALLEL SAFE STRICT
AS $function$
    SELECT public.unaccent('public.unaccent', $1);
$function$;

COMMENT ON FUNCTION public.f_unaccent(text) IS
$comment$Wrapper IMMUTABLE de unaccent para uso en columnas generadas e indices funcionales.$comment$;

-- =============================================================================
-- 3. Columna generada products.search_tsv
-- =============================================================================
-- Pesos:
--   A (maximo): nombre del producto
--   B: descripcion
--   C: categorias (array convertido a string separado por espacios)
--
-- Usa diccionario espanol para stemming ("perros" -> "perro", "comidas" ->
-- "comida") y f_unaccent para tolerancia a acentos ("champu" matchea "champu").

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS search_tsv tsvector
    GENERATED ALWAYS AS (
        setweight(
            to_tsvector(
                'spanish',
                coalesce(public.f_unaccent(name), '')
            ),
            'A'
        ) ||
        setweight(
            to_tsvector(
                'spanish',
                coalesce(public.f_unaccent(description), '')
            ),
            'B'
        ) ||
        setweight(
            to_tsvector(
                'spanish',
                coalesce(public.f_unaccent(array_to_string(categories, ' ')), '')
            ),
            'C'
        )
    ) STORED;

COMMENT ON COLUMN public.products.search_tsv IS
$comment$Vector tsvector generado automaticamente para FTS espanol con pesos por campo y unaccent. Usado por public.search_products.$comment$;

-- =============================================================================
-- 4. Indices
-- =============================================================================
-- 4.1 GIN principal sobre search_tsv (para FTS)
CREATE INDEX IF NOT EXISTS products_search_tsv_idx
    ON public.products
    USING GIN (search_tsv);

-- 4.2 GIN trigram sobre name (para fallback fuzzy con typos)
CREATE INDEX IF NOT EXISTS products_name_trgm_idx
    ON public.products
    USING GIN (public.f_unaccent(lower(name)) gin_trgm_ops);

-- 4.3 GIN trigram sobre description (fallback fuzzy adicional)
CREATE INDEX IF NOT EXISTS products_description_trgm_idx
    ON public.products
    USING GIN (public.f_unaccent(lower(coalesce(description, ''))) gin_trgm_ops);

-- =============================================================================
-- 5. RPC: search_products
-- =============================================================================
-- Estrategia hibrida:
--   Paso 1: FTS con websearch_to_tsquery + ts_rank ordenado descendente
--   Paso 2: si FTS no encuentra nada, fallback fuzzy con pg_trgm similarity
--
-- Filtros opcionales aplicados en AMBAS estrategias para consistencia:
--   p_min_price, p_max_price: rango de precio en products.price
--   p_categories: AND con array (productos cuyas categorias se solapan con el
--                 array dado, operador && de Postgres)
--
-- SECURITY DEFINER: la RPC bypassea RLS para servir storefronts anonimos. La
-- guarda es el filtro explicito por p_organization_id + is_active.

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

    -- websearch_to_tsquery es tolerante a comillas, operadores raros y
    -- frases sueltas. Mejor opcion para input de usuario final.
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

    -- FOUND es true si la query anterior devolvio al menos una fila.
    IF FOUND THEN
        RETURN;
    END IF;

    -- Paso 2: fallback fuzzy con pg_trgm
    -- El operador % usa el threshold configurado por show_limit() (default 0.3)
    -- similarity() devuelve el score real para ranking.
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
        ) AS similarity
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
-- 6. RPC: storefront_facets
-- =============================================================================
-- Devuelve metadata para el panel de filtros del storefront:
--   categories: array de categorias unicas del catalogo activo del tenant
--   min_price / max_price: rango real de precios para el slider
--   product_count: total de productos activos (informacional)

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

    RETURN QUERY
    WITH active_products AS (
        SELECT p.price, p.categories
        FROM public.products p
        WHERE p.organization_id = p_organization_id
          AND p.is_active = true
    ),
    flat_categories AS (
        SELECT DISTINCT trim(cat) AS cat
        FROM active_products,
             LATERAL unnest(categories) AS cat
        WHERE cat IS NOT NULL AND length(trim(cat)) > 0
    )
    SELECT
        COALESCE(
            (SELECT array_agg(cat ORDER BY cat) FROM flat_categories),
            ARRAY[]::text[]
        ) AS categories,
        (SELECT MIN(price) FROM active_products) AS min_price,
        (SELECT MAX(price) FROM active_products) AS max_price,
        (SELECT COUNT(*)::integer FROM active_products) AS product_count;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.storefront_facets(uuid)
    TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.storefront_facets(uuid) IS
$comment$Devuelve facets para el panel de filtros del storefront: categorias unicas, rango de precio min/max y conteo de productos activos. SECURITY DEFINER con guarda por organization_id + is_active.$comment$;

-- =============================================================================
-- 7. Refresh PostgREST schema cache
-- =============================================================================

NOTIFY pgrst, 'reload schema';

COMMIT;
