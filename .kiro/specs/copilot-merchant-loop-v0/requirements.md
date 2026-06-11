# Copilot Merchant Loop v0 — Requirements

> **Estado**: En ejecución (aprobado por @tause 2026-06-10; T4.1 iniciado)
> **Branch destino**: `feat/copilot-merchant-loop-v0`
> **Documento estratégico**: `docs-private/ATLAS_VALUE_FIRST_PLAN_2026-05-21.md` §8 (Slice A4)
> **Fase plan**: Ola 1 — Slice A4 (post Fase 0.5)
> **Iniciado**: 2026-05-21
> **Esfuerzo estimado**: ~8.5 días (1 dev) o ~5 días (2 devs)
> **Release objetivo**: `v1.26.0` (minor por feature nuevo; el spec original decía v1.15.0 — la plataforma avanzó a v1.25.x antes de arrancar este slice)

---

## 1. Objetivo

Entregar al merchant LATAM un copilot proactivo que cada lunes 9am UTC-5 le manda por **WhatsApp Personal** un reporte semanal con:

- **3 insights** accionables sobre su tienda (qué pasó, qué cambió, qué oportunidad detecta).
- **1 acción concreta** propuesta por insight, que el merchant puede aprobar/rechazar desde `/dashboard/copilot` o respondiendo `"1"`, `"2"`, `"3"`, `"todas"` por WhatsApp (Nivel 2 con whitelist; Nivel 1 sólo lectura para v0).

Es la primera materialización del modelo Hermes en la plataforma: **AI proactivo que actúa por ti tras tu aprobación**, no reactivo que espera a que le pregunten.

## 2. Drivers reales

1. **Tez** — operación madura con WhatsApp activo. Métrica norte: lift en revenue mensual atribuible al copilot ≥8% Mes 1.
2. **Quality Pets (QP)** — operación madura sin WhatsApp activo. Métrica norte: % tráfico web que activa WhatsApp y convierte (baseline 0% → ≥20% handoff).
3. **Mandato §3.4** — "AI primera clase, no afterthought". Hoy AI sólo responde a inputs (`chat-agent.ts`); no inicia conversaciones.
4. **`VISION_2026 §4.6`** — Principio P6 "Workers/triggers proactivos" no implementado. Único cron real es trial expiry + property sync, no AI.

## 3. NO objetivos (explícitos)

- ❌ Builder visual del editor de copilot — es Ola 3 (`feat/visual-editor-v1`).
- ❌ Embeddings semánticos sobre eventos — sigue `ilike`. B2 lo activa.
- ❌ Marketing broadcasts masivos a clientes finales — es Ola 2 (B1 `feat/marketing-broadcasts-v1`). Copilot v0 sólo manda al **dueño/operador**, no a clientes.
- ❌ Multi-channel proactivo (Email + SMS + Instagram) — sólo WhatsApp Personal en v0. B4 unifica canales después.
- ❌ Generalizar el scheduler como infra (Inngest, Trigger.dev) — v0 usa Vercel Cron + Supabase, ya en uso. RFC formal pre-arranque (≤1d) confirma decisión.
- ❌ Aprendizaje automático de patrones (`LearnedSkill`) — es D3 en Ola 4.
- ❌ Reescribir `analytics_events` para que sea event-sourced — `platform_events` nace en paralelo, sin migrar el legacy.
- ❌ Embedding del copilot en el storefront del cliente final — copilot es **operador-facing**.

## 4. Alcance reducido (decisión 2026-05-21)

Tres dimensiones acotadas para no abrir frente más amplio del necesario:

| Dimensión | v0 | v1+ |
| --- | --- | --- |
| Cadencia | Semanal lunes 9am tenant timezone (default UTC-5 si null) | Daily, real-time triggers |
| Canal | WhatsApp Personal del merchant | + Email, SMS, dashboard inbox |
| Niveles autonomía | Level 1 (propose only) + Level 2 con whitelist mínima | Level 3 (full autonomy) post-aprendizaje |
| Acciones whitelist Level 2 | `send_coupon_to_customers`, `pause_product`, `enable_product`, `notify_owner` | + ajuste de precio, creación de producto, broadcast |
| Composer | Claude Haiku 4.5 (modelo único) | Cost ladder Hermes/Haiku/Sonnet (D2) |
| Tipos de insight | `weekly_recap` | + `daily_brief`, `cart_abandonment_burst`, `stock_low`, `new_visitor_pattern` |

