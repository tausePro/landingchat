# Copilot Merchant Loop v0 — Tareas

> Branch: `feat/copilot-merchant-loop-v0`
> Documentos: `requirements.md`, `design.md`
> Estado vivo: `docs-private/SLICE_COPILOT_MERCHANT_LOOP_V0.md` (a crear con la rama)
> Release objetivo: `v1.15.0`
> Esfuerzo total: ~8.5d (1 dev) o ~5d (2 devs)

---

## Convenciones

- Cada slice T4.X corresponde a uno o más commits atómicos en `feat/copilot-merchant-loop-v0`.
- Cerrar un slice = commit + actualizar checkbox aquí + actualizar `docs-private/SLICE_COPILOT_MERCHANT_LOOP_V0.md` + entrada en `TORRE_DE_CONTROL_EJECUCION.md` §19 (a crear).
- No mergear a `main` hasta cerrar T4.1 → T4.7 + smoke manual con WhatsApp real + aprobación @tause.
- Cada slice debe pasar `npx tsc --noEmit`, ESLint focalizado y tests focalizados antes del commit.
- `npm run build` debe pasar antes del merge final.
- Métricas oficiales (`any`, `console.*`, `createServiceClient`) no deben subir en este slice. Si una excepción es necesaria, justificar en commit body.

---

## Precondiciones

- ✅ Fase 0 stop-the-bleeding cerrada (verificada 2026-05-21).
- ✅ i18n Fase 1 cerrada (`v1.14.0`).
- ⏳ Fase 0.5 Stabilization Gate completada (5 días, ver `ATLAS_VALUE_FIRST_PLAN §5.5`).
- ⏳ RFC worker scheduler aprobado (`docs-private/RFC_WORKER_SCHEDULER_2026-05-XX.md`). Recomendación preliminar: Vercel Cron (existente).
- ⏳ Baseline Tez + QP medido vía `scripts/atlas-baseline-tez-qp.sql`.
- ⏳ Spec aprobada por @tause (este documento + `requirements.md` + `design.md`).

Sin las 5 precondiciones cumplidas, no abrir la rama.

---

## T4.1 — Schema `platform_events` + catálogo TS + emit helper

**Estimado:** 0.5d
**Owner:** Cascade + tausePro
**Tipo:** `feat/`

### Subtareas

- [x] Crear `migrations/20260526a_platform_events.sql` con:
  - [x] `CREATE TABLE IF NOT EXISTS platform_events` con shape de `design.md §1.1`
  - [x] Índices `idx_platform_events_org_idempotency` (UNIQUE WHERE NOT NULL) + `idx_platform_events_org_type_time` + `idx_platform_events_org_time`
  - [x] `ENABLE ROW LEVEL SECURITY` + `CREATE POLICY platform_events_org_read` (SELECT only authenticated, USING `organization_id = get_my_org_id()`)
  - [x] `COMMENT ON TABLE` + `COMMENT ON COLUMN` para event_type e idempotency_key
  - [x] BEGIN/COMMIT explícito + `DROP POLICY IF EXISTS` antes del CREATE POLICY (idempotencia)
- [x] Crear `src/lib/events/platform-event-types.ts` con:
  - [x] `PLATFORM_EVENT_TYPES` const con los 12 tipos v0 (sec. 2.1 design)
  - [x] `PlatformEventType` derivado
  - [x] `ALL_PLATFORM_EVENT_TYPES` array para iteración / validación
- [x] Crear `src/lib/events/emit.ts` con:
  - [x] `emitPlatformEvent(input)` función con shape de `design.md §2.3`
  - [x] Service role client (`createServiceClient()`), justificado en comment del archivo
  - [x] Manejo de `error.code === '23505'` (idempotency conflict) como caso `ok: true`
  - [x] Logger structured con prefix `[platform_events]`
  - [x] No falla flow del caller en error (best-effort)
