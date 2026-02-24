# Arquitectura Modular — LandingChat

> Documento de referencia para la transformación modular de la plataforma.
> Última actualización: 20 Febrero 2026 (verificado con SQL en producción)
> Agent-factory integrado con planes: Julio 2025

---

## 1. Estado Actual de Producción

### 1.1 Infraestructura de módulos existente (verificado 20-Feb-2026)

| Componente | Estado | Ubicación |
|-----------|--------|----------|
| `module_definitions` (BD) | ✅ 13 módulos, 9 columnas básicas | Tabla Supabase |
| `organizations.enabled_modules` | ✅ text[] por org | Columna en organizations |
| `organizations.vertical_config` | ✅ jsonb disponible | Columna en organizations |
| `organizations.industry` | ✅ ecommerce/real_estate/other | Columna en organizations |
| `industry_templates` (BD) | ✅ 3 verticales con defaults | Tabla Supabase |
| `subscriptions.features` | ✅ jsonb con flags boolean | Columna en subscriptions |
| `src/types/industry.ts` | ✅ Tipos, enums, helpers | Código TypeScript |
| `dashboard-layout.tsx` | ✅ Menú dinámico por módulos | Componente React |
| `marketplace_items` (BD) | ⚠️ Tabla vacía, schema viejo | Tabla Supabase |
| `plans` (BD) | ✅ 6 planes (4 activos, 2 inactivos) | Tabla Supabase |
| `org_modules` (BD) | ❌ NO EXISTE | — |
| `src/lib/modules/` | ❌ NO EXISTE | — |

#### Columnas actuales de `module_definitions` (verificado SQL)
```
id (uuid), slug (text), name (text), description (text), icon (text),
menu_path (text), menu_order (integer), is_core (boolean), created_at (timestamptz)
```
**Faltan:** category, min_plan_tier, monthly_price, is_marketplace_visible, config_schema, dependencies, ai_tools, status

#### Plans en producción (verificado SQL)
| Plan | Slug | Precio COP | Activo | Founding Tier |
|------|------|-----------|--------|---------------|
| Plan Gratuito | free | $0 | ✅ | — |
| Starter | starter | $149.000 | ✅ | starter |
| Pro | pro | $249.000 | ❌ | — |
| Growth | growth | $299.000 | ✅ | growth |
| Premium | premium | $499.000 | ✅ | premium |
| Enterprise | enterprise | $599.000 | ❌ | — |

### 1.1.1 Estado de Seguridad (verificado 20-Feb-2026)

#### RLS en chats/messages — ✅ CORREGIDO
Policies peligrosas `USING (true)` eliminadas. Policies actuales:
- **chats:** 5 policies (SELECT org, SELECT anon 24h, INSERT public, UPDATE org, Agents SELECT public)
- **messages:** 4 policies (SELECT org, SELECT anon chat, INSERT public, Agents SELECT public)
- ⚠️ Policies "Agents can view..." con roles `{public}` — revisar USING clause

#### RLS faltante — ❌ CRÍTICO
- `carts` — **0 policies** (RLS habilitado pero sin policies = acceso denegado a todos)
- `payment_transactions` — **0 policies** 
- `usage_metrics` — **0 policies**

#### Índices organization_id — ✅ 26 índices aplicados
Todas las tablas multi-tenant tienen índice en `organization_id`.

#### Rutas debug — ❌ PENDIENTE eliminar
- `src/app/api/fix-customers-table/`
- `src/app/api/fix-security-policies/`

### 1.2 Módulos actuales en `module_definitions`

#### Core (is_core: true) — Siempre activos
| Slug | Nombre | Menu Path |
|------|--------|-----------|
| `conversations` | Conversaciones | /dashboard/inbox |
| `customers` | Clientes | /dashboard/customers |
| `agent` | Agente IA | /dashboard/agent |
| `settings` | Configuración | /dashboard/settings |

