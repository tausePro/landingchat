-- ============================================================
-- Migration DOCUMENTATIVA: product_reviews + product_engagement_events
--
-- Fecha de creación real en producción: 26 marzo 2026
--   (creadas directamente desde el SQL editor de Supabase en la rama
--    feature/product-seo-visibility que luego fue borrada, perdiendo la migration)
--
-- Fecha de documentación en git: 22 abril 2026
--
-- ============================================================
-- ⚠️ ESTAS TABLAS YA EXISTEN EN PRODUCCIÓN. Esta migration NO las crea
--    nuevamente, solo deja el schema versionado en git.
--
--    Todas las sentencias usan IF NOT EXISTS / DROP IF EXISTS → idempotente.
--    Correrla en producción es NO-OP (no afecta datos ni estructura existentes).
-- ============================================================
--
-- ¿Por qué existe este archivo?
--   1. Reproducibilidad: un dev nuevo que clone el repo y levante un Supabase
--      desde cero (staging, preview branch, CI) obtiene estas tablas al correr
--      las migrations.
--   2. Documentación: el schema queda versionado y revisable sin abrir Supabase.
--   3. Convención del proyecto (ver AGENTS.md).
--
-- ¿Qué contiene?
--   1. Sistema de reseñas verificadas de productos (verified_purchase basado en
--      order_id cuando el cliente efectivamente compró).
--   2. Tracking de eventos de engagement (page_view, view_content, add_to_cart,
--      initiate_checkout, purchase) para analítica de conversión por producto.
-- ============================================================

-- ============================================================
-- 1. TABLA: product_reviews
--    Reseñas de productos con verificación de compra
-- ============================================================

CREATE TABLE IF NOT EXISTS public.product_reviews (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    product_id          UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    customer_id         UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    order_id            UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    author_name         TEXT NOT NULL,
    author_role         TEXT,
    title               TEXT,
    content             TEXT NOT NULL,
    rating              INTEGER NOT NULL,
    verified_purchase   BOOLEAN NOT NULL DEFAULT false,
    is_published        BOOLEAN NOT NULL DEFAULT false,
    source              TEXT NOT NULL DEFAULT 'manual',
    published_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT product_reviews_rating_check CHECK (rating >= 1 AND rating <= 5),
    CONSTRAINT product_reviews_source_check CHECK (source IN ('manual', 'imported', 'customer_form'))
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_product_reviews_org_id
    ON public.product_reviews USING btree (organization_id);

CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id
    ON public.product_reviews USING btree (product_id);

CREATE INDEX IF NOT EXISTS idx_product_reviews_product_published
    ON public.product_reviews USING btree (product_id, is_published, created_at DESC);

-- RLS
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_members_manage_product_reviews ON public.product_reviews;
CREATE POLICY org_members_manage_product_reviews
    ON public.product_reviews
    FOR ALL
    USING (organization_id = get_my_org_id())
    WITH CHECK (organization_id = get_my_org_id());

DROP POLICY IF EXISTS public_view_published_product_reviews ON public.product_reviews;
CREATE POLICY public_view_published_product_reviews
    ON public.product_reviews
    FOR SELECT
    USING (is_published = true);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION public.set_product_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_product_reviews_updated_at ON public.product_reviews;
CREATE TRIGGER trg_product_reviews_updated_at
    BEFORE UPDATE ON public.product_reviews
    FOR EACH ROW
    EXECUTE FUNCTION public.set_product_reviews_updated_at();

COMMENT ON TABLE public.product_reviews IS 
    'Reseñas de productos. verified_purchase=true implica order_id válido asociado. Solo las con is_published=true son visibles en storefront público.';

COMMENT ON COLUMN public.product_reviews.source IS 
    'Origen de la reseña: manual (creada por admin), imported (importada externamente), customer_form (formulario de cliente post-compra)';

-- ============================================================
-- 2. TABLA: product_engagement_events
--    Eventos de tracking para analítica de conversión por producto
-- ============================================================

CREATE TABLE IF NOT EXISTS public.product_engagement_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    product_id          UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    customer_id         UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    visitor_id          UUID,
    event_type          TEXT NOT NULL,
    source_path         TEXT,
    referrer            TEXT,
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT product_engagement_events_event_type_check 
        CHECK (event_type IN ('page_view', 'view_content', 'add_to_cart', 'initiate_checkout', 'purchase'))
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_product_engagement_events_org_id
    ON public.product_engagement_events USING btree (organization_id);

CREATE INDEX IF NOT EXISTS idx_product_engagement_events_product_id
    ON public.product_engagement_events USING btree (product_id);

CREATE INDEX IF NOT EXISTS idx_product_engagement_events_product_type_time
    ON public.product_engagement_events USING btree (product_id, event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_engagement_events_visitor_id
    ON public.product_engagement_events USING btree (visitor_id);

-- RLS
ALTER TABLE public.product_engagement_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_members_view_product_engagement_events ON public.product_engagement_events;
CREATE POLICY org_members_view_product_engagement_events
    ON public.product_engagement_events
    FOR SELECT
    USING (organization_id = get_my_org_id());

DROP POLICY IF EXISTS service_role_manage_product_engagement_events ON public.product_engagement_events;
CREATE POLICY service_role_manage_product_engagement_events
    ON public.product_engagement_events
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.product_engagement_events IS 
    'Eventos de engagement por producto. Service role inserta (desde API público), miembros de org pueden leer. visitor_id es UUID anónimo client-side para tracking sin autenticación.';

COMMENT ON COLUMN public.product_engagement_events.event_type IS 
    'Tipos: page_view (vista de página), view_content (interacción con contenido), add_to_cart, initiate_checkout, purchase';

COMMENT ON COLUMN public.product_engagement_events.metadata IS 
    'Info contextual del producto al momento del evento: productName, productBrand, primaryCategory, hasFaq, hasBenefits, isConfigurable, hasSpecifications, hasQuantityPricing';
