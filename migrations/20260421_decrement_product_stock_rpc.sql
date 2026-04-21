-- ============================================================================
-- Migración: RPC atómica decrement_product_stock + restore_product_stock
-- Fecha: 2026-04-21
-- Tipo: ADITIVA, REVERSIBLE, NO DESTRUCTIVA
-- Ref: docs-private/PUNCHLIST_HARDENING_PLATAFORMA_2026-04.md §0.7 (Bug H)
-- Ref: docs-private/TORRE_DE_CONTROL_EJECUCION.md §13.4c
-- ============================================================================
--
-- Contexto:
--   Bug H (zero-day descubierto 2026-04-21): los webhooks de Wompi y ePayco
--   consultan la tabla `order_items` que NO EXISTE en la base. El SELECT JOIN
--   falla silenciosamente, `data` queda null, el `if (order)` salta y nada del
--   post-payment se ejecuta: stock no decrementa, notificaciones no se envían
--   desde webhook, Meta CAPI no dispara. Resultado: en la historia operativa
--   de LandingChat ninguna venta ha decrementado stock.
--
--   Bug B (race): el decrement actual de los webhooks es SELECT → compute →
--   UPDATE en Node, sin lock. Dos webhooks concurrentes pueden leer el mismo
--   stock y sobrescribir, perdiendo decrementos.
--
--   Bug A (variantes): el decrement actual solo toca products.stock, nunca
--   product_variants.stock_quantity. Hoy queda mitigado porque el backfill de
--   variantes default aún no ha corrido en producción, pero el fix debe
--   cubrir variantes default cuando existan.
--
--   Bug C (COD/manual): pagos manuales y contraentrega nunca decrementan
--   stock (no existe flujo markAsPaid). Fix aplicado en createOrder con
--   decremento inmediato al crear la orden (opción A aprobada por el usuario).
--
-- Esta migración:
--   - Crea la función decrement_product_stock(p_product_id, p_organization_id, p_quantity)
--   - Crea la función restore_product_stock(p_product_id, p_organization_id, p_quantity)
--   - Ambas son atómicas usando SELECT ... FOR UPDATE (row lock)
--   - Actualizan products.stock y (si existe variante default) product_variants.stock_quantity
--   - Validan que el producto pertenezca a la organización indicada
--   - Son idempotentes (rerunarlas es seguro: CREATE OR REPLACE)
--
-- Reversión:
--   DROP FUNCTION IF EXISTS public.decrement_product_stock(uuid, uuid, integer);
--   DROP FUNCTION IF EXISTS public.restore_product_stock(uuid, uuid, integer);
--
-- ============================================================================

-- 1. decrement_product_stock
-- ============================================================================
-- Decrementa stock de un producto de forma atómica. Nunca deja stock en
-- negativo (clamp con GREATEST). Sincroniza también la variante default si
-- existe. Retorna el estado previo/nuevo y si el stock disponible era
-- suficiente para cubrir la cantidad pedida, para que el caller pueda loggear
-- sobreventa (pero NO rechaza la operación: el inventario ya se clampeó).
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
    -- Validaciones de entrada
    IF p_product_id IS NULL THEN
        RAISE EXCEPTION 'product_id cannot be null';
    END IF;
    IF p_organization_id IS NULL THEN
        RAISE EXCEPTION 'organization_id cannot be null';
    END IF;
    IF p_quantity IS NULL OR p_quantity < 1 THEN
        RAISE EXCEPTION 'quantity must be >= 1, got %', p_quantity;
    END IF;

    -- Lock exclusivo sobre la fila del producto hasta el fin de la transacción.
    -- Cualquier otra sesión que intente UPDATE o SELECT FOR UPDATE sobre el
    -- mismo product_id queda bloqueada hasta que esta función termine. Esto
    -- cierra la race condition del Bug B.
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

    -- COALESCE por si algún producto legacy tiene stock NULL
    v_previous_stock := COALESCE(v_previous_stock, 0);
    v_new_stock := GREATEST(0, v_previous_stock - p_quantity);

    UPDATE public.products
       SET stock = v_new_stock,
           updated_at = now()
     WHERE id = p_product_id
       AND organization_id = p_organization_id;

    -- Sincronizar variante default si existe. No bloqueamos si no hay
    -- variante (producto sin backfill Fase 1) — simplemente devolvemos
    -- variant_updated = false.
    UPDATE public.product_variants
       SET stock_quantity = GREATEST(0, stock_quantity - p_quantity),
           updated_at = now()
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
$comment$Decrementa stock de un producto de forma atómica con row-level lock. Clampa a 0 sin fallar (devuelve was_sufficient=false para auditar). Sincroniza variant_default.stock_quantity si existe. Usada en webhooks de pagos y createOrder para flujos COD/manual. Fase 0.4 hardening (Bug H).$comment$;

