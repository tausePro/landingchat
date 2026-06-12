-- =============================================================================
-- Addons del marketplace por organización (Admin C — ficha 360)
-- =============================================================================
--
-- El marketplace tenía items (marketplace_items) pero ninguna forma de
-- asignarlos a un tenant. Esta tabla es la asignación: qué addon tiene
-- cada org, a qué precio pactado y en qué estado.
--
-- Aditiva e idempotente. RLS: el tenant LEE sus addons; escritura solo
-- service role (la gestiona el equipo de plataforma desde el admin).
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS organization_addons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    marketplace_item_id UUID NOT NULL REFERENCES marketplace_items(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    -- Precio mensual pactado en COP; NULL = precio de lista del item
    price_override NUMERIC(12, 2),
    notes TEXT,
    assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, marketplace_item_id)
);

CREATE INDEX IF NOT EXISTS idx_org_addons_org ON organization_addons(organization_id);

COMMENT ON TABLE organization_addons IS
    'Asignación de items del marketplace a organizaciones (gestionada por el equipo de plataforma)';

ALTER TABLE organization_addons ENABLE ROW LEVEL SECURITY;

-- El tenant puede VER sus addons
DROP POLICY IF EXISTS "org_members_read_own_addons" ON organization_addons;
CREATE POLICY "org_members_read_own_addons" ON organization_addons
    FOR SELECT USING (organization_id = get_my_org_id());

-- Escritura: solo service role (sin policies de INSERT/UPDATE/DELETE)

COMMIT;
