# Schema de Base de Datos - Vertical Inmobiliaria

## Fecha: 2025-01-29

⚠️ **IMPORTANTE: Este schema es NO DESTRUCTIVO y seguro para producción**
- Usa `CREATE TABLE IF NOT EXISTS`
- Usa `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
- Usa `DROP POLICY IF EXISTS` antes de crear políticas
- No elimina ni modifica datos existentes

Este documento describe el schema necesario para implementar la vertical inmobiliaria en LandingChat.

## 1. Tabla: integrations

Almacena las credenciales y configuración de integraciones externas (Nuby, Odoo, etc.)

```sql
CREATE TABLE IF NOT EXISTS integrations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider text NOT NULL, -- 'nuby', 'odoo', 'woocommerce', etc.
    status text NOT NULL DEFAULT 'disconnected', -- 'connected', 'disconnected', 'error'
    credentials jsonb NOT NULL DEFAULT '{}', -- Credenciales encriptadas
    config jsonb NOT NULL DEFAULT '{}', -- Configuración específica del proveedor
    last_sync_at timestamptz,
    sync_enabled boolean DEFAULT true,
    error_message text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(organization_id, provider)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_integrations_org ON integrations(organization_id);
CREATE INDEX IF NOT EXISTS idx_integrations_provider ON integrations(provider);
CREATE INDEX IF NOT EXISTS idx_integrations_status ON integrations(status);

-- RLS Policies
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their org's integrations" ON integrations;
CREATE POLICY "Users can view their org's integrations"
    ON integrations FOR SELECT
    USING (organization_id = get_my_org_id());

DROP POLICY IF EXISTS "Users can manage their org's integrations" ON integrations;
CREATE POLICY "Users can manage their org's integrations"
    ON integrations FOR ALL
    USING (organization_id = get_my_org_id());

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS integrations_updated_at ON integrations;
CREATE TRIGGER integrations_updated_at
    BEFORE UPDATE ON integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_integrations_updated_at();