#### Feature (is_core: false) — Activables por vertical/plan
| Slug | Nombre | Vertical | Menu Path |
|------|--------|----------|-----------|
| `products` | Productos | ecommerce | /dashboard/products |
| `orders` | Pedidos | ecommerce | /dashboard/orders |
| `shipping` | Envíos | ecommerce | /dashboard/marketing/shipping |
| `coupons` | Cupones | ecommerce | /dashboard/marketing/coupons |
| `payments` | Pagos | ecommerce | /dashboard/settings/payments |
| `properties` | Propiedades | real_estate | /dashboard/properties |
| `leads` | Leads | real_estate | /dashboard/leads |
| `appointments` | Citas | real_estate | /dashboard/appointments |
| `documents` | Documentos | real_estate | /dashboard/documents |

### 1.3 Organizaciones activas

| Org | Industry | Plan | Módulos |
|-----|----------|------|---------|
| tez | ecommerce | ✅ Activo (500 prod, 2 agents) | ecommerce defaults |
| Tause Admin | null | ✅ Activo (200 prod, 5 agents) | - |
| Casa Inmobiliaria | real_estate | 🔄 Trial (200 prod, 5 agents) | real_estate defaults |
| Quality Pets | ecommerce | ⚠️ Incomplete | ecommerce defaults |
| Sebastian | null | 🔄 Trial (10 prod, 1 agent) | free tier |
| Alivíate | ecommerce | ❌ Sin plan | - |
| Goldcaps | ecommerce | ❌ Sin plan | - |
| Demo Store | null | ❌ Sin plan | - |
| Latte | null | ❌ Sin plan | - |
| Tause-sm | other | ❌ Sin plan | - |
| Mónica Flores | null | ❌ Sin plan | - |

### 1.4 Datos reales en producción

| Tabla | Filas | Notas |
|-------|-------|-------|
| properties | 650 | Sincronizadas de Nuby |
| messages | 360 | Conversaciones reales |
| products | 266 | Productos de tiendas |
| webhook_logs | 144 | Historial de webhooks |
| customers | 132 | Clientes registrados |
| integration_sync_logs | 16 | Logs de sync Nuby |
| chats | 14 | Conversaciones activas |
| orders | 9 | Pedidos realizados |
| carts | 4 | Carritos activos |
| whatsapp_instances | 12 | Múltiples orgs |

---

## 2. Arquitectura Objetivo

### 2.1 Categorías de módulos

```
module_definitions
├── core          → Siempre activos (conversations, customers, agent, settings)
├── vertical      → Por industria (products, properties, orders, leads, etc.)
├── channel       → Canales de comunicación (whatsapp-evolution, whatsapp-meta, instagram-dm, messenger)
├── payment       → Pasarelas de pago del CLIENTE (wompi-gateway, epayco-gateway, mercadopago-gateway)
├── integration   → Integraciones externas (nuby, google-calendar, odoo, woocommerce)
├── agent_skill   → Habilidades del agente IA (product-search, cart-management, appointments, real-estate)
└── addon         → Features premium (analytics, custom-domain, landing-builder, proactive-agent)
```

### 2.2 Modelo de datos — Extensión de `module_definitions`