- [x] Tests `src/__tests__/lib/events/emit.test.ts`:
  - [x] Insert exitoso retorna `{ ok: true }`
  - [x] Idempotency conflict (23505) retorna `{ ok: true }` sin propagar error
  - [x] Error genérico retorna `{ ok: false, error }` con mensaje
  - [x] Defaults aplicados (`actor_id='system'`, `payload={}`, `occurred_at=now()`)
- [x] Validaciones:
  - [x] `npx tsc --noEmit` ✅
  - [x] `npx eslint src/lib/events/` ✅
  - [x] `npx vitest run src/__tests__/lib/events/` ✅
- [x] Commit: `feat(copilot): T4.1 platform_events schema + catálogo + emit helper`

### Criterios de aceptación T4.1

- ✅ Migración aplicable en idempotente (correr 2 veces no rompe).
- ✅ RLS verificada manualmente: `SELECT` de cliente authenticated en otro org retorna 0 filas.
- ✅ Emit helper bypassea RLS via service role pero filtra por `organization_id` explícito siempre.
- ✅ Catálogo TS exhaustivo cubre los 12 eventos del diseño.

---

## T4.2 — Schema `copilot_insights` + extensiones a `organizations` y `whatsapp_instances`

**Estimado:** 0.5d
**Owner:** Cascade + tausePro
**Tipo:** `feat/`

### Subtareas

- [x] Crear `migrations/20260526b_copilot_insights.sql` con shape de `design.md §1.2`:
  - [x] Tabla con CHECK constraints en `scope` y `status`
  - [x] `expires_at` con DEFAULT `now() + INTERVAL '7 days'`
  - [x] Idempotencia UNIQUE `(organization_id, scope, iso_week)` WHERE iso_week IS NOT NULL
  - [x] Índice `idx_copilot_insights_org_status_time`
  - [x] RLS habilitada con 2 policies: SELECT y UPDATE (ambas USING `organization_id = get_my_org_id()` + UPDATE con WITH CHECK)
  - [x] Sin policy de INSERT (sólo service role escribe en v0)
- [x] Crear `migrations/20260526c_organizations_copilot_autonomy.sql`:
  - [x] `ADD COLUMN IF NOT EXISTS copilot_autonomy_level TEXT NOT NULL DEFAULT 'level_1_propose'`
  - [x] `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT` para CHECK los 3 valores
  - [x] COMMENT ON COLUMN
- [x] Crear `migrations/20260526d_whatsapp_instances_copilot_notify.sql`:
  - [x] `ADD COLUMN IF NOT EXISTS notify_on_copilot_insight BOOLEAN NOT NULL DEFAULT true`
  - [x] COMMENT ON COLUMN aclarando que sólo aplica a `instance_type='personal'`
- [x] Extender `src/types/organization.ts`:
  - [x] `CopilotAutonomyLevel` type
  - [x] `Organization` interface gana `copilot_autonomy_level`
- [x] Crear `src/lib/copilot/types.ts` con shape de `design.md §2.2`:
  - [x] `CopilotActionKindSchema`
  - [x] `CopilotProposedActionSchema`
  - [x] `CopilotInsightPayloadSchema`
  - [x] `COPILOT_INSIGHT_STATUSES`, `COPILOT_AUTONOMY_LEVELS`
- [x] Tests `src/__tests__/lib/copilot/types.test.ts`:
  - [x] Schema rechaza acción fuera de whitelist
  - [x] Schema acepta `proposed_actions` vacío
  - [x] Schema rechaza body > 4000 chars
  - [x] Schema rechaza más de 5 proposed_actions
- [x] Validaciones tsc + eslint + vitest focalizado
- [x] Commit: `feat(copilot): T4.2 copilot_insights schema + autonomy level + whatsapp toggle`

### Criterios de aceptación T4.2

- ✅ 3 migraciones aplicables idempotentemente, todas aditivas (no rompen tenants existentes).
- ✅ Tenants existentes quedan en `level_1_propose` y `notify_on_copilot_insight=true` automáticamente.
- ✅ RLS de `copilot_insights` verificada con tests (T4.7 cubre RLS suite completa).
- ✅ Zod schema en TS valida payload del LLM antes de persistir.

