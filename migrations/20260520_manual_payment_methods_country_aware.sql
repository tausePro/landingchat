-- =============================================================================
-- i18n Fase 1 / T1.5: manual_payment_methods country-aware
-- =============================================================================
--
-- Contexto:
--   La tabla `manual_payment_methods` fue diseñada para tenants colombianos:
--     - `account_type` enum 'ahorros' | 'corriente' (terminología CO).
--     - `nequi_number` columna específica para Nequi (servicio CO).
--     - Sin campo libre para instrucciones del merchant.
--   Tantor's House (US) necesita Zelle / CashApp / ACH y no aplica el modelo
--   colombiano. Esta migración extiende el schema sin romper compat con
--   tenants existentes.
--
-- Decisión (2026-05-20):
--   1. Ampliar `account_type` para aceptar 'checking' y 'savings' (US).
--      Tenants CO siguen usando 'ahorros' / 'corriente' sin cambios.
--   2. Agregar `instructions` TEXT nullable: textarea libre donde el merchant
--      escribe instrucciones de pago en su idioma (markdown-lite).
--   3. Agregar `instant_payment_label` (TEXT, e.g. 'Zelle', 'CashApp', 'PayPal',
--      'Nequi', 'Daviplata') + `instant_payment_value` (TEXT, e.g. email,
--      phone, handle). Reemplaza conceptualmente al campo legacy
--      `nequi_number` que queda DEPRECATED pero conservado para retro-compat.
--   4. Backfill: para rows con `nequi_number` no nulo, copiar a los nuevos
--      campos con label='Nequi'. Se ejecuta sólo si los nuevos campos están
--      vacíos para no pisar configuración manual posterior.
--
-- Garantías:
--   - Aditiva: agrega columnas con DEFAULT NULL.
--   - Idempotente: `IF NOT EXISTS` en cada ADD COLUMN.
--   - Backward compatible: `nequi_number` se mantiene para no romper código
--     existente que aún lo lee. Se quitará en migración futura cuando todo
--     el código consuma `instant_payment_*`.
--   - Sin cambios en RLS: las nuevas columnas heredan políticas existentes.
--
-- Spec: .kiro/specs/i18n-fase-1/ (T1.5)
-- Branch: feat/i18n-fase-1
-- =============================================================================

BEGIN;

-- ===== account_type: extender enum a checking / savings =====
-- account_type es TEXT con CHECK constraint, no un PG enum. Reemplazamos
-- el CHECK para incluir los nuevos valores US.

ALTER TABLE manual_payment_methods
    DROP CONSTRAINT IF EXISTS manual_payment_methods_account_type_check;

ALTER TABLE manual_payment_methods
    ADD CONSTRAINT manual_payment_methods_account_type_check
    CHECK (
        account_type IS NULL
        OR account_type IN ('ahorros', 'corriente', 'checking', 'savings')
    );

COMMENT ON COLUMN manual_payment_methods.account_type IS
    'Tipo de cuenta bancaria. CO: ''ahorros'' | ''corriente''. '
    'US: ''checking'' | ''savings''. NULL si bank_transfer no está habilitado. '
    'Ampliar el CHECK al agregar nuevos países. Introducido CO en v1.x.x; '
    'extensión US en v1.14.0 (2026-05-20).';

-- ===== instructions =====

ALTER TABLE manual_payment_methods
    ADD COLUMN IF NOT EXISTS instructions TEXT;

COMMENT ON COLUMN manual_payment_methods.instructions IS
    'Texto libre con instrucciones de pago que el merchant escribe en su '
    'idioma (markdown-lite). Se muestra al cliente en el checkout cuando '
    'elige pago manual. Útil para horarios, referencias, restricciones, etc. '
    'Introducido en v1.14.0 (2026-05-20).';

-- ===== instant_payment_* (Zelle, CashApp, Nequi, Daviplata, etc.) =====

ALTER TABLE manual_payment_methods
    ADD COLUMN IF NOT EXISTS instant_payment_label TEXT;

ALTER TABLE manual_payment_methods
    ADD COLUMN IF NOT EXISTS instant_payment_value TEXT;

COMMENT ON COLUMN manual_payment_methods.instant_payment_label IS
    'Nombre del servicio de pago instantáneo (e.g. ''Zelle'', ''CashApp'', '
    '''PayPal'', ''Nequi'', ''Daviplata''). NULL si no se usa este método. '
    'Reemplaza conceptualmente al campo deprecated `nequi_number`. '
    'Introducido en v1.14.0 (2026-05-20).';

COMMENT ON COLUMN manual_payment_methods.instant_payment_value IS
    'Identificador del servicio (email, teléfono, handle, etc.). '
    'Validado por el merchant, no por el sistema. NULL si no se usa. '
    'Introducido en v1.14.0 (2026-05-20).';

-- ===== nequi_number: marcar como deprecated en el comment =====

COMMENT ON COLUMN manual_payment_methods.nequi_number IS
    'DEPRECATED en v1.14.0 (2026-05-20). Usar `instant_payment_label` + '
    '`instant_payment_value`. Conservado para retro-compat hasta que el '
    'código deje de leer este campo. Backfilleado a `instant_payment_*` '
    'con label=''Nequi'' por la misma migración.';

-- ===== Backfill: nequi_number → instant_payment_* =====
-- Sólo si los nuevos campos están vacíos para no pisar configuración manual.

UPDATE manual_payment_methods
SET
    instant_payment_label = 'Nequi',
    instant_payment_value = nequi_number
WHERE
    nequi_number IS NOT NULL
    AND nequi_number <> ''
    AND instant_payment_label IS NULL
    AND instant_payment_value IS NULL;

COMMIT;
