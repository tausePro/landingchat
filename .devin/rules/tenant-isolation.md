---
trigger: always_on
description: Reglas no negociables de aislamiento multi-tenant en LandingChat
---

# Tenant Isolation (siempre activa)

LandingChat es multi-tenant por subdominio. Cada request debe respetar el aislamiento de datos entre organizaciones.

## Reglas

1. **RLS obligatorio**: cada tabla nueva debe tener RLS habilitado y políticas que filtren por `organization_id` usando `get_my_org_id()`.
2. **Nunca `USING (true)`** en tablas sensibles: `customers`, `orders`, `payment_gateway_configs`, `webhook_logs`, `subscriptions`, `messages`.
3. **`createServiceClient()` solo cuando es absolutamente necesario** (webhooks, jobs, server-side admin). Cada uso debe estar documentado en el commit y/o en `docs-private/`.
4. **Identificar `organization_id` desde el slug del subdominio** vía `src/proxy.ts`. NUNCA hardcodear `organization_id` en código de aplicación.
5. **NO romper `src/proxy.ts`**. Cualquier cambio al routing de subdominios requiere review humano y validación contra el set de tenants reales.
6. **URLs**: usar `getStoreLink()` y `getChatUrl()` desde `src/lib/utils/urls.ts`. Nunca hardcodear `landingchat.co` ni el slug.

## Antes de mergear cambios que tocan multi-tenancy

- Verificar políticas RLS con `scripts/db-audit-rls.sql`
- Probar el flujo en al menos 2 tenants reales (ej. `tez`, `quality-pets`)
- Asegurar que `get_my_org_id()` devuelve el ID correcto en el contexto

## Referencias

- `docs/AGENTS_GUIDE.md` — Multi-tenancy
- `docs-private/MANDATO_PRODUCTO_Y_ARQUITECTURA.md` — Arquitectura
- `docs-private/DOMAIN_MAP_VERTICALS.md` — Dominios y verticales