---

## T4.3 — Composer del insight (Claude Haiku 4.5)

**Estimado:** 2d
**Owner:** Cascade + tausePro
**Tipo:** `feat/`

### Subtareas

- [ ] Crear `src/lib/copilot/weeklyMetrics.ts`:
  - [ ] `loadWeeklyMetrics(orgId): Promise<WeeklyMetrics>` con queries SQL contra:
    - `orders` (count, revenue, ticket avg para semana actual y previa, filtrado por `organization_id`)
    - `chats` (count, % whatsapp para ambas semanas)
    - Carritos abandonados (heurística: `chats` con `events` de cart_added sin `purchase` en 24h, top 10)
    - Clientes inactivos (`customers` sin order >21d, top 10)
    - Top 5 productos viewed (vía `analytics_events.event_name='view_content'`)
    - Top 5 productos converted (vía `orders.items` jsonb)
  - [ ] Service role client con `organization_id` filtrado en cada query
  - [ ] Edge case: org con 0 datos → retorna shape vacío con `weekStart/weekEnd` calculados
- [ ] Crear `src/lib/copilot/prompts/weeklyInsightPrompt.ts`:
  - [ ] `buildWeeklyInsightPrompt(metrics, locale)` con template de `design.md §3.3`
  - [ ] Locale `'es-CO' | 'en-US'` afecta el idioma del LLM response
- [ ] Crear `src/lib/copilot/insightComposer.ts`:
  - [ ] `composeWeeklyInsight({ orgId, locale, metrics }): Promise<CopilotInsightPayload>`
  - [ ] Llama Anthropic Claude Haiku 4.5 vía `src/lib/ai/anthropic.ts` existente
  - [ ] Config: `max_tokens: 1500`, `temperature: 0.4`
  - [ ] Parsea JSON de la respuesta
  - [ ] Valida con `CopilotInsightPayloadSchema.parse()`
  - [ ] Filtra `proposed_actions` cuyo `kind` no esté en whitelist v0
  - [ ] Fallback a insight mínimo (sin acciones) si LLM falla o JSON inválido
  - [ ] Logger `[copilot/composer]` con costo estimado por call
- [ ] Tests `src/__tests__/lib/copilot/insightComposer.test.ts`:
  - [ ] Metrics ricas + LLM mockeado → insight con 3 actions
  - [ ] 0 orders → insight de "necesito más contexto", 0 actions
  - [ ] LLM responde JSON inválido → fallback a payload mínimo
  - [ ] LLM propone `kind='ban_user'` (fuera whitelist) → drop esa acción + warning log
  - [ ] Locale `'en-US'` produce prompt en inglés
- [ ] Tests `src/__tests__/lib/copilot/weeklyMetrics.test.ts`:
  - [ ] Mock Supabase → shape correcto
  - [ ] Org sin datos → shape vacío válido
  - [ ] Filtros por `organization_id` siempre presentes (security check)
- [ ] Validaciones tsc + eslint + vitest focalizado
- [ ] Commit: `feat(copilot): T4.3 weekly metrics loader + insight composer (Claude Haiku)`

### Criterios de aceptación T4.3

- ✅ Composer es determinístico con LLM mockeado (snapshot tests).
- ✅ Composer nunca rompe el caller (fallback safe en cualquier error).
- ✅ Costo estimado por insight ≤ $0.01 USD (verificado con stub de tokens).
- ✅ Output siempre pasa Zod schema antes de retornar.

---

## T4.4 — Worker `/api/cron/copilot/weekly-insights`

**Estimado:** 2d
**Owner:** Cascade + tausePro
**Tipo:** `feat/`

### Subtareas