```

## 2. Tabla: properties

Almacena propiedades inmobiliarias sincronizadas desde sistemas externos (Nuby, etc.)

```sql
CREATE TABLE IF NOT EXISTS properties (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    product_id uuid REFERENCES products(id) ON DELETE SET NULL, -- Link opcional a producto
    
    -- Identificadores externos
    external_id text NOT NULL, -- ID en el sistema externo (Nuby, Odoo)
    external_code text NOT NULL, -- Código de propiedad (ej: "ARR-137")
    external_url text, -- URL en el sistema externo
    
    -- Información básica
    title text NOT NULL,
    description text,
    property_type text NOT NULL, -- 'arriendo', 'venta', 'venta y arriendo'
    property_class text, -- 'Apartamento', 'Casa', 'Finca', etc.
    status text NOT NULL DEFAULT 'active', -- 'active', 'inactive', 'reserved', 'rented', 'sold'
    
    -- Precios
    price_rent numeric(12,2),
    price_sale numeric(12,2),
    price_admin numeric(12,2), -- Administración
    
    -- Ubicación
    country text,
    department text,
    city text,
    neighborhood text,
    address text,
    coordinates point, -- PostGIS point (lat, lng)
    
    -- Características
    bedrooms integer,
    bathrooms integer,
    area_m2 numeric(10,2),
    floor_number integer,
    parking_spots integer,
    age_years integer,
    stratum text, -- Estrato socioeconómico (Colombia)
    
    -- Características adicionales (checkboxes, etc.)
    features jsonb DEFAULT '[]', -- Array de características
    
    -- Multimedia
    images jsonb DEFAULT '[]', -- Array de URLs de imágenes
    videos jsonb DEFAULT '[]', -- Array de videos (YouTube, etc.)
    
    -- Documentos
    requirements_pdf_url text, -- PDF de requisitos para arrendar
    
    -- Propietarios
    owners jsonb DEFAULT '[]', -- Array de propietarios
    
    -- Metadata
    is_featured boolean DEFAULT false,
    external_data jsonb DEFAULT '{}', -- Datos completos del sistema externo
    synced_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    UNIQUE(organization_id, external_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_properties_org ON properties(organization_id);
CREATE INDEX IF NOT EXISTS idx_properties_external_code ON properties(external_code);
CREATE INDEX IF NOT EXISTS idx_properties_type ON properties(property_type);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_city ON properties(city);
CREATE INDEX IF NOT EXISTS idx_properties_price_rent ON properties(price_rent);
CREATE INDEX IF NOT EXISTS idx_properties_price_sale ON properties(price_sale);
CREATE INDEX IF NOT EXISTS idx_properties_bedrooms ON properties(bedrooms);
CREATE INDEX IF NOT EXISTS idx_properties_coordinates ON properties USING gist(coordinates);

-- RLS Policies
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their org's properties" ON properties;
CREATE POLICY "Users can view their org's properties"
    ON properties FOR SELECT
    USING (organization_id = get_my_org_id());

DROP POLICY IF EXISTS "Users can manage their org's properties" ON properties;
CREATE POLICY "Users can manage their org's properties"
    ON properties FOR ALL
    USING (organization_id = get_my_org_id());

-- Public read for storefront
DROP POLICY IF EXISTS "Public can view active properties" ON properties;
CREATE POLICY "Public can view active properties"
    ON properties FOR SELECT
    USING (status = 'active');

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_properties_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS properties_updated_at ON properties;
CREATE TRIGGER properties_updated_at
    BEFORE UPDATE ON properties
    FOR EACH ROW
    EXECUTE FUNCTION update_properties_updated_at();
```

## 3. Tabla: property_appointments

Almacena citas agendadas para ver propiedades

```sql
CREATE TABLE IF NOT EXISTS property_appointments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
    
    -- Información del cliente
    customer_name text NOT NULL,
    customer_email text NOT NULL,
    customer_phone text NOT NULL,
    
    -- Detalles de la cita
    appointment_date timestamptz NOT NULL,
    duration_minutes integer DEFAULT 60,
    status text NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'
    notes text,
    
    -- Integración con Google Calendar
    google_calendar_event_id text,
    
    -- Metadata
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_appointments_org ON property_appointments(organization_id);
CREATE INDEX IF NOT EXISTS idx_appointments_property ON property_appointments(property_id);
CREATE INDEX IF NOT EXISTS idx_appointments_customer ON property_appointments(customer_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON property_appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON property_appointments(status);

-- RLS Policies
ALTER TABLE property_appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their org's appointments" ON property_appointments;
CREATE POLICY "Users can view their org's appointments"
    ON property_appointments FOR SELECT
    USING (organization_id = get_my_org_id());

DROP POLICY IF EXISTS "Users can manage their org's appointments" ON property_appointments;
CREATE POLICY "Users can manage their org's appointments"
    ON property_appointments FOR ALL
    USING (organization_id = get_my_org_id());

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_appointments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS appointments_updated_at ON property_appointments;
CREATE TRIGGER appointments_updated_at
    BEFORE UPDATE ON property_appointments
    FOR EACH ROW
    EXECUTE FUNCTION update_appointments_updated_at();
```

## 4. Tabla: integration_sync_logs

Logs de sincronización para debugging

```sql
CREATE TABLE IF NOT EXISTS integration_sync_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    sync_type text NOT NULL, -- 'full', 'incremental', 'manual'
    status text NOT NULL, -- 'started', 'success', 'error'
    items_processed integer DEFAULT 0,
    items_created integer DEFAULT 0,
    items_updated integer DEFAULT 0,
    items_failed integer DEFAULT 0,
    error_message text,
    error_details jsonb,
    
    started_at timestamptz DEFAULT now(),
    completed_at timestamptz
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_sync_logs_integration ON integration_sync_logs(integration_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_org ON integration_sync_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON integration_sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_sync_logs_started ON integration_sync_logs(started_at DESC);

-- RLS Policies
ALTER TABLE integration_sync_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their org's sync logs" ON integration_sync_logs;
CREATE POLICY "Users can view their org's sync logs"
    ON integration_sync_logs FOR SELECT
    USING (organization_id = get_my_org_id());
```

## 5. Extensión de tabla organizations

Agregar configuración específica para inmobiliarias

```sql
-- ⚠️ SEGURO: Solo agrega columna si no existe, no modifica datos existentes
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS vertical_config jsonb DEFAULT '{}';

-- Ejemplo de estructura para vertical_config:
-- {
--   "vertical": "real_estate",
--   "real_estate": {
--     "working_hours": {
--       "monday": { "start": "09:00", "end": "18:00" },
--       "tuesday": { "start": "09:00", "end": "18:00" },
--       ...
--     },
--     "appointment_duration": 60,
--     "google_calendar_id": "...",
--     "requirements_pdf_url": "..."
--   }
-- }
```

## Notas de Implementación

### Seguridad
- Todas las tablas tienen RLS habilitado
- Las credenciales en `integrations.credentials` deben encriptarse usando la función `encrypt()` de `src/lib/utils/encryption.ts`
- Las políticas permiten acceso solo a la organización propietaria

### Sincronización
- La tabla `properties` almacena una copia local de las propiedades desde Nuby
- El campo `external_data` guarda el JSON completo de Nuby para referencia
- La sincronización puede ser automática (webhook) o manual (cron job)

### Búsqueda
- Los índices en `properties` permiten búsquedas rápidas por ubicación, precio, características
- El índice GiST en `coordinates` permite búsquedas geoespaciales

### Próximos Pasos
1. Aplicar esta migración en Supabase
2. Implementar funciones de encriptación para credenciales
3. Crear cliente de Nuby API
4. Implementar herramientas AI para búsqueda de propiedades
5. Crear vista de Integraciones en dashboard
