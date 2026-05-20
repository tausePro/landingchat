-- =============================================================================
-- i18n Fase 1 / T1.1: organizations.currency_code + locale + country_code
-- =============================================================================
--
-- Contexto:
--   Tantors House (cliente nuevo, USD/en-US) y Tausornamentos (futuro driver
--   de Fase 2) requieren que cada tenant pueda operar con un idioma + moneda
--   + pais distintos al default colombiano. VISION 2026 difirio "multi-moneda
--   real" (con conversion dinamica) pero permite "single-locale-per-tenant"
--   con precios cargados manualmente — eso es lo que esta migracion habilita.
--
-- Decision (2026-05-19):
--   Solo COP/es-CO/CO + USD/en-US/US en CHECK por ahora. Ampliar a MX/ES/BR
--   con migracion adicional cuando aparezcan tenants concretos.
--
-- Garantias:
--   - Aditiva: agrega columnas con NOT NULL + DEFAULT seguro. Tenants
--     existentes quedan en COP/es-CO/CO automaticamente sin tocar UI.
--   - Idempotente: `IF NOT EXISTS` en ADD COLUMN.
--   - CHECK constraints garantizan que solo valores validos pueden insertarse.
--   - Sin cambios en RLS: las nuevas columnas heredan las politicas existentes
--     de `organizations` que filtran por `id = get_my_org_id()`.
--   - Sin cambios en otras tablas: products, orders, payment_gateway_configs,
--     etc. siguen funcionando identico. La parametrizacion del codigo entra
--     en T1.2 (formatCurrency) y siguientes slices.
--
-- Spec: .kiro/specs/i18n-fase-1/
-- Branch: feat/i18n-fase-1
-- =============================================================================

BEGIN;

-- ===== currency_code =====

ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS currency_code TEXT NOT NULL DEFAULT 'COP';

-- DROP + ADD del CHECK para hacerlo idempotente (re-aplicar la migracion no falla).
ALTER TABLE organizations
    DROP CONSTRAINT IF EXISTS organizations_currency_code_check;

ALTER TABLE organizations
    ADD CONSTRAINT organizations_currency_code_check
    CHECK (currency_code IN ('COP', 'USD'));

COMMENT ON COLUMN organizations.currency_code IS
    'ISO 4217 currency code para precios y pagos del tenant. '
    'Default ''COP''. Valores permitidos en Fase 1: COP, USD. '
    'Ampliar el CHECK al agregar MX/ES/BR. Introducido en v1.14.0 (2026-05-19).';

-- ===== locale =====

ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'es-CO';

ALTER TABLE organizations
    DROP CONSTRAINT IF EXISTS organizations_locale_check;

ALTER TABLE organizations
    ADD CONSTRAINT organizations_locale_check
    CHECK (locale IN ('es-CO', 'en-US'));

COMMENT ON COLUMN organizations.locale IS
    'BCP 47 locale para formato de numeros, fechas y strings i18n del tenant. '
    'Default ''es-CO''. Valores permitidos en Fase 1: es-CO, en-US. '
    'Ampliar el CHECK al agregar es-MX, es-ES, pt-BR. Introducido en v1.14.0.';

-- ===== country_code =====

ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS country_code TEXT NOT NULL DEFAULT 'CO';

ALTER TABLE organizations
    DROP CONSTRAINT IF EXISTS organizations_country_code_check;

ALTER TABLE organizations
    ADD CONSTRAINT organizations_country_code_check
    CHECK (country_code IN ('CO', 'US'));

COMMENT ON COLUMN organizations.country_code IS
    'ISO 3166-1 alpha-2 country code del tenant. '
    'Drives el shape de formularios country-aware (departamento/ciudad para CO, '
    'state/zip para US). Default ''CO''. Valores permitidos en Fase 1: CO, US. '
    'Introducido en v1.14.0 (2026-05-19).';

COMMIT;

-- ===== VERIFICACION POST-MIGRACION =====
--
-- Tras correr esta migracion, estas queries deben devolver lo esperado:
--
-- 1) Todas las organizaciones existentes en defaults seguros (regresion zero):
--    SELECT count(*) AS no_defaults
--    FROM organizations
--    WHERE currency_code != 'COP' OR locale != 'es-CO' OR country_code != 'CO';
--    -- Debe devolver 0 (porque la migracion es la primera; no hay overrides aun).
--
-- 2) Las nuevas columnas tienen NOT NULL y default correcto:
--    SELECT column_name, data_type, is_nullable, column_default
--    FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'organizations'
--      AND column_name IN ('currency_code', 'locale', 'country_code');
--
-- 3) Los CHECK constraints estan presentes:
--    SELECT conname, pg_get_constraintdef(oid)
--    FROM pg_constraint
--    WHERE conrelid = 'public.organizations'::regclass
--      AND conname IN (
--        'organizations_currency_code_check',
--        'organizations_locale_check',
--        'organizations_country_code_check'
--      );