- [ ] Crear `src/app/api/cron/copilot/weekly-insights/route.ts` con shape de `design.md §4.1`:
  - [ ] Auth `CRON_SECRET` (Bearer header)
  - [ ] SELECT orgs candidatas: WhatsApp Personal connected + `notifications_enabled=true` + `notify_on_copilot_insight=true`
  - [ ] Para cada org:
    - [ ] Computar `iso_week` (helper nuevo `src/lib/utils/iso-week.ts`)
    - [ ] Idempotency check: ¿ya existe `copilot_insights` con (org, weekly, iso_week)?
    - [ ] Skip si existe (registrar en `results.skipped`)
    - [ ] `loadWeeklyMetrics(orgId)`
    - [ ] `composeWeeklyInsight({ orgId, locale, metrics })`
    - [ ] INSERT en `copilot_insights` con `status='proposed'`
    - [ ] `emitPlatformEvent(COPILOT_INSIGHT_PROPOSED, idempotencyKey: 'copilot.weekly.${iso_week}.${orgId}')`
    - [ ] `sendCopilotInsight({ orgId, insightId })` (T4.5)
  - [ ] Try/catch por org: errores no rompen otras orgs
  - [ ] Response JSON con `{ generated, skipped, errors[] }`
  - [ ] Logger `[copilot/weekly]` con prefix
  - [ ] Soporta GET y POST (GET es lo que Vercel Cron llama)
- [ ] Crear `src/lib/utils/iso-week.ts`:
  - [ ] `computeIsoWeek(date: Date): string` retorna `'YYYY-Www'` formato ISO 8601
  - [ ] Tests específicos para edge cases (semana 1 que cruza año, etc.)
- [ ] Actualizar `vercel.json`:
  - [ ] Agregar entry `{ "path": "/api/cron/copilot/weekly-insights", "schedule": "0 14 * * 1" }`
- [ ] Tests `src/__tests__/app/api/cron/copilot/weekly-insights.test.ts`:
  - [ ] 401 sin auth header
  - [ ] 401 con auth incorrecto
  - [ ] 200 con `{ message: 'No eligible orgs' }` cuando lista vacía
  - [ ] 200 con `{ generated: 1 }` cuando 1 org elegible y composer mockeado
  - [ ] Idempotency: segunda ejecución no duplica insights
  - [ ] Error en 1 org no bloquea las demás
- [ ] Tests `src/__tests__/lib/utils/iso-week.test.ts` (4+ tests)
- [ ] Validaciones tsc + eslint + vitest focalizado
- [ ] Commit: `feat(copilot): T4.4 weekly insights cron worker`

### Criterios de aceptación T4.4

- ✅ Cron registrado en Vercel sin colisión con otros 3 crons existentes.
- ✅ Auth `CRON_SECRET` siguiendo el patrón de `process-trials`.
- ✅ Idempotente por (`org`, `iso_week`) — re-correr 5 veces el mismo lunes no duplica nada.
- ✅ Error en 1 org no aborta el batch.
- ✅ Logs estructurados con `results.generated/skipped/errors`.

---

## T4.5 — `sendCopilotInsight` en `notifications/whatsapp.ts` + e2e channel

**Estimado:** 1d
**Owner:** Cascade + tausePro
**Tipo:** `feat/`

### Subtareas

- [ ] Extender `src/lib/notifications/whatsapp.ts`:
  - [ ] Función nueva `sendCopilotInsight({ organizationId, insightId })` con shape de `design.md §5.1`
  - [ ] Reusa `sendNotification(organizationId, phone, message)` interno existente
  - [ ] Respeta `notifications_enabled` y `notify_on_copilot_insight`
  - [ ] Helper `formatInsightForWhatsApp(insight)` privado:
    - [ ] Title + body resumido a 800 chars max
    - [ ] Numerar `proposed_actions` `1.`, `2.`, `3.`
    - [ ] Link al dashboard via `getStoreLink()` o equivalente para `/dashboard/copilot`