-- 2. restore_product_stock (reverso)
-- ============================================================================
-- Restaura stock al cancelar órdenes. Incrementa sin clamp máximo — la
-- responsabilidad del caller es no invocarla con cantidades irrazonables.
-- Útil para el flujo futuro de cancelación de órdenes COD/manual que ya
-- decrementaron stock al crearse.
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

    UPDATE public.products
       SET stock = v_new_stock,
           updated_at = now()
     WHERE id = p_product_id
       AND organization_id = p_organization_id;

    UPDATE public.product_variants
       SET stock_quantity = stock_quantity + p_quantity,
           updated_at = now()
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
$comment$Restaura stock de un producto (reverso de decrement_product_stock). Usada en el flujo futuro de cancelación de órdenes COD/manual. Fase 0.4 hardening (Bug H).$comment$;

-- 3. Permisos de ejecución
-- ============================================================================
-- Tanto el service_role (usado en webhooks + createOrder con service client)
-- como authenticated (futuras actions del dashboard) pueden ejecutar las RPCs.
-- El chequeo de organization_id dentro de la función actúa como guardia de
-- tenant isolation: aunque un usuario autenticated invoque la RPC con un
-- product_id que no pertenece a su org, el WHERE no matchea y se lanza
-- "product not found in organization".
GRANT EXECUTE ON FUNCTION public.decrement_product_stock(uuid, uuid, integer)
    TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.restore_product_stock(uuid, uuid, integer)
    TO authenticated, service_role;

-- 4. Flag de idempotencia en orders
-- ============================================================================
-- Agregamos `stock_decremented_at` a orders para marcar cuándo el decremento
-- ocurrió. El caller (decrementOrderStock en TS) chequea este flag antes de
-- decrementar: si ya hay timestamp, omite la operación y devuelve
-- { skipped: true, reason: 'already_decremented' }.
--
-- Esto cubre:
--   - Webhooks Wompi/ePayco: reintentos del gateway después de un fallo parcial
--     de processOrderUpdate (e.g. crash entre decrement y commit de status)
--   - createOrder COD: imposible de llamar 2 veces para la misma orden porque
--     el insert es atómico, pero aún así el flag funciona como double-check
--   - Flujo futuro de cancelación: permite saber si hay stock que restaurar
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS stock_decremented_at timestamptz;

-- Índice parcial para consultas futuras del tipo "órdenes con/sin decrement"
CREATE INDEX IF NOT EXISTS idx_orders_stock_decremented_at
    ON public.orders(stock_decremented_at)
    WHERE stock_decremented_at IS NOT NULL;

COMMENT ON COLUMN public.orders.stock_decremented_at IS
$comment$Timestamp en que el stock fue decrementado para esta orden. NULL = nunca decrementado (esperable en órdenes previas a Fase 0.4). Se fija desde decrementOrderStock() en webhooks de pagos y createOrder COD. Fase 0.4 hardening (Bug H).$comment$;

-- ============================================================================
-- Fin de migración 20260421_decrement_product_stock_rpc.sql
-- ============================================================================
