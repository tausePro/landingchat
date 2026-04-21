-- ============================================================================
-- Migración 20260421b_decrement_product_stock_fix_columns.sql
-- ----------------------------------------------------------------------------
-- POST-MORTEM DE FASE 0.4 (Bug H en v1.10.57)
--
-- La migración original `20260421_decrement_product_stock_rpc.sql` definió
-- `public.decrement_product_stock` y `public.restore_product_stock` haciendo
-- `UPDATE products SET ..., updated_at = now()` y
-- `UPDATE product_variants SET ..., updated_at = now()`.
--
-- PROBLEMA: `public.products` **NO tiene columna `updated_at`**. PostgreSQL
-- con PL/pgSQL usa late-binding de nombres de columna: compila la función
-- sin validar, pero el primer INVOKE lanza `ERROR 42703: column
-- "updated_at" does not exist`. En producción, la util de TypeScript
-- (`src/lib/commerce/decrementOrderStock.ts`) captura el error, loguea
-- warning y marca `orders.stock_decremented_at` como si hubiera funcionado.
-- Resultado: stock NUNCA bajó, pero el flag de idempotencia sí se puso.
--
-- Evidencia confirmada contra producción 2026-04-21 por el usuario:
--   - Orden ORD-20260421-278 (COD, 1x Dúo de Mascarillas Capilares):
--     `stock_decremented_at = 2026-04-21 20:52:14.396+00` (flag puesto),
--     pero `products.stock = 29` (sin cambio).
--   - `SELECT column_name FROM information_schema.columns
--       WHERE table_schema='public' AND table_name='products'` devuelve
--     sin `updated_at` (solo `created_at`).
--
-- FIX: redefinir ambas RPCs con `CREATE OR REPLACE` removiendo toda
-- referencia a `products.updated_at`. También removemos
-- `product_variants.updated_at` por simetría y seguridad (evitar otro
-- silent fail si esa columna tampoco existe). Si en el futuro queremos
-- rastrear "última modificación de stock" usaremos un TRIGGER, no el
-- caller.
--
-- El resto de la lógica queda intacta:
--   - Row-level lock con SELECT ... FOR UPDATE (cierra race del Bug B).
--   - Clamp a 0 con GREATEST para no dejar stock negativo.
--   - Validación de organization_id como tenant guard.
--   - Sync de variant default (is_default = true) si existe.
--   - SECURITY DEFINER + GRANT EXECUTE ya establecidos en la migración
--     anterior, no se alteran.
--
-- Reversión:
--   No se recomienda revertir porque la versión previa está rota.
--   Si fuera necesario, re-aplicar 20260421_decrement_product_stock_rpc.sql.
--
-- Tras aplicar esta migración, corré el siguiente script una sola vez para
-- reconciliar la orden huérfana:
--   UPDATE public.products
--      SET stock = stock - 1
--    WHERE id = '6233ee16-2156-4ef3-b3d2-1c957ca92977';
-- ============================================================================