**Razón:** entregar wow moment merchant en Mes 1 con scope acotado. Cada extensión post-v0 nace de un slice nuevo con su propia spec.

## 5. Requisitos funcionales

### RF1 — Tabla `platform_events` (event-sourced backbone)

Crear tabla nueva `platform_events` con:

- `id`, `organization_id` (FK + RLS), `event_type` (TEXT, sin CHECK estrecho — catálogo en TypeScript), `event_version` (INT default 1), `payload` (JSONB), `source` (TEXT: `web|whatsapp|webhook|system|copilot`), `actor_id` (TEXT nullable), `idempotency_key` (TEXT nullable, UNIQUE per org), `occurred_at`, `created_at`.
- RLS: `USING (organization_id = get_my_org_id())` para read; INSERT vía service role o función RPC controlada.
- Índice (`organization_id`, `event_type`, `occurred_at DESC`).
- Catálogo TS `src/lib/events/platform-event-types.ts` con los 12 tipos v0 (sec. 4 design).

`analytics_events` legacy queda intacta. **No** se migra ni reemplaza en v0.

### RF2 — Tabla `copilot_insights` (feed accionable)

Crear tabla nueva `copilot_insights` con:

- `id`, `organization_id` (FK + RLS), `generated_at`, `scope` (TEXT: `weekly|daily|on_demand` — sólo `weekly` en v0), `status` (TEXT CHECK `proposed|approved|executed|dismissed|expired`), `title`, `body` (markdown), `proposed_actions` (JSONB array), `metrics_snapshot` (JSONB), `decided_at`, `decided_by` (FK auth.users nullable), `decision_note`, `executed_at`, `expires_at`, `created_at`.
- RLS estricto por `organization_id`. Sólo miembros del org leen y deciden.
- Default `expires_at` = `generated_at + 7 days` (la insight de la semana pasada caduca cuando llega la nueva).

### RF3 — Niveles de autonomía declarativos por organización

Extender `organizations`:

- `copilot_autonomy_level TEXT NOT NULL DEFAULT 'level_1_propose' CHECK IN ('level_1_propose', 'level_2_act_with_whitelist', 'level_3_full_autonomy')`.
- En v0 el código sólo soporta Level 1 y Level 2 (con whitelist hardcoded de 4 acciones). Level 3 está reservado por contrato pero el ejecutor lo trata como Level 2 (= rechaza acciones fuera de whitelist).

Defaults: todos los tenants existentes quedan en `level_1_propose`. Level 2 se opt-in explícito desde `/dashboard/copilot/settings`.

### RF4 — Worker `weekly_insights` (cron lunes 9am tenant tz)

Endpoint `/api/cron/copilot/weekly-insights`:

- Auth con `CRON_SECRET` (mismo patrón que crons existentes).
- Schedule en `vercel.json`: `"0 14 * * 1"` (= lunes 14:00 UTC = 9:00 UTC-5). Tenant timezone respetada en v1; v0 asume UTC-5 fijo (Colombia, mayoría de tenants).
- Por cada org con `copilot_autonomy_level != 'level_1_propose'` ó con `notify_on_copilot_insight=true` en `whatsapp_instances` (Personal connected), llamar al composer.
- Persistir el insight en `copilot_insights` con `status='proposed'`.
- Disparar `notifications/whatsapp.ts:sendCopilotInsight()` con el WhatsApp Personal del owner.
- Idempotente por (`organization_id`, `scope='weekly'`, `iso_week`). Si ya hay un insight de la misma semana, skip.

### RF5 — Composer del insight con Claude Haiku 4.5

`src/lib/copilot/insightComposer.ts`:

