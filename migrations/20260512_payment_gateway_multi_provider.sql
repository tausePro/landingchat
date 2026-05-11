-- Migración: alinear payment_gateway_configs con el nuevo registry de pasarelas
-- Fecha: 2026-05-12
--
-- Cambios:
--   1. Agrega columnas que el código ya escribe pero la tabla no tenía:
--        - events_secret_encrypted: secret para validar firma de webhooks Wompi
--          (Wompi distingue integrity_secret del widget vs events_secret del webhook)
--        - encryption_key_encrypted: P_ENCRYPTION_KEY de ePayco
--   2. Amplía el CHECK del provider para incluir Bold y Addi
--      (sin esto, no se pueden insertar configuraciones para esos proveedores
--       aunque el registry/Zod ya los soporten).
--
-- Garantías de seguridad para producción:
--   - Idempotente: se puede correr varias veces sin efecto adicional.
--   - Atómica: todo va dentro de una transacción. Si algo falla, rollback completo.
--   - Sin rewrite: las columnas nuevas son TEXT NULL sin DEFAULT, así que en
--     PostgreSQL ≥ 11 son operaciones de metadata, no reescriben la tabla.
--   - El nuevo CHECK es estrictamente más permisivo que el viejo: cualquier valor
--     ya existente ('wompi' o 'epayco') sigue siendo válido, así que el ADD
--     CONSTRAINT no puede fallar por filas pre-existentes.
--
-- Validación post-deploy (manual):
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'payment_gateway_configs'
--      AND column_name IN ('events_secret_encrypted', 'encryption_key_encrypted');
--   -- debe devolver 2 filas
--
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conrelid = 'payment_gateway_configs'::regclass AND contype = 'c';
--   -- debe contener: CHECK (provider = ANY (ARRAY['wompi', 'epayco', 'bold', 'addi']))

BEGIN;

-- 1. Columnas faltantes -------------------------------------------------------
ALTER TABLE payment_gateway_configs
    ADD COLUMN IF NOT EXISTS events_secret_encrypted TEXT;

ALTER TABLE payment_gateway_configs
    ADD COLUMN IF NOT EXISTS encryption_key_encrypted TEXT;

COMMENT ON COLUMN payment_gateway_configs.events_secret_encrypted
    IS 'Secret de Eventos de Wompi (encriptado). Se usa SOLO para validar firma de webhooks. Distinto de integrity_secret_encrypted, que firma el widget.';
COMMENT ON COLUMN payment_gateway_configs.encryption_key_encrypted
    IS 'P_ENCRYPTION_KEY de ePayco (encriptado). Requerido para algunos endpoints de la API privada de ePayco.';

-- 2. Ampliar CHECK de provider -----------------------------------------------
--
-- Estrategia en dos pasos para máxima robustez:
--   a) DROP por nombre default que asigna PostgreSQL a CHECKs inline
--      (`<table>_<column>_check`). Esto cubre el caso normal.
--   b) Si quedó algún CHECK sobre la columna `provider` con otro nombre
--      (por ejemplo si fue creado manualmente con otro identifier), lo
--      buscamos por la columna referenciada (no por texto, que es frágil).

ALTER TABLE payment_gateway_configs
    DROP CONSTRAINT IF EXISTS payment_gateway_configs_provider_check;

DO $$
DECLARE
    leftover_constraint TEXT;
BEGIN
    -- Buscar cualquier CHECK constraint que referencie la columna `provider`.
    -- conkey es el array de attnums de columnas que el constraint cubre.
    SELECT c.conname INTO leftover_constraint
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid
     AND a.attnum = ANY(c.conkey)
    WHERE c.conrelid = 'payment_gateway_configs'::regclass
      AND c.contype = 'c'
      AND a.attname = 'provider'
    LIMIT 1;

    IF leftover_constraint IS NOT NULL THEN
        EXECUTE format(
            'ALTER TABLE payment_gateway_configs DROP CONSTRAINT %I',
            leftover_constraint
        );
    END IF;
END $$;

ALTER TABLE payment_gateway_configs
    ADD CONSTRAINT payment_gateway_configs_provider_check
    CHECK (provider IN ('wompi', 'epayco', 'bold', 'addi'));

COMMIT;