```sql
-- NUEVAS COLUMNAS (ALTER TABLE, no recrear)
ALTER TABLE module_definitions ADD COLUMN IF NOT EXISTS category text DEFAULT 'vertical';
ALTER TABLE module_definitions ADD COLUMN IF NOT EXISTS min_plan_tier integer DEFAULT 0;
ALTER TABLE module_definitions ADD COLUMN IF NOT EXISTS monthly_price numeric DEFAULT 0;
ALTER TABLE module_definitions ADD COLUMN IF NOT EXISTS is_marketplace_visible boolean DEFAULT false;
ALTER TABLE module_definitions ADD COLUMN IF NOT EXISTS config_schema jsonb DEFAULT '{}';
ALTER TABLE module_definitions ADD COLUMN IF NOT EXISTS dependencies text[] DEFAULT '{}';
ALTER TABLE module_definitions ADD COLUMN IF NOT EXISTS ai_tools text[] DEFAULT '{}';
ALTER TABLE module_definitions ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- Categorizar módulos existentes
-- Core
UPDATE module_definitions SET category = 'core' WHERE slug IN ('conversations', 'customers', 'agent', 'settings');
-- Vertical
UPDATE module_definitions SET category = 'vertical' WHERE slug IN ('products', 'properties', 'leads', 'orders', 'appointments', 'shipping', 'coupons', 'documents', 'payments');

-- AI tools por módulo
UPDATE module_definitions SET ai_tools = '{"search_products", "show_product", "get_product_availability"}' WHERE slug = 'products';
UPDATE module_definitions SET ai_tools = '{"add_to_cart", "get_cart", "remove_from_cart", "update_cart_quantity"}' WHERE slug = 'orders';
UPDATE module_definitions SET ai_tools = '{"start_checkout", "get_shipping_options", "confirm_shipping_details"}' WHERE slug = 'shipping';
UPDATE module_definitions SET ai_tools = '{"apply_discount"}' WHERE slug = 'coupons';
UPDATE module_definitions SET ai_tools = '{"search_properties", "show_property", "get_property_availability"}' WHERE slug = 'properties';
UPDATE module_definitions SET ai_tools = '{"create_appointment", "get_available_slots"}' WHERE slug = 'appointments';
UPDATE module_definitions SET ai_tools = '{"identify_customer", "get_customer_history"}' WHERE slug = 'customers';
UPDATE module_definitions SET ai_tools = '{"get_store_info", "get_order_status", "escalate_to_human"}' WHERE slug = 'conversations';
```

### 2.3 Nueva tabla: `org_modules`

```sql
CREATE TABLE IF NOT EXISTS org_modules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    module_id uuid NOT NULL REFERENCES module_definitions(id),
    is_active boolean DEFAULT true,
    config jsonb DEFAULT '{}',
    activated_at timestamptz DEFAULT now(),
    expires_at timestamptz,
    activated_by text DEFAULT 'system', -- 'system' | 'marketplace' | 'admin'
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(organization_id, module_id)
);

-- RLS
ALTER TABLE org_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org modules" ON org_modules
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Superadmin can manage all org modules" ON org_modules
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
    );

-- Índices
CREATE INDEX IF NOT EXISTS idx_org_modules_org ON org_modules(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_modules_active ON org_modules(organization_id, is_active);
```

### 2.4 Planes reales (seed data)

```sql
INSERT INTO plans (id, name, slug, price, currency, billing_period, max_products, max_agents, max_monthly_conversations, features, is_active)
VALUES
    (gen_random_uuid(), 'Free', 'free', 0, 'COP', 'monthly', 10, 1, 50,
     '{"whatsapp": false, "analytics": false, "custom_domain": false}'::jsonb, true),
    (gen_random_uuid(), 'Starter', 'starter', 49900, 'COP', 'monthly', 100, 2, 500,
     '{"whatsapp": true, "analytics": false, "custom_domain": false}'::jsonb, true),
    (gen_random_uuid(), 'Pro', 'pro', 149900, 'COP', 'monthly', 500, 5, 2000,
     '{"whatsapp": true, "analytics": true, "custom_domain": false}'::jsonb, true),
    (gen_random_uuid(), 'Enterprise', 'enterprise', 399900, 'COP', 'monthly', -1, -1, -1,
     '{"whatsapp": true, "analytics": true, "custom_domain": true}'::jsonb, true);

-- plan_tier mapping: free=0, starter=1, pro=2, enterprise=3
```

### 2.5 Módulos nuevos a insertar