- [ ] Tests `src/__tests__/lib/notifications/whatsapp-copilot.test.ts`:
  - [ ] Personal connected + `notify_on_copilot_insight=true` → envía mensaje
  - [ ] Personal disconnected → no envía, retorna `false` sin error
  - [ ] `notifications_enabled=false` → no envía
  - [ ] `notify_on_copilot_insight=false` → no envía
  - [ ] Insight con 0 proposed_actions → mensaje formateado sin sección de acciones
  - [ ] Body > 800 chars → truncado correctamente con "..."
- [ ] **E2E manual smoke test** (validación pre-merge, no en CI):
  - [ ] Tenant QA con WhatsApp Personal connected
  - [ ] Trigger manual del cron con `curl -H "Authorization: Bearer $CRON_SECRET" ...`
  - [ ] WhatsApp del owner recibe mensaje formateado
  - [ ] Insight aparece en `/dashboard/copilot` (T4.6)
- [ ] Validaciones tsc + eslint + vitest focalizado
- [ ] Commit: `feat(copilot): T4.5 sendCopilotInsight WhatsApp Personal channel`

### Criterios de aceptación T4.5

- ✅ Función sigue exactamente el patrón de `sendSaleNotification` (consistencia).
- ✅ Cero side effect si Personal no conectado.
- ✅ E2E manual con tenant QA real verde antes de merge.

---

## T4.6 — UI `/dashboard/copilot` + action executor + decisión

**Estimado:** 1.5d
**Owner:** Cascade + tausePro
**Tipo:** `feat/`

### Subtareas

#### T4.6.a — Action executor

- [ ] Crear `src/lib/copilot/actionExecutor.ts` con shape de `design.md §6.1`:
  - [ ] Whitelist v0: `send_coupon_to_customers`, `pause_product`, `enable_product`, `notify_owner`
  - [ ] Switch por kind con handler dedicado por acción
  - [ ] `runSendCouponToCustomers`: crea cupón en `coupons` + WhatsApp con código
  - [ ] `runPauseProduct`: `UPDATE products SET active=false WHERE id=$1 AND organization_id=$2`
  - [ ] `runEnableProduct`: opuesta
  - [ ] `runNotifyOwner`: `sendNotification` simple
  - [ ] Emite `COPILOT_ACTION_EXECUTED` event con `idempotency_key='copilot.action.${insight_id}.${kind}'`
  - [ ] Errores no propagados al UI; retornan `{ ok: false, error }`
- [ ] Tests `src/__tests__/lib/copilot/actionExecutor.test.ts`:
  - [ ] 4 tests happy path (1 por kind)
  - [ ] Kind fuera de whitelist → `{ ok: false, error: 'action_kind_not_whitelisted' }`
  - [ ] Idempotency: 2 ejecuciones del mismo (insight, kind) emiten 1 sólo evento

#### T4.6.b — Server actions

- [ ] Crear `src/app/dashboard/copilot/actions.ts`:
  - [ ] `decideCopilotInsight({ insightId, decision, note?, actionIndices? })`
  - [ ] Patrón `ActionResult<T>` heredado del repo
  - [ ] Carga insight con cliente authenticated (RLS filtra por org)
  - [ ] Si `decision='approve'`: ejecuta acciones por índice + actualiza `status='executed'`
  - [ ] Si `decision='dismiss'`: actualiza `status='dismissed'` + `decision_note`
  - [ ] Persiste `decided_at` y `decided_by`
  - [ ] Emite `COPILOT_INSIGHT_APPROVED` o `COPILOT_INSIGHT_DISMISSED`
  - [ ] Retorna `{ executed: number, failed: number }`
- [ ] Tests `src/__tests__/app/dashboard/copilot/actions.test.ts`:
  - [ ] Approve con todas las actions → `executed === total`
  - [ ] Approve con índices parciales → ejecuta sólo esos
  - [ ] Dismiss → status correcto + note guardada
  - [ ] Insight de otro org → `{ success: false, error: 'not_found' }` (RLS protege)
  - [ ] Insight ya `executed` → idempotente (no re-ejecuta)

#### T4.6.c — UI pages

