-- ============================================================================
-- Migración: product_variants (Fase 1 — Commerce Core Reset)
-- Fecha: 2026-03-31
-- Tipo: ADITIVA, REVERSIBLE, NO DESTRUCTIVA
-- Ref: docs-private/RFC_PRICING_VARIANTS_PROMOTIONS.md §5.1, §6
-- ============================================================================
--
-- Esta migración:
--   - Crea la tabla product_variants como nueva fuente de verdad futura
--   - Backfillea una variante "default" por cada producto existente
--   - NO modifica ni elimina columnas legacy de products
--   - NO cambia ningún consumer productivo
--   - Es segura para ejecutar en producción sin downtime
--
-- Reversión:
--   DROP TABLE IF EXISTS product_variants;
--
-- ============================================================================

-- 1. Crear tabla product_variants
-- ============================================================================
CREATE TABLE IF NOT EXISTS product_variants (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Identidad de la variante
    title text NOT NULL DEFAULT 'Default',
    sku text,
    position integer NOT NULL DEFAULT 0,
    is_default boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,

    -- Pricing target (RFC §5.2)
    -- price = precio de venta actual
    -- compare_at_price = precio comparativo opcional (antes: price cuando hay sale_price)
    price numeric(12, 2) NOT NULL DEFAULT 0,
    compare_at_price numeric(12, 2),

    -- Inventario
    stock_quantity integer NOT NULL DEFAULT 0,

    -- Media
    image_url text,

    -- Combinación de opciones como JSONB para Fase 1
    -- En fases posteriores esto se moverá a tablas relacionales
    -- Formato: [{"option_name": "Color", "value": "Rojo"}, {"option_name": "Talla", "value": "XL"}]
    option_values jsonb NOT NULL DEFAULT '[]'::jsonb,

    -- Auditoría
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT product_variants_price_positive CHECK (price >= 0),
    CONSTRAINT product_variants_compare_at_valid CHECK (
        compare_at_price IS NULL OR compare_at_price > price
    ),
    CONSTRAINT product_variants_stock_positive CHECK (stock_quantity >= 0)
);

-- 2. Índices
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id
    ON product_variants(product_id);

CREATE INDEX IF NOT EXISTS idx_product_variants_organization_id
    ON product_variants(organization_id);

CREATE INDEX IF NOT EXISTS idx_product_variants_sku
    ON product_variants(sku)
    WHERE sku IS NOT NULL;

-- Índice único: solo una variante default por producto
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_variants_default_unique
    ON product_variants(product_id)
    WHERE is_default = true;

-- 3. RLS (Row Level Security)
-- ============================================================================
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

-- Sin policy de lectura pública en Fase 1.
-- Nadie productivo depende todavía de product_variants.
-- La lectura pública se habilitará en la fase donde storefront/chat/SEO consuman esta tabla.

-- Escritura solo para miembros de la organización,
-- validando además que el product_id pertenezca a la misma org.
DROP POLICY IF EXISTS "product_variants_org_insert" ON product_variants;
CREATE POLICY "product_variants_org_insert"
    ON product_variants FOR INSERT
    WITH CHECK (
        organization_id = get_my_org_id()
        AND EXISTS (
            SELECT 1
            FROM products p
            WHERE p.id = product_id
              AND p.organization_id = get_my_org_id()
        )
    );

DROP POLICY IF EXISTS "product_variants_org_update" ON product_variants;
CREATE POLICY "product_variants_org_update"
    ON product_variants FOR UPDATE
    USING (
        organization_id = get_my_org_id()
        AND EXISTS (
            SELECT 1
            FROM products p
            WHERE p.id = product_id
              AND p.organization_id = get_my_org_id()
        )
    )
    WITH CHECK (
        organization_id = get_my_org_id()
        AND EXISTS (
            SELECT 1
            FROM products p
            WHERE p.id = product_id
              AND p.organization_id = get_my_org_id()
        )
    );

DROP POLICY IF EXISTS "product_variants_org_delete" ON product_variants;
CREATE POLICY "product_variants_org_delete"
    ON product_variants FOR DELETE
    USING (
        organization_id = get_my_org_id()
        AND EXISTS (
            SELECT 1
            FROM products p
            WHERE p.id = product_id
              AND p.organization_id = get_my_org_id()
        )
    );

-- 4. Trigger para updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_product_variants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_product_variants_updated_at ON product_variants;
CREATE TRIGGER trigger_product_variants_updated_at
    BEFORE UPDATE ON product_variants
    FOR EACH ROW
    EXECUTE FUNCTION update_product_variants_updated_at();

-- 5. Backfill: crear variante "default" para cada producto existente
-- ============================================================================
-- Estrategia conservadora:
--   - Solo crea variantes donde NO existe ya una variante default
--   - Idempotente: re-ejecutar es seguro
--   - Mapeo de precios según RFC §10.2 Caso A:
--     - Si existe sale_price < price → variant.price = sale_price, variant.compare_at_price = price
--     - Si no → variant.price = price, variant.compare_at_price = NULL
--   - stock y sku se copian directamente
-- ============================================================================
INSERT INTO product_variants (
    product_id,
    organization_id,
    title,
    sku,
    position,
    is_default,
    is_active,
    price,
    compare_at_price,
    stock_quantity,
    image_url,
    option_values
)
SELECT
    p.id AS product_id,
    p.organization_id,
    'Default' AS title,
    p.sku,
    0 AS position,
    true AS is_default,
    COALESCE(p.is_active, true) AS is_active,
    -- Mapeo de precio según RFC §5.2 y §10.2 Caso A
    CASE
        WHEN p.sale_price IS NOT NULL AND p.sale_price > 0 AND p.sale_price < p.price
        THEN p.sale_price
        ELSE p.price
    END AS price,
    CASE
        WHEN p.sale_price IS NOT NULL AND p.sale_price > 0 AND p.sale_price < p.price
        THEN p.price
        ELSE NULL
    END AS compare_at_price,
    COALESCE(p.stock, 0) AS stock_quantity,
    p.image_url,
    '[]'::jsonb AS option_values
FROM products p
WHERE NOT EXISTS (
    SELECT 1 FROM product_variants pv
    WHERE pv.product_id = p.id AND pv.is_default = true
);