```sql
-- Canales
INSERT INTO module_definitions (slug, name, description, icon, menu_path, menu_order, is_core, category, min_plan_tier, is_marketplace_visible, ai_tools)
VALUES
    ('whatsapp-evolution', 'WhatsApp (Evolution)', 'WhatsApp vía Evolution API', 'MessageCircle', NULL, 0, false, 'channel', 1, true, '{}'),
    ('whatsapp-meta', 'WhatsApp (Meta)', 'WhatsApp Business Cloud API', 'MessageCircle', NULL, 0, false, 'channel', 2, true, '{}'),
    ('instagram-dm', 'Instagram DM', 'Mensajes directos de Instagram', 'Instagram', NULL, 0, false, 'channel', 2, true, '{}'),
    ('messenger', 'Messenger', 'Facebook Messenger', 'Facebook', NULL, 0, false, 'channel', 2, true, '{}'),
    ('web-chat', 'Chat Web', 'Chat integrado en el sitio web', 'Globe', NULL, 0, true, 'channel', 0, false, '{}');

-- Payment Gateways (del CLIENTE para su landing)
INSERT INTO module_definitions (slug, name, description, icon, menu_path, menu_order, is_core, category, min_plan_tier, is_marketplace_visible, config_schema, dependencies)
VALUES
    ('wompi-gateway', 'Wompi', 'Pasarela de pagos Wompi (tarjetas, PSE, Nequi)', 'CreditCard', NULL, 0, false, 'payment', 1, true,
     '{"public_key": "string", "private_key": "string", "integrity_secret": "string", "sandbox": "boolean"}'::jsonb, '{"payments"}'),
    ('epayco-gateway', 'ePayco', 'Pasarela de pagos ePayco', 'CreditCard', NULL, 0, false, 'payment', 1, true,
     '{"public_key": "string", "private_key": "string", "p_cust_id_cliente": "string", "sandbox": "boolean"}'::jsonb, '{"payments"}'),
    ('mercadopago-gateway', 'MercadoPago', 'Pasarela de pagos MercadoPago', 'CreditCard', NULL, 0, false, 'payment', 1, true,
     '{"access_token": "string", "public_key": "string", "sandbox": "boolean"}'::jsonb, '{"payments"}');

-- Integraciones
INSERT INTO module_definitions (slug, name, description, icon, menu_path, menu_order, is_core, category, min_plan_tier, is_marketplace_visible, config_schema)
VALUES
    ('nuby-integration', 'Nuby/ArrendaSoft', 'Sincronización de propiedades inmobiliarias', 'RefreshCw', '/dashboard/integrations', 0, false, 'integration', 2, true,
     '{"instance": "string", "api_token": "string"}'::jsonb),
    ('google-calendar', 'Google Calendar', 'Sincronización de citas con Google Calendar', 'Calendar', '/dashboard/integrations', 0, false, 'integration', 1, true,
     '{"oauth_token": "string"}'::jsonb);

-- Addons premium
INSERT INTO module_definitions (slug, name, description, icon, menu_path, menu_order, is_core, category, min_plan_tier, monthly_price, is_marketplace_visible)
VALUES
    ('analytics', 'Analytics Avanzado', 'Dashboard de métricas y reportes avanzados', 'BarChart3', '/dashboard/analytics', 5, false, 'addon', 2, 0, true),
    ('custom-domain', 'Dominio Personalizado', 'Usa tu propio dominio para la tienda', 'Globe', NULL, 0, false, 'addon', 3, 0, true),
    ('landing-builder', 'Constructor de Landings', 'Editor visual drag & drop para páginas', 'Layout', '/dashboard/pages', 8, false, 'addon', 1, 29900, true),
    ('proactive-agent', 'Agente Proactivo', 'El agente inicia conversaciones según navegación', 'Zap', NULL, 0, false, 'addon', 2, 49900, true);
```

---

## 3. Separación de Billing vs Payment Gateways

### Problema actual
Wompi está duplicado: `src/lib/wompi/client.ts` (suscripciones) y `src/lib/payments/wompi-gateway.ts` (pagos de clientes).

### Solución