- [ ] Crear `src/app/dashboard/copilot/page.tsx` (Server Component):
  - [ ] Tabs `Pendientes | Historial`
  - [ ] SELECT insights por status; render `<InsightCard>`
  - [ ] Empty state: "Tu primer reporte semanal llega el próximo lunes a las 9:00 AM"
- [ ] Crear `src/app/dashboard/copilot/components/insight-card.tsx`:
  - [ ] Render markdown body via `react-markdown` (lib existente)
  - [ ] Chips de proposed_actions
  - [ ] Botones "Aprobar" (abre modal) y "Rechazar"
  - [ ] Tailwind v4 + shadcn/ui (mandato)
  - [ ] `next/image` (no `<img>`)
- [ ] Crear `src/app/dashboard/copilot/components/decision-modal.tsx`:
  - [ ] Confirma con preview del efecto: "Se enviará cupón 15% a 3 clientes"
  - [ ] Llama `decideCopilotInsight()` server action
  - [ ] Toast de éxito o error
- [ ] Crear `src/app/dashboard/copilot/settings/page.tsx`:
  - [ ] Toggle `copilot_autonomy_level`
  - [ ] Toggle `notify_on_copilot_insight` (afecta `whatsapp_instances` Personal)
  - [ ] Persiste vía server action

#### T4.6.d — Tests E2E (security + flow)

- [ ] `src/__tests__/security/copilot-rls.test.ts`:
  - [ ] Org A no ve insights de org B (SELECT)
  - [ ] Org A no puede UPDATE insight de org B
  - [ ] Service role bypassea RLS sólo en INSERT (worker)
  - [ ] User no-admin no puede cambiar `copilot_autonomy_level` (depende de policy en `organizations`)
- [ ] `src/__tests__/integration/copilot-whatsapp-personal.test.ts`:
  - [ ] Worker → composer → insight persistido → sendCopilotInsight → mock WhatsApp recibió mensaje
  - [ ] Worker para org sin Personal connected → cero side effects
  - [ ] Worker para org con Personal pero `notify_on_copilot_insight=false` → insight persistido pero sin envío

- [ ] Validaciones tsc + eslint + vitest focalizado + `npm run build`
- [ ] Commit: `feat(copilot): T4.6 dashboard UI + action executor + RLS suite`

### Criterios de aceptación T4.6

- ✅ Página carga ≤ 1s con 50 insights de mock.
- ✅ Aprobar 1 insight ejecuta sus actions y refleja `executed_at` en UI.
- ✅ Rechazar 1 insight persiste `decision_note`.
- ✅ Settings persisten cambios al refresh.
- ✅ Tests RLS demuestran tenant isolation.
- ✅ Build de Next.js verde.

---

## T4.7 — Suite de tests + doc per-slice + release

**Estimado:** 1d
**Owner:** Cascade + tausePro
**Tipo:** `chore/` (cierre)

### Subtareas

- [ ] Verificar que todos los tests focalizados de T4.1 → T4.6 pasan (`npm run test`).
- [ ] Verificar `npx tsc --noEmit` verde sobre todo el repo (no sólo archivos tocados).
- [ ] Verificar `npx eslint` sobre directorios tocados:
  - [ ] `src/lib/events/`
  - [ ] `src/lib/copilot/`
  - [ ] `src/lib/notifications/whatsapp.ts`
  - [ ] `src/app/api/cron/copilot/`
  - [ ] `src/app/dashboard/copilot/`
- [ ] Verificar métricas oficiales no suben sobre baseline (`scripts/count-any.sh`, `scripts/count-console.sh`, regex `createServiceClient`):
  - [ ] `any` ≤ 256 (no introducir regresión)
  - [ ] `console.*` ≤ 138 (no introducir regresión; idealmente bajar)
  - [ ] `createServiceClient` ≤ 262 (no subir; cron + emit + actionExecutor justifican los nuevos usos en commit body)
