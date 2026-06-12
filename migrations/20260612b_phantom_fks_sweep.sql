-- =============================================================================
-- Barrido de FKs fantasma → organizations (patrón de 20260611b, consolidado)
-- =============================================================================
-- v2 (corregida): el primer intento falló por carts_customer_id_fkey — el
-- mapeo de referencias a customers estaba incompleto. Mapa COMPLETO
-- verificado en prod (2026-06-12) para los 5 customers huérfanos:
--   carts              1 referencia  → se elimina (data muerta de org borrada)
--   chats             19 referencias → SET NULL (chats de orgs vivas, se conservan)
--   orders             0
--   store_transactions 0
--   coupon_usage       0
--   product_reviews    0 (además ya es ON DELETE SET NULL)
--
-- Contexto: 5 tablas multi-tenant sin FK a organizations → PostgREST no
-- resuelve sus JOINs embebidos (admin de Suscripciones roto) y sin
-- integridad referencial se acumulan huérfanas.
--   subscriptions / coupons / payment_gateway_configs / shipping_settings:
--   0 huérfanas. customers: 5 (de orgs borradas, sin órdenes).
--
-- La transacción anterior hizo ROLLBACK completo — nada quedó a medias.
-- =============================================================================

BEGIN;

-- 1. Eliminar carts de customers huérfanos (1 verificado; sin tablas hijas)
DELETE FROM carts
WHERE customer_id IN (
    SELECT c.id FROM customers c
    WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = c.organization_id)
);

-- 2. Desvincular chats que referencian customers huérfanos (19 verificados;
--    los chats pertenecen a orgs vivas y se conservan)
UPDATE chats SET customer_id = NULL
WHERE customer_id IN (
    SELECT c.id FROM customers c
    WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = c.organization_id)
);

-- 3. Eliminar los customers huérfanos (5 verificados, 0 órdenes/transacciones)
DELETE FROM customers c
WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = c.organization_id);

-- 4. Crear las FKs faltantes (idempotente)
DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN
        SELECT * FROM (VALUES
            ('subscriptions'),
            ('customers'),
            ('coupons'),
            ('payment_gateway_configs'),
            ('shipping_settings')
        ) AS tables(table_name)
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = t.table_name || '_organization_id_fkey'
              AND table_name = t.table_name
        ) THEN
            EXECUTE format(
                'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE',
                t.table_name,
                t.table_name || '_organization_id_fkey'
            );
        END IF;
    END LOOP;
END $$;

-- 5. Refrescar el schema cache de PostgREST (habilita los joins embebidos)
NOTIFY pgrst, 'reload schema';

COMMIT;