```
src/lib/
├── billing/                        ← NUESTRO sistema de cobro a clientes
│   ├── wompi-billing.ts            ← Renombrar de lib/wompi/client.ts
│   ├── types.ts                    ← Renombrar de lib/wompi/types.ts
│   └── subscription-manager.ts     ← Lógica de suscripciones
│
├── modules/
│   ├── registry.ts                 ← Lee module_definitions + org_modules
│   ├── types.ts                    ← Tipos centrales de módulos
│   ├── hooks.ts                    ← useModules(), useHasModule()
│   │
│   ├── payment-gateways/           ← Pasarelas de CLIENTES para su landing
│   │   ├── interface.ts            ← PaymentGateway interface
│   │   ├── wompi/
│   │   │   ├── gateway.ts          ← WompiGateway implements PaymentGateway
│   │   │   └── webhook.ts          ← Lógica de webhook Wompi
│   │   ├── epayco/
│   │   │   ├── gateway.ts
│   │   │   └── webhook.ts
│   │   └── registry.ts             ← getGateway(org_id) → gateway activo
│   │
│   ├── channels/                   ← Canales de comunicación
│   │   ├── interface.ts            ← ChannelAdapter interface
│   │   ├── whatsapp-evolution/
│   │   │   ├── adapter.ts
│   │   │   └── webhook.ts
│   │   ├── whatsapp-meta/
│   │   │   ├── adapter.ts
│   │   │   └── webhook.ts
│   │   ├── instagram-dm/
│   │   │   ├── adapter.ts
│   │   │   └── webhook.ts
│   │   ├── messenger/
│   │   │   ├── adapter.ts
│   │   │   └── webhook.ts
│   │   └── web-chat/
│   │       └── adapter.ts
│   │
│   ├── agent-skills/               ← Skills del agente como módulos
│   │   ├── interface.ts            ← AgentSkill interface
│   │   ├── product-search/
│   │   │   └── executor.ts         ← search_products, show_product, get_availability
│   │   ├── cart-management/
│   │   │   └── executor.ts         ← add_to_cart, get_cart, remove, update_qty
│   │   ├── checkout/
│   │   │   └── executor.ts         ← start_checkout, get_shipping, apply_discount
│   │   ├── customer-service/
│   │   │   └── executor.ts         ← get_order_status, get_history, escalate
│   │   ├── real-estate/
│   │   │   └── executor.ts         ← search_properties, schedule_visit
│   │   ├── appointments/
│   │   │   └── executor.ts         ← create_appointment, get_slots
│   │   └── registry.ts             ← getSkillsForOrg(org_id) → tools[]
│   │
│   └── integrations/               ← Integraciones externas
│       ├── interface.ts            ← Integration interface
│       ├── nuby/                   ← Mover de lib/nuby/
│       ├── google-calendar/
│       └── registry.ts
```

### Webhooks reorganizados

```
src/app/api/webhooks/
├── billing/
│   └── wompi/route.ts              ← NUESTRO cobro (suscripciones)
├── payments/
│   ├── wompi/route.ts              ← Pagos de CLIENTES (ya existe)
│   ├── epayco/route.ts
│   └── mercadopago/route.ts
├── channels/
│   ├── whatsapp-meta/route.ts      ← Unificar WhatsApp + Instagram + Messenger
│   └── whatsapp-evolution/route.ts
└── integrations/
    └── nuby/route.ts
```

---

## 4. Flujo del Agente con Módulos

### 4.1 Cómo se filtran tools por módulo activo

```typescript
// src/lib/modules/agent-skills/registry.ts

async function getToolsForOrg(orgId: string): Promise<Tool[]> {
    // 1. Leer módulos activos de la org
    const activeModules = await getActiveModules(orgId)

    // 2. Obtener ai_tools[] de cada módulo activo
    const enabledToolNames = activeModules
        .flatMap(m => m.ai_tools || [])

    // 3. Filtrar tools disponibles
    return ALL_TOOLS.filter(tool => enabledToolNames.includes(tool.name))
}
```

### 4.2 Antes (monolítico)
```
chat-agent.ts → tool-executor.ts (todas las 17 tools siempre)
```

### 4.3 Después (modular)
```
chat-agent.ts
  → registry.getToolsForOrg(orgId)    ← Solo tools de módulos activos
  → skill/executor.ts (específico)     ← Cada skill ejecuta sus tools
```

### 4.4 Implementación actual (completada)

El agent-factory ya está modularizado e integrado con el sistema de planes:

