-- =============================================================================
-- 20260527b_search_suggestions_rpc.sql
-- =============================================================================
--
-- Driver: slice v1.14.6 (search UX polish - SmartSearch header).
--
-- Crea RPC public.search_product_suggestions usada por el empty state
-- inteligente del SmartSearch. Cuando search_products (FTS + fuzzy 0.3)
-- no encuentra resultados, esta RPC corre un fallback con threshold mas
-- relajado (default 0.15) para sugerir nombres de productos parecidos
-- al query del usuario.
--
-- Diferencias con search_products:
--   - Solo busca en products.name (mas rapido, menos ruido)
--   - Threshold parametrico (default 0.15)
--   - Devuelve nombre del producto para que el cliente pueda mostrar
--     "Quizas buscabas: Serum, Cepillo, Crema..."
--
-- Idempotente: DROP FUNCTION IF EXISTS antes del CREATE.
-- =============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.search_product_suggestions(uuid, text, integer, real);

CREATE OR REPLACE FUNCTION public.search_product_suggestions(
    p_organization_id uuid,
    p_query text,
    p_limit integer DEFAULT 5,
    p_min_similarity real DEFAULT 0.15
)
RETURNS TABLE (
    product_id uuid,
    name text,
    similarity real
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_query_lower text;
    v_sanitized_limit integer;
    v_sanitized_threshold real;
BEGIN
    IF p_organization_id IS NULL THEN
        RAISE EXCEPTION 'organization_id cannot be null';
    END IF;

    IF p_query IS NULL OR length(trim(p_query)) < 1 THEN
        RAISE EXCEPTION 'query cannot be empty';
    END IF;

    -- Sanitize limit: 1..20
    v_sanitized_limit := COALESCE(NULLIF(p_limit, 0), 5);
    IF v_sanitized_limit < 1 THEN v_sanitized_limit := 5; END IF;
    IF v_sanitized_limit > 20 THEN v_sanitized_limit := 20; END IF;

    -- Sanitize threshold: 0.05..0.5 (0.15 default es relajado pero no random)
    v_sanitized_threshold := COALESCE(p_min_similarity, 0.15::real);
    IF v_sanitized_threshold < 0.05::real THEN v_sanitized_threshold := 0.05::real; END IF;
    IF v_sanitized_threshold > 0.5::real THEN v_sanitized_threshold := 0.5::real; END IF;

    v_query_lower := lower(public.f_unaccent(trim(p_query)));

    RETURN QUERY
    SELECT
        p.id AS product_id,
        p.name,
        similarity(public.f_unaccent(lower(p.name)), v_query_lower)::real AS similarity
    FROM public.products p
    WHERE p.organization_id = p_organization_id
      AND p.is_active = true
      AND similarity(public.f_unaccent(lower(p.name)), v_query_lower) >= v_sanitized_threshold
    ORDER BY similarity DESC, p.name ASC
    LIMIT v_sanitized_limit;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.search_product_suggestions(uuid, text, integer, real)
    TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.search_product_suggestions(uuid, text, integer, real) IS
$comment$Devuelve sugerencias fuzzy de productos por nombre cuando la busqueda principal (search_products con FTS + fuzzy 0.3) no encuentra resultados. Usa pg_trgm.similarity con threshold parametrico (default 0.15, mas relajado que el 0.3 de search_products) para encontrar nombres parecidos al query del usuario. SECURITY DEFINER con guarda por organization_id + is_active.$comment$;

NOTIFY pgrst, 'reload schema';

COMMIT;
