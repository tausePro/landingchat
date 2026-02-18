# Seguridad — LandingChat

> Última actualización: 2026-02-18
> Consolidación de: SECURITY_AUDIT_REPORT.md, SECURITY_FIXES_SUMMARY.md, CRITICAL_SECURITY_ACTION_PLAN.md

## Estado actual

### ✅ Corregido y verificado
- **chats** — Policy `USING(true)` reemplazada por `organization_id = get_my_org_id()` (migración `20241204_fix_security_policies.sql`)
- **messages** — Mismo fix, acceso restringido a la org del usuario
- **system_settings** — Lectura pública, escritura solo superadmin
- **Rutas test eliminadas** — `/api/test`, `/api/test-claude`, `/api/test-nuby`, `/api/debug/domain`, `/api/webhooks/whatsapp/test` (commit d20884e, 2026-02-17)
- **Admin endpoints asegurados** — `/api/admin/whatsapp/force-sync` y `/sync` ahora requieren auth superadmin

### ⚠️ Vulnerabilidades confirmadas (auditoría 2026-02-18)
> Resultado de `scripts/audit-database.sql` Query 3 ejecutada en producción.

| Tabla | Policy peligrosa | Operación | Fix |
|-------|-----------------|-----------|-----|
| `chats` | `Public can access chats` USING(true) | **ALL** (CRUD) | `migrations/20260218_fix_chats_messages_rls.sql` |
| `messages` | `Public can access messages` USING(true) | **ALL** (CRUD) | `migrations/20260218_fix_chats_messages_rls.sql` |

### ✅ Tablas que ya estaban corregidas (verificado en producción)
- `carts`, `orders`, `customers`, `agents` — NO tienen policies USING(true)
- Las 48 tablas públicas tienen RLS habilitado (0 sin RLS)
- `properties`, `integrations`, `integration_sync_logs` — RLS ON, policies correctas

## Función helper

```sql
-- get_my_org_id() — Definida en 20241124_schema.sql
-- Retorna organization_id del usuario autenticado desde profiles
-- SECURITY DEFINER para evitar recursión con RLS
```

## Reglas de uso de clientes Supabase

| Cliente | Cuándo usar | RLS |
|---------|------------|-----|
| `createClient()` | Server components, server actions, API routes autenticadas | ✅ Respeta RLS |
| `createServiceClient()` | Webhooks, background jobs, pagos, migraciones | ❌ Bypasa RLS |
| `createBrowserClient()` | Componentes React del cliente | ✅ Respeta RLS |

**Regla**: si el código corre en nombre de un usuario → `createClient()`. Si corre en nombre del sistema → `createServiceClient()`.

## Patrones RLS correctos

### Tablas privadas (solo org admin)
```sql
CREATE POLICY "Org admins manage X" ON tabla FOR ALL 
  USING (organization_id = get_my_org_id());
```

### Tablas mixtas (admin + público limitado)
```sql
-- Admin gestiona todo de su org
CREATE POLICY "Org admins manage X" ON tabla FOR ALL 
  USING (organization_id = get_my_org_id());
-- Público puede crear (checkout, chat)
CREATE POLICY "Public can create X" ON tabla FOR INSERT 
  WITH CHECK (true);
-- Público lee con filtro (NO usar USING(true) en tablas sensibles)
CREATE POLICY "Public view active X" ON products FOR SELECT 
  USING (is_active = true);
```

### Tablas de catálogo (lectura pública OK)
```sql
CREATE POLICY "Public read X" ON tabla FOR SELECT USING (true);
CREATE POLICY "Org admins manage X" ON tabla FOR ALL 
  USING (organization_id = get_my_org_id());
```

## Template para nuevas migraciones

```sql
-- 1. Crear tabla con organization_id
CREATE TABLE IF NOT EXISTS nombre (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id uuid REFERENCES organizations(id) NOT NULL,
    created_at timestamptz DEFAULT NOW() NOT NULL,
    updated_at timestamptz DEFAULT NOW() NOT NULL
);

-- 2. Habilitar RLS SIEMPRE
ALTER TABLE nombre ENABLE ROW LEVEL SECURITY;

-- 3. Policies (DROP IF EXISTS para idempotencia)
DROP POLICY IF EXISTS "Org admins manage nombre" ON nombre;
CREATE POLICY "Org admins manage nombre" ON nombre
    FOR ALL USING (organization_id = get_my_org_id());

-- 4. Índice en organization_id SIEMPRE
CREATE INDEX IF NOT EXISTS idx_nombre_org ON nombre(organization_id);
```

## Checklist pre-commit para migraciones

- [ ] `ENABLE ROW LEVEL SECURITY` presente
- [ ] Ninguna policy `USING (true)` en tablas sensibles
- [ ] `DROP POLICY IF EXISTS` antes de cada `CREATE POLICY`
- [ ] Índice en `organization_id`
- [ ] `createServiceClient()` solo en webhooks/background jobs

## Herramienta de auditoría

Ejecutar `scripts/audit-database.sql` en Supabase SQL Editor para verificar estado real.