**Archivos de modo:**
```
src/lib/ai/
├── modes/
│   ├── shared.ts           → 5 tools compartidas (identify, escalate, store_info, order_status, history)
│   ├── ecommerce.ts        → 10 tools de e-commerce + prompt addendum
│   └── real-estate.ts      → 3 tools inmobiliarias + prompt addendum
├── agent-factory.ts        → Compone tools y prompts por modo (OrgContext)
├── chat-agent.ts           → Orquestador (carga industry + features + conteos)
├── tool-executor.ts        → Dispatcher unificado (sin cambios)
└── tools.ts                → Monolítico original (fallback de seguridad)
```

**Cadena de prioridad para determinar OrgMode:**
```
1. subscription.features    → { ecommerce: true, real_estate: true } (más confiable)
2. organization.industry    → "ecommerce" | "real_estate" | "other"
3. Conteo de filas          → productCount / propertyCount (fallback legacy)
```

**Interface OrgContext:**
```typescript
interface OrgContext {
    industry?: string | null          // organization.industry
    features?: Record<string, boolean> | null  // subscription.features
    productCount?: number             // fallback
    propertyCount?: number            // fallback
}
```

**Features de verticales en planes (AVAILABLE_FEATURES en admin):**
- `ecommerce` → Habilita tools de e-commerce
- `real_estate` → Habilita tools inmobiliarias
- `appointments` → Habilita agendamiento de citas

**UI Admin de agentes:**
- Nueva pestaña "Módulos" en `/dashboard/agents/[id]/config`
- Muestra modo activo, tools compartidas, y módulos verticales activos/inactivos
- Read-only (determinado por plan, no configurable por agente aún)

### 4.5 Fallback de compatibilidad

```typescript
async function getActiveModules(orgId: string): Promise<ModuleDefinition[]> {
    // 1. Intentar org_modules (nuevo)
    const { data: orgModules } = await supabase
        .from('org_modules')
        .select('module:module_definitions(*)')
        .eq('organization_id', orgId)
        .eq('is_active', true)

    if (orgModules?.length) return orgModules.map(om => om.module)

    // 2. Fallback: organizations.enabled_modules (actual)
    const { data: org } = await supabase
        .from('organizations')
        .select('enabled_modules')
        .eq('id', orgId)
        .single()

    if (org?.enabled_modules?.length) {
        const { data: modules } = await supabase
            .from('module_definitions')
            .select('*')
            .in('slug', org.enabled_modules)
        return modules || []
    }

    // 3. Último fallback: industry_templates defaults
    const { data: org2 } = await supabase
        .from('organizations')
        .select('industry')
        .eq('id', orgId)
        .single()

    const { data: template } = await supabase
        .from('industry_templates')
        .select('default_modules')
        .eq('slug', org2?.industry || 'ecommerce')
        .single()

    const { data: modules } = await supabase
        .from('module_definitions')
        .select('*')
        .in('slug', template?.default_modules || [])

    return modules || []
}
```

---

## 5. Marketplace Público

### 5.1 Flujo

```
1. Superadmin crea/activa módulos en module_definitions
   → Marca is_marketplace_visible = true
   → Asigna min_plan_tier y monthly_price

2. Cliente entra a /dashboard/marketplace
   → Ve módulos visibles filtrados por su plan_tier
   → Módulos gratuitos: activar con 1 click
   → Módulos de pago: flujo de pago (nuestro Wompi billing)

3. Al activar: INSERT INTO org_modules
   → organizations.enabled_modules se actualiza también (sync)
   → Menú se actualiza automáticamente
   → Tools del agente se actualizan en siguiente chat
```

### 5.2 UI del Marketplace

```
/dashboard/marketplace
├── Categorías: Canales | Pasarelas | Integraciones | Agent Skills | Addons
├── Card por módulo:
│   ├── Icono + Nombre + Descripción
│   ├── Precio (Incluido / $X/mes)
│   ├── Plan mínimo requerido
│   ├── Dependencias
│   └── Botón: Activar | Upgrade Plan | Comprar
└── Módulos activos con toggle para desactivar
```

---

## 6. Plan de Ejecución por Fases

### Fase 0 — Seguridad (1 día, riesgo CERO)

