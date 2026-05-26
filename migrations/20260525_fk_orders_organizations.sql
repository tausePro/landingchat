-- =============================================================================
-- FK orders.organization_id -> organizations.id
-- =============================================================================
--
-- Contexto:
--   El commit T1.6 (2026-05-20) agrego un embedded resource `organizations(...)`
--   a la query SELECT de `applyPaymentStatusToOrder` para resolver locale +
--   currency + country del tenant al correr side effects (email order-paid,
--   Meta CAPI, etc.).
--
--   Sin FK declarada, PostgREST falla al embedder con error
--   "could not find a relationship between 'orders' and 'organizations'",
--   lo cual hace que `applyPaymentStatusToOrder` retorne success: false con
--   reason: "order_not_found" antes de ejecutar el UPDATE de payment_status.
--
--   Sintoma: en el dashboard, "Consultar pasarela" muestra toast verde
--   "Pago conciliado con Wompi: approved" pero la orden queda en
--   payment_status=pending porque el shortcut de `reconcileOrderPayment`
--   enmascaraba el error. Fix code-side aplicado en epayco-reconciliation.ts
--   (propagar result.success); fix DB-side es esta FK.
--
-- Garantias:
--   - Idempotente: DROP IF EXISTS antes de ADD.
--   - ON DELETE CASCADE alineado con el resto del schema (eliminar una org
--     borra sus orders, como ya pasa con customers, products, etc.).
--   - Antes de aplicar, verificar 0 huerfanos con la query Q4 del diagnostico.
--
-- Spec: docs-private/TORRE_DE_CONTROL_EJECUCION.md (incidente 2026-05-25)
-- =============================================================================

BEGIN;

-- Verificacion previa: NO debe haber orders con organization_id sin match
-- en organizations.id. Si hay, ADD CONSTRAINT fallara con detalle de fila.
DO $$
DECLARE
    orphan_count integer;
BEGIN
    SELECT COUNT(*) INTO orphan_count
    FROM orders o
    WHERE NOT EXISTS (
        SELECT 1 FROM organizations org WHERE org.id = o.organization_id
    );

    IF orphan_count > 0 THEN
        RAISE EXCEPTION 'Cannot add FK: % orphan orders found (organization_id without matching organizations.id)', orphan_count;
    END IF;
END $$;

-- DROP IF EXISTS para hacer la migracion re-aplicable sin error.
ALTER TABLE orders
    DROP CONSTRAINT IF EXISTS orders_organization_id_fkey;

ALTER TABLE orders
    ADD CONSTRAINT orders_organization_id_fkey
    FOREIGN KEY (organization_id)
    REFERENCES organizations(id)
    ON DELETE CASCADE;

COMMIT;

-- =============================================================================
-- VERIFICACION POST-MIGRACION
-- =============================================================================
--
-- 1) La FK existe:
--    SELECT conname, pg_get_constraintdef(oid)
--    FROM pg_constraint
--    WHERE conrelid = 'public.orders'::regclass
--      AND contype = 'f'
--      AND pg_get_constraintdef(oid) LIKE '%organization_id%';
--
-- 2) El embedded resource de Supabase funciona en applyPaymentStatusToOrder.
--    Probar desde el dashboard: "Consultar pasarela" sobre una orden
--    de QP en pending con store_transaction.status='approved'. El toast
--    debe decir "Pago conciliado con Wompi y eventos procesados" y el
--    badge debe pasar a "Pagado".
