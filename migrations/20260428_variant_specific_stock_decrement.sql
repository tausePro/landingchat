DROP FUNCTION IF EXISTS public.decrement_product_stock(uuid, uuid, integer);

CREATE OR REPLACE FUNCTION public.decrement_product_stock(
    p_product_id uuid,
    p_organization_id uuid,
    p_quantity integer,
    p_variant_id uuid DEFAULT NULL
)
RETURNS TABLE (
    product_id uuid,
    variant_id uuid,
    previous_stock integer,
    new_stock integer,
    previous_variant_stock integer,
    new_variant_stock integer,
    was_sufficient boolean,
    variant_updated boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_previous_stock integer;
    v_new_stock integer;
    v_target_variant_id uuid;
    v_previous_variant_stock integer;
    v_new_variant_stock integer;
    v_variant_updated boolean := false;
    v_variant_row_count integer := 0;
    v_was_sufficient boolean;
BEGIN
    IF p_product_id IS NULL THEN
        RAISE EXCEPTION 'product_id cannot be null';
    END IF;
    IF p_organization_id IS NULL THEN
        RAISE EXCEPTION 'organization_id cannot be null';
    END IF;
    IF p_quantity IS NULL OR p_quantity < 1 THEN
        RAISE EXCEPTION 'quantity must be >= 1, got %', p_quantity;
    END IF;

    SELECT p.stock
      INTO v_previous_stock
      FROM public.products AS p
     WHERE p.id = p_product_id
       AND p.organization_id = p_organization_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'product % not found in organization %',
            p_product_id, p_organization_id;
    END IF;

    IF p_variant_id IS NOT NULL THEN
        SELECT pv.id, pv.stock_quantity
          INTO v_target_variant_id, v_previous_variant_stock
          FROM public.product_variants AS pv
         WHERE pv.id = p_variant_id
           AND pv.product_id = p_product_id
           AND pv.organization_id = p_organization_id
         FOR UPDATE;

        IF v_target_variant_id IS NULL THEN
            RAISE EXCEPTION 'variant % not found for product % in organization %',
                p_variant_id, p_product_id, p_organization_id;
        END IF;
    ELSE
        SELECT pv.id, pv.stock_quantity
          INTO v_target_variant_id, v_previous_variant_stock
          FROM public.product_variants AS pv
         WHERE pv.product_id = p_product_id
           AND pv.organization_id = p_organization_id
           AND pv.is_default = true
         ORDER BY pv.position ASC, pv.created_at ASC
         LIMIT 1
         FOR UPDATE;
    END IF;

    v_previous_stock := COALESCE(v_previous_stock, 0);
    v_new_stock := GREATEST(0, v_previous_stock - p_quantity);
    v_was_sufficient := v_previous_stock >= p_quantity;

    UPDATE public.products AS p
       SET stock = v_new_stock
     WHERE p.id = p_product_id
       AND p.organization_id = p_organization_id;

    IF v_target_variant_id IS NOT NULL THEN
        v_previous_variant_stock := COALESCE(v_previous_variant_stock, 0);
        v_new_variant_stock := GREATEST(0, v_previous_variant_stock - p_quantity);
        v_was_sufficient := v_previous_variant_stock >= p_quantity;

        UPDATE public.product_variants AS pv
           SET stock_quantity = v_new_variant_stock
         WHERE pv.id = v_target_variant_id
           AND pv.product_id = p_product_id
           AND pv.organization_id = p_organization_id;

        GET DIAGNOSTICS v_variant_row_count = ROW_COUNT;
        v_variant_updated := v_variant_row_count > 0;
    END IF;

    RETURN QUERY SELECT
        p_product_id,
        v_target_variant_id,
        v_previous_stock,
        v_new_stock,
        v_previous_variant_stock,
        v_new_variant_stock,
        v_was_sufficient,
        v_variant_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.decrement_product_stock(uuid, uuid, integer, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.decrement_product_stock(uuid, uuid, integer, uuid) IS
$comment$Decrementa stock agregado de producto y, cuando se proporciona variant_id, decrementa stock_quantity de esa variante específica. Si variant_id es null conserva fallback legacy a variante default.$comment$;

NOTIFY pgrst, 'reload schema';