**Migraciones:**
- Agregar RLS policies a `carts`, `payment_transactions`, `usage_metrics`
- Restringir política "Public can access ALL" en `chats` y `messages`

**Código:**
- Eliminar rutas: `fix-customers-table`, `fix-security-policies`, `test-claude`, `test-nuby`, `test`
- NO afecta funcionalidad existente

### Fase 1 — Extender módulos + Plans (3-4 días, riesgo CERO)

**Migraciones:**
- `ALTER TABLE module_definitions` → agregar columnas nuevas
- `CREATE TABLE org_modules`
- `INSERT INTO plans` → 4 planes reales
- `UPDATE module_definitions` → categorizar los 13 existentes
- `INSERT INTO module_definitions` → módulos nuevos (canales, gateways, addons)

**Código:**
- `src/lib/modules/registry.ts` → CRUD de módulos
- `src/lib/modules/types.ts` → Tipos TypeScript
- Actualizar `src/types/industry.ts` → Extender ModuleDefinitionSchema
- Fallback completo: nuevo → enabled_modules → industry_templates

### Fase 2 — Separar billing + skills (1 semana, riesgo BAJO)

**Código:**
- Mover `lib/wompi/` → `lib/billing/`
- Reestructurar `lib/payments/` → `lib/modules/payment-gateways/`
- Dividir `tool-executor.ts` → `lib/modules/agent-skills/*/executor.ts`
- El tool-executor.ts actual se convierte en router

**Webhooks:**
- Renombrar `/api/webhooks/wompi/` → `/api/webhooks/billing/wompi/`
- Mantener URL antigua como redirect (no rompe Wompi configurado)

### Fase 3 — Menú dinámico + AI filtrado (4-5 días, riesgo BAJO)

**Código:**
- Actualizar `dashboard-layout.tsx` → leer de `org_modules` con fallback
- Actualizar `chat-agent.ts` → filtrar tools por módulos activos
- `buildDashboardMenu()` → usar `module_definitions` con nuevas columnas

### Fase 4 — Marketplace público (1 semana, riesgo BAJO)

**UI:**
- `/dashboard/marketplace/page.tsx` → Grid de módulos disponibles
- Server actions para activar/desactivar
- Sync con `organizations.enabled_modules`

### Fase 5 — Canales Meta unificados (2 semanas, riesgo MEDIO)

**Código:**
- Adapters: whatsapp-meta, instagram-dm, messenger
- Webhook unificado para los 3 (mismo App ID Meta)
- Contexto cross-channel en el agente

### Fase 6 — Agente proactivo (1 semana, riesgo BAJO)

- Tracking de navegación en storefront
- Triggers basados en comportamiento
- Quick actions contextuales
- "Continuar en WhatsApp"

### Fase 7 — Dashboard + Landing builder (ongoing)

- Widgets dinámicos por vertical
- Editor visual de secciones
- Templates de landing por industria

---

## 7. Reglas de Compatibilidad

1. **NUNCA** eliminar columnas o tablas existentes
2. **SIEMPRE** usar `IF NOT EXISTS` en migraciones
3. **SIEMPRE** mantener fallback al comportamiento actual
4. **NUNCA** cambiar URLs de webhooks sin redirect
5. `organizations.enabled_modules` se mantiene como cache/sync
6. Cada fase es independiente y reversible
7. Feature flags en `system_settings` para activar/desactivar fases

---

## 8. Prioridades de Negocio

| Prioridad | Feature | Impacto |
|-----------|---------|---------|
| 🔴 P0 | Seguridad (Fase 0) | Proteger datos existentes |
| 🔴 P0 | Plans + Módulos (Fase 1) | Base para monetización |
| 🟡 P1 | Billing separado (Fase 2) | Cobrar suscripciones correctamente |
| 🟡 P1 | Marketplace (Fase 4) | Ingresos adicionales |
| 🟢 P2 | Canales Meta (Fase 5) | Más reach para clientes |
| 🟢 P2 | Agente proactivo (Fase 6) | Diferenciador competitivo |
| 🔵 P3 | Dashboard + Builder (Fase 7) | UX mejorada |