- [ ] Crear `docs-private/SLICE_COPILOT_MERCHANT_LOOP_V0.md` con:
  - [ ] Objetivo (copia abreviada de `requirements.md §1`)
  - [ ] Alcance v0 (qué entrega, qué no)
  - [ ] Riesgos identificados y mitigaciones
  - [ ] Estado vivo de cada T4.X (tabla con commits)
  - [ ] Decisiones operativas tomadas durante ejecución
  - [ ] Apéndice: instrucciones para activar copilot en un tenant nuevo
- [ ] Actualizar `TORRE_DE_CONTROL_EJECUCION.md` §19 (nueva sección "Copilot merchant loop v0"):
  - [ ] Header con release + fecha + tag
  - [ ] Resumen ejecutivo del slice
  - [ ] Lista de migraciones aplicadas
  - [ ] Validaciones realizadas
  - [ ] Pendientes operativos no bloqueantes (parser WhatsApp respuestas, multi-canal, etc.)
- [ ] Actualizar `ROADMAP.md` con entrada de A4 cerrado en `v1.15.0`.
- [ ] **E2E manual final con @tause:**
  - [ ] Aplicar las 4 migraciones en Supabase prod (orden: a, b, c, d)
  - [ ] Verificar que tenants existentes quedan en `level_1_propose` y `notify_on_copilot_insight=true`
  - [ ] Trigger manual del cron en producción contra tenant QA
  - [ ] WhatsApp Personal del owner recibe el insight
  - [ ] `/dashboard/copilot` muestra el insight
  - [ ] Aprobar 1 acción `notify_owner` → segundo WhatsApp llega
  - [ ] Rechazar otra → status correcto en UI
- [ ] **Aprobación explícita @tause** antes de merge a `main`.
- [ ] Bump versión a `v1.15.0` (minor por feature nuevo) en `package.json`.
- [ ] Tag git anotado `v1.15.0` con resumen del release.
- [ ] Merge a `main` con mensaje `merge: feat copilot merchant loop v0 (v1.15.0)`.
- [ ] Eliminar rama `feat/copilot-merchant-loop-v0` post-merge.

### Criterios de aceptación T4.7

- ✅ Toda la suite de tests focalizados verde (esperado: 35 existentes + 25+ nuevos = 60+ tests A4).
- ✅ Build de producción verde.
- ✅ Métricas oficiales sin regresión.
- ✅ Doc per-slice + TORRE + ROADMAP actualizados.
- ✅ E2E manual con tenant QA aprobado por @tause.
- ✅ Release `v1.15.0` publicado.

---

## Resumen de esfuerzo

| Slice | Estimado | Componente principal |
| --- | --- | --- |
| T4.1 | 0.5d | `platform_events` schema + emit |
| T4.2 | 0.5d | `copilot_insights` + autonomy + WA toggle |
| T4.3 | 2d | Composer Claude Haiku |
| T4.4 | 2d | Worker cron weekly |
| T4.5 | 1d | `sendCopilotInsight` channel |
| T4.6 | 1.5d | UI dashboard + action executor |
| T4.7 | 1d | Suite tests + doc + release |
| **Total** | **8.5d (1 dev)** o **~5d (2 devs paralelizando T4.3 + T4.4 con T4.6)** | |

## Pendientes operativos no bloqueantes (cola post-v0)

- Parser de respuestas WhatsApp `"1" / "2" / "todas"` (v1).
- Multi-canal proactivo: Email + SMS + IG DM (B4 Ola 2).
- Tenant timezone configurable (v1).
- LLM cost ladder Hermes 4 + Haiku + Sonnet (D2 Ola 4).
- LearnedSkill (D3 Ola 4).
- `tenant_memory` table (slice futuro).
- TTL retention policy de `platform_events` y `copilot_insights`.
- Audit log dedicado de acciones del copilot (si compliance lo exige).
- Trigger real-time `cart.abandoned` → insight on-demand (v1).
- Whitelist de acciones extendida con `adjust_price`, `create_product`, `broadcast_to_segment` (post-piloto Mes 1).