- Carga métricas de la semana en curso vs anterior (orders count, revenue, conversations, carts abandoned, top products viewed, top products converted) vía SQL agregado.
- Pasa el contexto a Claude Haiku 4.5 con prompt en español (Tantor's House lo recibe en inglés vía `organization.locale`).
- Retorna `{ title, body, proposed_actions[] }` con shape estable validado por Zod.
- Cada `proposed_action` tiene `kind` (whitelist), `params`, `human_label`, `requires_approval`.
- Cap de tokens: 4k input, 1.5k output. Costo objetivo ≤ $0.01 USD por insight.
- Determinístico en métricas (mismo input = mismo output) para tests; LLM stub mockeado en tests.

### RF6 — Test e2e canal `notifications/whatsapp.ts` Personal

Antes de cerrar A4, validar e2e que el canal Personal funciona contra `whatsapp_instances` connected con `notify_on_copilot_insight=true`. Hoy `sendSaleNotification` y `sendLowStockNotification` ya funcionan; agregar `sendCopilotInsight` siguiendo mismo patrón + smoke test manual con un tenant de QA.

### RF7 — Página `/dashboard/copilot` (feed + decisión)

UI minimalista, mobile-first:

- Lista de insights `proposed` ordenados por `generated_at DESC`.
- Por cada uno: title + body markdown + chips de acciones propuestas con botones "Aprobar" / "Rechazar".
- Modal de confirmación al aprobar (muestra el efecto: "Se enviará cupón 15% a 3 clientes").
- Tab "Historial" con `executed | dismissed | expired`.
- Settings page `/dashboard/copilot/settings` para cambiar `copilot_autonomy_level` y togglear `notify_on_copilot_insight`.

Sin builder visual, sin AI inline en v0.

### RF8 — Action executor (Level 2 whitelist)

`src/lib/copilot/actionExecutor.ts`:

- Acepta una `proposed_action` aprobada y ejecuta sólo si:
  - El `kind` está en la whitelist v0.
  - El org tiene `copilot_autonomy_level = 'level_2_act_with_whitelist'` o aprobación manual del usuario (audit `decided_by`).
- Whitelist v0:
  - `send_coupon_to_customers` (params: `customer_ids[]`, `discount_percent`, `expires_in_days`).
  - `pause_product` (params: `product_id`).
  - `enable_product` (params: `product_id`).
  - `notify_owner` (params: `message`) — fallback no-op de prueba.
- Persistir `executed_at` + emitir evento `copilot.action_executed` en `platform_events`.
- Errores no rotan al usuario; quedan loggeados y el insight pasa a `dismissed` con `decision_note='execution_failed: <reason>'`.

### RF9 — `copilot.insight_*` events emitidos a `platform_events`

Todo cambio de estado (proposed → approved → executed | dismissed | expired) emite un `platform_event` correspondiente. Esto alimenta el feedback loop futuro (D3 LearnedSkills) sin acoplar v0 a esa fase.

## 6. Requisitos no funcionales

### RNF1 — Tenant isolation intacta

Todas las tablas nuevas (`platform_events`, `copilot_insights`) llevan RLS por `organization_id = get_my_org_id()`. Inserts del worker usan `createServiceClient()` con `organization_id` derivado del SELECT inicial — nunca hardcoded. La regresión `createServiceClient` (Fase 0.5 F0.5.1) **no** la aumenta este slice (uso justificado: cron + webhook).

### RNF2 — Cero regresión en commerce core

A4 es additive. No toca `orders`, `products`, `customers`, `chats`, `analytics_events` ni `chat-agent.ts`. Si lo necesitara (ej. lectura de métricas), lo hace via SELECT read-only.

### RNF3 — Costo controlado por tenant

Composer Claude Haiku ≤ $0.01 USD por insight. Tenants en `Free` plan: insights deshabilitados por default (`notify_on_copilot_insight=false` en setup). Tenants `Growth` y arriba: habilitados.

### RNF4 — Reversibilidad

Cada slice T4.X (ver `tasks.md`) es independientemente reversible. Si T4.5 (composer) tiene problemas, revertir su PR no afecta a T4.1 (`platform_events` schema).

### RNF5 — Spec-first y testing rigurosos

Heredados del commerce reset (`ATLAS_VALUE_FIRST_PLAN §15`):

- Tests focalizados antes del merge.
- Migraciones idempotentes (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`).
- ESLint focalizado limpio sobre archivos modificados.
- `npx tsc --noEmit` y `npm run build` verdes.
- Doc per-slice en `docs-private/SLICE_COPILOT_MERCHANT_LOOP_V0.md`.
- Approval explícito @tause antes de merge a `main`.

### RNF6 — Observabilidad mínima

- Logs estructurados en el worker con `[copilot/weekly]` prefix.
- Métrica simple en `copilot_insights`: count by status, avg time-to-decision.
- Dashboard superadmin (existe) puede consultar `copilot_insights` para ver adopción.

## 7. Criterios de aceptación globales

- ✅ Migraciones aplicadas en prod sin downtime (3 migraciones aditivas).
- ✅ `npm run test` verde (35+ tests existentes + 5 nuevos focalizados — ver `tasks.md`).
- ✅ `npx tsc --noEmit` verde.
- ✅ `npx eslint` verde sobre archivos tocados.
- ✅ Worker `/api/cron/copilot/weekly-insights` responde 200 con auth correcta y 401 sin auth.
- ✅ Insight semanal real generado y entregado a 1+ tenant de QA con WhatsApp Personal connected.
- ✅ `/dashboard/copilot` carga el feed, permite aprobar 1 insight, ejecuta whitelist action `notify_owner`, y refleja `executed_at`.
- ✅ TORRE_DE_CONTROL §19 (futura) actualizada con cierre del slice y release `v1.15.0`.

## 8. Decisiones operativas pendientes (no bloquean apertura de rama)

1. **Tenant timezone fija o configurable.** v0 asume UTC-5 (Colombia). Tantor's House (Tantor) USA está en `en-US` pero su timezone real podría ser EST. Decisión: aceptar 1 timezone hardcoded UTC-5 en v0; agregar columna `timezone` al onboarding en v1.
2. **¿Insights deshabilitados por default en plan Free?** Recomendación: sí, para no quemar Haiku tokens en tenants no-pagos. Admite ovrride por superadmin.
3. **Frecuencia de carrito abandonado.** Para v0 sólo en el reporte semanal. Real-time triggers (cart abandonment >1h → insight on-demand) llegan en v1.
4. **¿Notificar al merchant también por email cuando hay insight nuevo?** No en v0 (canal único: WhatsApp Personal). Si Personal está desconectado, el insight se queda en el feed `/dashboard/copilot` y no se entrega push.
5. **Tabla `tenant_memory` (long-term memory del copilot).** No la incluye v0. Diseño preliminar en `design.md §9` reservado. Slice futuro la activa.
6. **Política de retención.** `platform_events` y `copilot_insights` no se purgan en v0. Política de TTL llega cuando volúmenes lo justifiquen (post 6 meses producción).
7. **Action executor: auditoría completa.** Sólo `executed_at + decided_by` en v0. Tabla audit separada (`copilot_action_audit`) llega si compliance lo exige.

---

## 9. Documentos relacionados

- `docs-private/ATLAS_VALUE_FIRST_PLAN_2026-05-21.md` — plan estratégico macro (Olas + Slices).
- `docs-private/MANDATO_PRODUCTO_Y_ARQUITECTURA.md` §3.4 — mandato AI primera clase.
- `docs-private/VISION_2026_CAMINO_ELEGIDO.md` §4.6 — principio P6 workers/triggers proactivos.
- `docs-private/COSTING_ANALYSIS_2026-05-13.md` — costo Claude Haiku 4.5 por conversación.
- `docs-private/META_INTEGRATIONS_STATUS.md` — estado WhatsApp Personal y Cloud API.
- `.kiro/specs/copilot-merchant-loop-v0/design.md` — arquitectura técnica detallada.
- `.kiro/specs/copilot-merchant-loop-v0/tasks.md` — checklist de slices T4.1 → T4.7.
- `docs-private/SLICE_COPILOT_MERCHANT_LOOP_V0.md` (a crear con la rama) — status vivo del slice.