-- 1. decrement_product_stock (FIX: sin updated_at)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.decrement_product_stock(
    p_product_id uuid,
    p_organization_id uuid,
    p_quantity integer
)
RETURNS TABLE (
    product_id uuid,
    previous_stock integer,
    new_stock integer,
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
    v_variant_updated boolean := false;
BEGIN
    -- Validaciones de entrada (sin cambios)
    IF p_product_id IS NULL THEN
        RAISE EXCEPTION 'product_id cannot be null';
    END IF;
    IF p_organization_id IS NULL THEN
        RAISE EXCEPTION 'organization_id cannot be null';
    END IF;
    IF p_quantity IS NULL OR p_quantity < 1 THEN
        RAISE EXCEPTION 'quantity must be >= 1, got %', p_quantity;
    END IF;

    -- Row-level lock sobre el producto (cierra race del Bug B, sin cambios)
    SELECT stock
      INTO v_previous_stock
      FROM public.products
     WHERE id = p_product_id
       AND organization_id = p_organization_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'product % not found in organization %',
            p_product_id, p_organization_id;
    END IF;

    v_previous_stock := COALESCE(v_previous_stock, 0);
    v_new_stock := GREATEST(0, v_previous_stock - p_quantity);

    -- FIX: quitar `updated_at = now()` — la columna no existe en products.
    UPDATE public.products
       SET stock = v_new_stock
     WHERE id = p_product_id
       AND organization_id = p_organization_id;

    -- FIX: quitar `updated_at = now()` de variants por simetría. Sólo
    -- actualiza stock_quantity. Si la tabla product_variants no tiene
    -- updated_at, este UPDATE también fallaba silenciosamente como en
    -- products. Al removerla hacemos el path robusto sin importar el
    -- schema real de product_variants.
    UPDATE public.product_variants
       SET stock_quantity = GREATEST(0, stock_quantity - p_quantity)
     WHERE product_id = p_product_id
       AND organization_id = p_organization_id
       AND is_default = true;

    GET DIAGNOSTICS v_variant_updated = ROW_COUNT;
    v_variant_updated := v_variant_updated > 0;

    RETURN QUERY SELECT
        p_product_id,
        v_previous_stock,
        v_new_stock,
        v_previous_stock >= p_quantity,
        v_variant_updated;
END;
$$;

COMMENT ON FUNCTION public.decrement_product_stock(uuid, uuid, integer) IS
$comment$Decrementa stock de un producto de forma atómica con row-level lock. Clampa a 0 sin fallar (devuelve was_sufficient=false para auditar). Sincroniza variant_default.stock_quantity si existe. Usada en webhooks de pagos y createOrder para flujos COD/manual. Fase 0.4 hardening + hotfix 20260421b (Bug H post-mortem: eliminada referencia a products.updated_at inexistente).$comment$;

-- 2. restore_product_stock (FIX: sin updated_at)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.restore_product_stock(
    p_product_id uuid,
    p_organization_id uuid,
    p_quantity integer
)
RETURNS TABLE (
    product_id uuid,
    previous_stock integer,
    new_stock integer,
    variant_updated boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_previous_stock integer;
    v_new_stock integer;
    v_variant_updated boolean := false;
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

    SELECT stock
      INTO v_previous_stock
      FROM public.products
     WHERE id = p_product_id
       AND organization_id = p_organization_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'product % not found in organization %',
            p_product_id, p_organization_id;
    END IF;

    v_previous_stock := COALESCE(v_previous_stock, 0);
    v_new_stock := v_previous_stock + p_quantity;

    -- FIX: sin updated_at (columna no existe en products)
    UPDATE public.products
       SET stock = v_new_stock
     WHERE id = p_product_id
       AND organization_id = p_organization_id;

    -- FIX: sin updated_at (simetría y seguridad)
    UPDATE public.product_variants
       SET stock_quantity = stock_quantity + p_quantity
     WHERE product_id = p_product_id
       AND organization_id = p_organization_id
       AND is_default = true;

    GET DIAGNOSTICS v_variant_updated = ROW_COUNT;
    v_variant_updated := v_variant_updated > 0;

    RETURN QUERY SELECT
        p_product_id,
        v_previous_stock,
        v_new_stock,
        v_variant_updated;
END;
$$;

COMMENT ON FUNCTION public.restore_product_stock(uuid, uuid, integer) IS
$comment$Restaura stock de un producto (reverso de decrement_product_stock). Usada en el flujo futuro de cancelación de órdenes COD/manual. Fase 0.4 hardening + hotfix 20260421b (Bug H post-mortem: eliminada referencia a products.updated_at inexistente).$comment$;

-- 3. Permisos
-- ============================================================================
-- GRANT EXECUTE ya estaba aplicado por la migración anterior — no es necesario
-- re-otorgar. Dejamos los GRANTS por idempotencia en caso de un entorno limpio.
GRANT EXECUTE ON FUNCTION public.decrement_product_stock(uuid, uuid, integer)
    TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.restore_product_stock(uuid, uuid, integer)
    TO authenticated, service_role;

-- ============================================================================
-- Fin de migración 20260421b_decrement_product_stock_fix_columns.sql
-- ============================================================================
