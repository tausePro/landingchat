# Copilot Merchant Loop v0 — Diseño técnico

> Complementa: `requirements.md`
> Branch: `feat/copilot-merchant-loop-v0`
> Decisión scheduler: **Vercel Cron** (existente en `vercel.json`) con auth `CRON_SECRET`. Migrar a Inngest sólo si Ola 2 lo requiere.

---

## 1. Modelo de datos

### 1.1 Nueva tabla `platform_events`

Backbone event-sourced que Atlas Vision §4.1 pide. Convive con `analytics_events` legacy sin reemplazarla.

```sql
-- migrations/20260526a_platform_events.sql
BEGIN;

CREATE TABLE IF NOT EXISTS public.platform_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,                                       -- catálogo en TS, no en CHECK
    event_version INT NOT NULL DEFAULT 1,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    source TEXT NOT NULL CHECK (source IN ('web', 'whatsapp', 'webhook', 'system', 'copilot')),
    actor_id TEXT,                                                  -- user_id | customer_id | 'system'
    idempotency_key TEXT,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotencia per organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_events_org_idempotency
    ON public.platform_events (organization_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- Lookup principal: por org + tipo + tiempo
CREATE INDEX IF NOT EXISTS idx_platform_events_org_type_time
    ON public.platform_events (organization_id, event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_events_org_time
    ON public.platform_events (organization_id, occurred_at DESC);

ALTER TABLE public.platform_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_events_org_read ON public.platform_events;
CREATE POLICY platform_events_org_read
    ON public.platform_events
    FOR SELECT
    TO authenticated
    USING (organization_id = public.get_my_org_id());

-- INSERT solo via service role o RPC controlada (no policy de INSERT pública).

COMMENT ON TABLE public.platform_events IS
    'Backbone event-sourced del dominio. Catálogo de event_type vive en src/lib/events/platform-event-types.ts';
COMMENT ON COLUMN public.platform_events.event_type IS
    'Tipo del evento. Sin CHECK estrecho intencionalmente — la catalogación vive en TS para evolución sin migración.';
COMMENT ON COLUMN public.platform_events.idempotency_key IS
    'Clave externa única por org para evitar duplicados (ej. webhook_id, cron_run_id+iso_week).';

COMMIT;
```

**Garantías:**

- `ON DELETE CASCADE` con `organizations` evita huérfanos.
- `idempotency_key` UNIQUE per org permite que un mismo cron run no duplique eventos si retry.
- RLS sólo para SELECT autenticado. Inserts pasan por service role (cron) o futuras RPC con SECURITY DEFINER si se necesita exponer al frontend.
- Sin CHECK estrecho en `event_type` para no obligar migración cada vez que se agrega un evento. Catálogo TS valida en escritura.

### 1.2 Nueva tabla `copilot_insights`

```sql
-- migrations/20260526b_copilot_insights.sql
BEGIN;

CREATE TABLE IF NOT EXISTS public.copilot_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    scope TEXT NOT NULL DEFAULT 'weekly' CHECK (scope IN ('weekly', 'daily', 'on_demand')),
    iso_week TEXT,                                                  -- 'YYYY-Www' para idempotencia weekly
    status TEXT NOT NULL DEFAULT 'proposed'
        CHECK (status IN ('proposed', 'approved', 'executed', 'dismissed', 'expired')),
    title TEXT NOT NULL,
    body TEXT NOT NULL,                                             -- markdown
    proposed_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
    metrics_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    decided_at TIMESTAMPTZ,
    decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    decision_note TEXT,
    executed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotencia per (org, scope, iso_week) para weekly
CREATE UNIQUE INDEX IF NOT EXISTS idx_copilot_insights_org_week_unique
    ON public.copilot_insights (organization_id, scope, iso_week)
    WHERE iso_week IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_copilot_insights_org_status_time
    ON public.copilot_insights (organization_id, status, generated_at DESC);

ALTER TABLE public.copilot_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS copilot_insights_org_read ON public.copilot_insights;
CREATE POLICY copilot_insights_org_read
    ON public.copilot_insights
    FOR SELECT
    TO authenticated
    USING (organization_id = public.get_my_org_id());

DROP POLICY IF EXISTS copilot_insights_org_update ON public.copilot_insights;
CREATE POLICY copilot_insights_org_update
    ON public.copilot_insights
    FOR UPDATE
    TO authenticated
    USING (organization_id = public.get_my_org_id())
    WITH CHECK (organization_id = public.get_my_org_id());

-- INSERT solo via service role (worker). No policy pública.

COMMENT ON TABLE public.copilot_insights IS
    'Feed de insights generados por el copilot. Cada org ve sólo los suyos. Updates permitidos para aprobar/rechazar.';

COMMIT;
```

### 1.3 Extensión a `organizations`

```sql
-- migrations/20260526c_organizations_copilot_autonomy.sql
BEGIN;

ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS copilot_autonomy_level TEXT NOT NULL DEFAULT 'level_1_propose';

ALTER TABLE public.organizations
    DROP CONSTRAINT IF EXISTS organizations_copilot_autonomy_level_check;

ALTER TABLE public.organizations
    ADD CONSTRAINT organizations_copilot_autonomy_level_check
    CHECK (copilot_autonomy_level IN ('level_1_propose', 'level_2_act_with_whitelist', 'level_3_full_autonomy'));

COMMENT ON COLUMN public.organizations.copilot_autonomy_level IS
    'Nivel de autonomía del copilot. Default level_1_propose (solo lectura). v0 ejecuta level_3 como level_2.';

COMMIT;
```

Defaults aditivos: tenants existentes quedan en `level_1_propose` automáticamente. RLS no requiere policy nueva (las columnas heredan las de `organizations`).

### 1.4 Extensión a `whatsapp_instances`

```sql
-- migrations/20260526d_whatsapp_instances_copilot_notify.sql
BEGIN;

ALTER TABLE public.whatsapp_instances
    ADD COLUMN IF NOT EXISTS notify_on_copilot_insight BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.whatsapp_instances.notify_on_copilot_insight IS
    'Solo aplica a instance_type=personal. Si true, el copilot envía insights semanales al teléfono del owner.';

COMMIT;
```

Default `true` para instancias `personal` ya conectadas: la mayoría querrá recibir el reporte semanal. Owner puede toggle desde `/dashboard/copilot/settings`.

### 1.5 RLS — qué se garantiza

| Tabla | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| `platform_events` | Members del org via RLS | Service role only (worker + webhooks) | No path | No path (CASCADE on org delete) |
| `copilot_insights` | Members del org via RLS | Service role only (worker) | Members del org via RLS (aprobar/rechazar) | No path en v0 |
| `organizations.copilot_autonomy_level` | Hereda RLS de `organizations` | Hereda | Members admin via existing policies | Hereda |
| `whatsapp_instances.notify_on_copilot_insight` | Hereda RLS de `whatsapp_instances` | Hereda | Hereda | Hereda |

Cero `USING (true)`. Cero RLS abierto.

---

## 2. Capa de tipos TypeScript

### 2.1 Catálogo de event types — `src/lib/events/platform-event-types.ts`

```ts
// Catálogo central de tipos de eventos del backbone event-sourced.
// Cualquier nuevo evento se agrega aquí + zod schema correspondiente.
export const PLATFORM_EVENT_TYPES = {
    // Commerce
    ORDER_CREATED: 'order.created',
    ORDER_PAID: 'order.paid',
    ORDER_CANCELLED: 'order.cancelled',
    CART_ABANDONED: 'cart.abandoned',
    CUSTOMER_FIRST_PURCHASE: 'customer.first_purchase',
    CUSTOMER_REPEAT_PURCHASE: 'customer.repeat_purchase',
    CUSTOMER_CHURN_RISK: 'customer.churn_risk',

    // Conversational
    CHAT_STARTED: 'chat.started',
    CHAT_HANDED_OFF_TO_HUMAN: 'chat.handed_off_to_human',

    // Copilot lifecycle
    COPILOT_INSIGHT_PROPOSED: 'copilot.insight_proposed',
    COPILOT_INSIGHT_APPROVED: 'copilot.insight_approved',
    COPILOT_INSIGHT_DISMISSED: 'copilot.insight_dismissed',
    COPILOT_ACTION_EXECUTED: 'copilot.action_executed',
} as const

export type PlatformEventType = typeof PLATFORM_EVENT_TYPES[keyof typeof PLATFORM_EVENT_TYPES]

export const ALL_PLATFORM_EVENT_TYPES = Object.values(PLATFORM_EVENT_TYPES)
```

### 2.2 Tipo de insight — `src/lib/copilot/types.ts`

```ts
import { z } from 'zod'

export const CopilotActionKindSchema = z.enum([
    'send_coupon_to_customers',
    'pause_product',
    'enable_product',
    'notify_owner',
])
export type CopilotActionKind = z.infer<typeof CopilotActionKindSchema>

export const CopilotProposedActionSchema = z.object({
    kind: CopilotActionKindSchema,
    human_label: z.string().min(1).max(200),
    requires_approval: z.boolean().default(true),
    params: z.record(z.string(), z.unknown()).default({}),
})
export type CopilotProposedAction = z.infer<typeof CopilotProposedActionSchema>

export const CopilotInsightPayloadSchema = z.object({
    title: z.string().min(1).max(200),
    body: z.string().min(1).max(4000),
    proposed_actions: z.array(CopilotProposedActionSchema).max(5),
    metrics_snapshot: z.record(z.string(), z.unknown()).default({}),
})
export type CopilotInsightPayload = z.infer<typeof CopilotInsightPayloadSchema>

export const COPILOT_INSIGHT_STATUSES = ['proposed', 'approved', 'executed', 'dismissed', 'expired'] as const
export type CopilotInsightStatus = typeof COPILOT_INSIGHT_STATUSES[number]

export const COPILOT_AUTONOMY_LEVELS = ['level_1_propose', 'level_2_act_with_whitelist', 'level_3_full_autonomy'] as const
export type CopilotAutonomyLevel = typeof COPILOT_AUTONOMY_LEVELS[number]
```

### 2.3 Helper de event emitter — `src/lib/events/emit.ts`

```ts
import { createServiceClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import type { PlatformEventType } from './platform-event-types'

interface EmitPlatformEventInput {
    organizationId: string
    eventType: PlatformEventType
    source: 'web' | 'whatsapp' | 'webhook' | 'system' | 'copilot'
    payload?: Record<string, unknown>
    actorId?: string
    idempotencyKey?: string
    occurredAt?: Date
}

// Emite un platform_event. NO falla el flow del caller si la inserción falla
// (logueo + best-effort). Caller decide si reintenta.
export async function emitPlatformEvent(input: EmitPlatformEventInput): Promise<{ ok: boolean; error?: string }> {
    try {
        const supabase = createServiceClient()
        const { error } = await supabase.from('platform_events').insert({
            organization_id: input.organizationId,
            event_type: input.eventType,
            source: input.source,
            payload: input.payload ?? {},
            actor_id: input.actorId ?? 'system',
            idempotency_key: input.idempotencyKey ?? null,
            occurred_at: (input.occurredAt ?? new Date()).toISOString(),
        })
        if (error) {
            // Idempotency conflict no es error real
            if (error.code === '23505') return { ok: true }
            logger.error('[platform_events] insert failed', { eventType: input.eventType, error: error.message })
            return { ok: false, error: error.message }
        }
        return { ok: true }
    } catch (e) {
        const message = e instanceof Error ? e.message : 'unknown'
        logger.error('[platform_events] unexpected', { eventType: input.eventType, message })
        return { ok: false, error: message }
    }
}
```

`createServiceClient()` aquí está justificado: el evento se emite desde paths server-side donde el contexto del usuario no siempre existe (cron, webhook). Documentado en commit + en `docs-private/SLICE_COPILOT_MERCHANT_LOOP_V0.md`.

---

## 3. Composer del insight (T4.5)

### 3.1 Pipeline general

```
loadWeeklyMetrics(orgId) → MetricsSnapshot
  ↓
buildPrompt(metrics, locale) → string
  ↓
callClaudeHaiku(prompt) → JSON candidate
  ↓
CopilotInsightPayloadSchema.parse(candidate) → validated
  ↓
return CopilotInsightPayload
```

### 3.2 `loadWeeklyMetrics(orgId)` — read-only SQL

`src/lib/copilot/weeklyMetrics.ts`:

```ts
export interface WeeklyMetrics {
    weekStart: Date
    weekEnd: Date
    previousWeekStart: Date

    orders: { count: number; revenue: number; ticketAvg: number }
    ordersPrev: { count: number; revenue: number }

    conversations: { count: number; whatsappPct: number }
    conversationsPrev: { count: number }

    cartsAbandoned: Array<{ id: string; customerName: string | null; total: number; createdAt: string }>
    inactiveCustomers: Array<{ id: string; name: string | null; lastOrderAt: string }>

    topProductsViewed: Array<{ productId: string; name: string; views: number; conversions: number }>
    topProductsConverted: Array<{ productId: string; name: string; orders: number; revenue: number }>
}
```

Cargado vía Supabase queries (RLS bypass via service role + filtro explícito por `organization_id`). Sin LLM en este paso — datos deterministas.

### 3.3 Prompt template (locale-aware)

`src/lib/copilot/prompts/weeklyInsightPrompt.ts`:

```ts
export function buildWeeklyInsightPrompt(metrics: WeeklyMetrics, locale: SupportedLocale): string {
    const lang = locale === 'en-US' ? 'English' : 'Spanish (LATAM)'
    return `
You are Atlas Copilot, an e-commerce operator assistant for LATAM merchants.
Respond ONLY in ${lang}.

CONTEXT — week ${metrics.weekStart.toISOString().slice(0, 10)} to ${metrics.weekEnd.toISOString().slice(0, 10)}:
- Orders: ${metrics.orders.count} (prev week: ${metrics.ordersPrev.count})
- Revenue: ${metrics.orders.revenue} (prev week: ${metrics.ordersPrev.revenue})
- Conversations: ${metrics.conversations.count} (${metrics.conversations.whatsappPct}% via WhatsApp)
- Abandoned carts: ${metrics.cartsAbandoned.length}
- Inactive customers (>21d): ${metrics.inactiveCustomers.length}
- Top viewed product: ${metrics.topProductsViewed[0]?.name ?? 'n/a'} (${metrics.topProductsViewed[0]?.views ?? 0} views, ${metrics.topProductsViewed[0]?.conversions ?? 0} conversions)

TASK:
Produce a JSON object with shape:
{
  "title": "<≤80 chars headline>",
  "body": "<markdown summary, ≤500 words, with bullet points>",
  "proposed_actions": [
    { "kind": "<one of send_coupon_to_customers|pause_product|enable_product|notify_owner>",
      "human_label": "<≤120 chars action description>",
      "requires_approval": true,
      "params": { ... params shape per kind ... }
    }
  ],
  "metrics_snapshot": { ... echo of key metrics ... }
}

CONSTRAINTS:
- 3 to 5 proposed_actions max, each on a distinct insight.
- Use only the action kinds listed.
- Do not invent customer names or product names that are not in the context.
- If the data is too thin (e.g. <5 orders), output a single insight asking the merchant for context, no actions.

Return JSON only, no markdown fences.
`
}
```

### 3.4 `callClaudeHaiku(prompt)` — wrapper Anthropic

Usa el cliente existente `src/lib/ai/anthropic.ts`. Modelo `claude-haiku-4.5`. Config:

- `max_tokens: 1500`
- `temperature: 0.4` (algo creativo pero estable)
- Stop si encuentra ` ``` ` (paranoia anti-markdown fences)
- Costo objetivo ≤ $0.01 USD por insight (4k input + 1.5k output ≈ $0.005 — margen).

Validación post-LLM:

1. Parsear JSON.
2. `CopilotInsightPayloadSchema.parse()`.
3. Validar que cada `proposed_action.kind` está en whitelist v0.
4. Validar que `params` shape es coherente con `kind` (e.g. `send_coupon_to_customers` requiere `customer_ids[], discount_percent`).
5. Si falla validación, fallback a un insight mínimo sin acciones (composer no debe romper el worker).

### 3.5 Tests del composer

`src/__tests__/lib/copilot/insightComposer.test.ts`:

- Snapshot determinístico con métricas mockeadas + LLM mockeado.
- Edge case: 0 orders → insight pidiendo contexto, sin acciones.
- Edge case: LLM responde JSON inválido → fallback safe.
- Edge case: LLM propone acción fuera de whitelist → drop esa acción + warning log.

---

## 4. Worker scheduler (T4.4)

### 4.1 Endpoint `/api/cron/copilot/weekly-insights/route.ts`

Patrón idéntico al cron `process-trials` existente. Auth con `CRON_SECRET`.

```ts
export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()
    const isoWeek = computeIsoWeek(new Date())                      // 'YYYY-Www'

    // 1. Cargar orgs candidatas
    const { data: orgs } = await supabase
        .from('organizations')
        .select(`
            id,
            slug,
            locale,
            currency_code,
            country_code,
            copilot_autonomy_level,
            whatsapp_instances!inner(
                phone_number,
                notifications_enabled,
                notify_on_copilot_insight,
                instance_type,
                status
            )
        `)
        .eq('whatsapp_instances.instance_type', 'personal')
        .eq('whatsapp_instances.status', 'connected')
        .eq('whatsapp_instances.notifications_enabled', true)
        .eq('whatsapp_instances.notify_on_copilot_insight', true)

    if (!orgs?.length) return NextResponse.json({ message: 'No eligible orgs', generated: 0 })

    const results = { generated: 0, skipped: 0, errors: [] as string[] }

    // 2. Por org, generar y enviar
    for (const org of orgs) {
        try {
            // Idempotency check
            const { data: existing } = await supabase
                .from('copilot_insights')
                .select('id')
                .eq('organization_id', org.id)
                .eq('scope', 'weekly')
                .eq('iso_week', isoWeek)
                .maybeSingle()

            if (existing) {
                results.skipped++
                continue
            }

            const metrics = await loadWeeklyMetrics(org.id)
            const payload = await composeWeeklyInsight({ orgId: org.id, locale: org.locale, metrics })

            const { data: insight, error: insertError } = await supabase
                .from('copilot_insights')
                .insert({
                    organization_id: org.id,
                    scope: 'weekly',
                    iso_week: isoWeek,
                    status: 'proposed',
                    title: payload.title,
                    body: payload.body,
                    proposed_actions: payload.proposed_actions,
                    metrics_snapshot: payload.metrics_snapshot,
                })
                .select('id')
                .single()

            if (insertError) throw insertError

            await emitPlatformEvent({
                organizationId: org.id,
                eventType: PLATFORM_EVENT_TYPES.COPILOT_INSIGHT_PROPOSED,
                source: 'copilot',
                payload: { insight_id: insight.id, scope: 'weekly', iso_week: isoWeek },
                idempotencyKey: `copilot.weekly.${isoWeek}.${org.id}`,
            })

            await sendCopilotInsight({ organizationId: org.id, insightId: insight.id })

            results.generated++
        } catch (e) {
            const msg = `${org.id}: ${e instanceof Error ? e.message : 'unknown'}`
            results.errors.push(msg)
            logger.error('[copilot/weekly]', { msg })
        }
    }

    return NextResponse.json(results)
}

export async function POST(request: Request) { return GET(request) }
```

### 4.2 Vercel Cron config

```jsonc
// vercel.json
{
  "crons": [
    { "path": "/api/cron/sync-properties", "schedule": "0 6 * * 1" },
    { "path": "/api/cron/subscriptions/process-trials", "schedule": "0 * * * *" },
    { "path": "/api/cron/whatsapp/reset-counters", "schedule": "0 5 1 * *" },
    { "path": "/api/cron/copilot/weekly-insights", "schedule": "0 14 * * 1" }
  ]
}
```

`0 14 * * 1` = lunes 14:00 UTC = 9:00 AM Colombia (UTC-5). v1 hará tenant-aware con timezone.

### 4.3 Idempotencia

- Por `(org, scope, iso_week)` UNIQUE en `copilot_insights`.
- Por `idempotency_key = 'copilot.weekly.${iso_week}.${org_id}'` en `platform_events`.
- Re-ejecutar el cron 2 veces el mismo lunes ⇒ cero duplicados, cero notifs duplicadas.

---

## 5. WhatsApp Personal channel — `sendCopilotInsight`

### 5.1 Extensión de `src/lib/notifications/whatsapp.ts`

Mismo patrón que `sendSaleNotification`. Función nueva `sendCopilotInsight`:

```ts
export async function sendCopilotInsight(params: { organizationId: string; insightId: string }): Promise<boolean> {
    const supabase = createServiceClient()

    const { data: instance } = await supabase
        .from('whatsapp_instances')
        .select('phone_number, notifications_enabled, notify_on_copilot_insight')
        .eq('organization_id', params.organizationId)
        .eq('instance_type', 'personal')
        .eq('status', 'connected')
        .single()

    if (!instance?.phone_number) return false
    if (instance.notifications_enabled === false) return false
    if (instance.notify_on_copilot_insight === false) return false

    const { data: insight } = await supabase
        .from('copilot_insights')
        .select('title, body, proposed_actions')
        .eq('id', params.insightId)
        .single()

    if (!insight) return false

    const message = formatInsightForWhatsApp(insight)
    await sendNotification(params.organizationId, instance.phone_number, message)
    return true
}
```

### 5.2 Formato del mensaje

```
🌅 Atlas Copilot — Reporte semanal

<title>

<body resumido a 800 chars>

¿Qué hacemos?
1. <proposed_actions[0].human_label>
2. <proposed_actions[1].human_label>
3. <proposed_actions[2].human_label>

Responde "1", "2", "3" o "todas".
Aprobación detallada: <storeUrl>/dashboard/copilot
```

URL del dashboard se construye con `getStoreLink()` del helper existente. Cero hardcode.

### 5.3 Recepción de respuestas `"1"`, `"2"`, `"3"`, `"todas"` (parser)

**v0 NO procesa la respuesta** del owner por WhatsApp. La respuesta se trata como mensaje normal y termina en el chat-agent. El owner debe ir a `/dashboard/copilot` para aprobar/rechazar.

**v1** agrega un parser específico cuando el sender es el owner number y el chat es `personal`. Decisión documentada en `tasks.md` T4.X (out-of-scope v0).

Razón: parser de WhatsApp respuestas inline implica nueva ruta crítica que quiere su propio QA. v0 prioriza el wow moment (insight llega + dashboard funciona).

---

## 6. Action executor (T4.6)

### 6.1 `src/lib/copilot/actionExecutor.ts`

```ts
const WHITELIST_V0: ReadonlySet<CopilotActionKind> = new Set([
    'send_coupon_to_customers',
    'pause_product',
    'enable_product',
    'notify_owner',
])

export async function executeProposedAction(params: {
    insightId: string
    action: CopilotProposedAction
    decidedBy: string
    organizationId: string
}): Promise<{ ok: boolean; error?: string }> {
    if (!WHITELIST_V0.has(params.action.kind)) {
        return { ok: false, error: `action_kind_not_whitelisted: ${params.action.kind}` }
    }

    try {
        switch (params.action.kind) {
            case 'send_coupon_to_customers':
                await runSendCouponToCustomers(params.action.params, params.organizationId)
                break
            case 'pause_product':
                await runPauseProduct(params.action.params, params.organizationId)
                break
            case 'enable_product':
                await runEnableProduct(params.action.params, params.organizationId)
                break
            case 'notify_owner':
                await runNotifyOwner(params.action.params, params.organizationId)
                break
        }

        await emitPlatformEvent({
            organizationId: params.organizationId,
            eventType: PLATFORM_EVENT_TYPES.COPILOT_ACTION_EXECUTED,
            source: 'copilot',
            payload: { insight_id: params.insightId, kind: params.action.kind },
            actorId: params.decidedBy,
            idempotencyKey: `copilot.action.${params.insightId}.${params.action.kind}`,
        })
        return { ok: true }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'unknown' }
    }
}
```

Cada `run*` es un módulo focalizado con tests propios. v0 implementa los 4 con la operación más mínima posible:

- `runSendCouponToCustomers`: crea cupón en `coupons` (existente) + envía WhatsApp con código (Personal del owner si Cloud no disponible).
- `runPauseProduct`: `UPDATE products SET active=false WHERE id=$1 AND organization_id=$2`.
- `runEnableProduct`: opuesta.
- `runNotifyOwner`: simplemente envía WhatsApp Personal con el `params.message`. Útil como sanity check del executor.

### 6.2 Server action expuesta a `/dashboard/copilot`

`src/app/dashboard/copilot/actions.ts`:

```ts
export async function decideCopilotInsight(params: {
    insightId: string
    decision: 'approve' | 'dismiss'
    note?: string
    actionIndices?: number[]                                        // qué proposed_actions ejecutar
}): Promise<ActionResult<{ executed: number; failed: number }>>
```

Patrón `ActionResult<T>` heredado del repo. RLS garantiza que el insight pertenece al org del usuario actual.

---

## 7. UI `/dashboard/copilot` (T4.7)

### 7.1 Rutas

- `src/app/dashboard/copilot/page.tsx` — feed con tabs `Pendientes | Historial`.
- `src/app/dashboard/copilot/settings/page.tsx` — toggle `copilot_autonomy_level` + `notify_on_copilot_insight`.
- `src/app/dashboard/copilot/components/insight-card.tsx` — render markdown + chips de acciones + modal confirm.
- `src/app/dashboard/copilot/components/decision-modal.tsx` — modal con preview del efecto.

### 7.2 Server Components por defecto

- `page.tsx` carga insights con SELECT + RLS — Server Component.
- `insight-card.tsx` puede ser Client si necesita `useState` para abrir/cerrar modal.
- Usar `next/image`, Tailwind v4, shadcn/ui (mandato AGENTS.md).

### 7.3 Empty state

Si org no tiene insights aún (lunes no llegado), mostrar mensaje "Tu primer reporte semanal llega el próximo lunes a las 9:00 AM" + botón "Ver ejemplo" con un mock estático.

---

## 8. Estrategia de tests

### 8.1 Tests unitarios

`src/__tests__/lib/copilot/`:

- `insightComposer.test.ts` (5+ tests con LLM stub).
- `weeklyMetrics.test.ts` (3+ tests con Supabase mock).
- `actionExecutor.test.ts` (4 tests, 1 por whitelist + 1 fuera de whitelist).
- `autonomyLevels.test.ts` (3 tests, gating por nivel).

### 8.2 Tests de integración

`src/__tests__/integration/`:

- `copilot-whatsapp-personal.test.ts` (3+ tests: e2e mock con Personal connected, sin Personal, con `notify_on_copilot_insight=false`).

### 8.3 Tests de seguridad

`src/__tests__/security/`:

- `copilot-rls.test.ts` (5+ tests: org A no ve insights de org B; UPDATE bloqueado fuera del org; INSERT vía service role OK; INSERT vía cliente authenticated bloqueado; `copilot_autonomy_level` no editable por non-admin).

### 8.4 Sin tests E2E reales con LLM

LLM se mockea siempre en CI para evitar costo + flakiness. Smoke manual con LLM real queda en checklist de validación pre-merge (sec. 11).

---

## 9. `tenant_memory` (reservado, NO en v0)

Long-term memory del copilot por tenant. **No se implementa en v0.** Diseño preliminar reservado para slice futuro:

```sql
-- migrations/YYYYMMDD_tenant_memory.sql (FUTURO, no v0)
CREATE TABLE IF NOT EXISTS public.tenant_memory (
    organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
    facts JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Ejemplos de facts: `{ "preferred_currency": "USD", "primary_audience": "moms 30-45", "best_selling_categories": [...], "merchant_tone": "casual" }`.

Slice futuro lo activa cuando v0 demuestre adopción.

---

## 10. Riesgos técnicos y mitigaciones

### 10.1 LLM responde JSON malformado

**Mitigación:** Zod validation + fallback a insight mínimo. Composer nunca rompe el worker. Reportar failure al log para QA manual.

### 10.2 WhatsApp Personal del owner desconectado

**Mitigación:** insight queda en `/dashboard/copilot` aunque el envío falle. Worker no falla. v1 puede enviar email de aviso.

### 10.3 Composer LLM cuesta más de lo proyectado

**Mitigación:** cap de tokens explícito + conteo en logs. Si el costo medio supera $0.02/insight, alarmar y revisar prompt.

### 10.4 Tenant en plan Free abusa de la generación

**Mitigación:** worker filtra orgs por `notify_on_copilot_insight=true` AND plan ≥ Growth. Free toggle off por default. Decisión final pendiente (sec. 8.2 requirements).

### 10.5 Whitelist v0 no cubre la acción que más mueve aguja

**Mitigación:** whitelist está pensada para ser baja-fricción (cupón, pausar/activar producto, notificar). Si en piloto Mes 1 la acción más útil es otra (e.g. ajuste de precio), se agrega vía nueva versión de whitelist + slice acotado.

### 10.6 `platform_events` crece descontroladamente

**Mitigación:** índice por `(org, type, occurred_at DESC)`. Volumen estimado v0: ≤ 1000 eventos/org/mes (10 insights * 4 eventos lifecycle + 50 commerce events/día). Política TTL llega cuando el volumen lo justifique.

### 10.7 Race entre cron y `decideCopilotInsight`

**Mitigación:** `iso_week` único por (org, scope, week). Worker idempotente. UI usa `status` para evitar doble-aprobación.

---

## 11. Plan de migración progresiva

| Etapa | Scope | Verificación |
| --- | --- | --- |
| Apply 4 migraciones | `platform_events`, `copilot_insights`, `organizations.copilot_autonomy_level`, `whatsapp_instances.notify_on_copilot_insight` | `SELECT count(*) FROM organizations WHERE copilot_autonomy_level IS NOT NULL` = total orgs |
| Deploy worker route + UI vacía | `/api/cron/copilot/weekly-insights` retorna 200 con auth, 401 sin | Hit con `Authorization: Bearer $CRON_SECRET` |
| Activar para 1 tenant QA | Tenant con WhatsApp Personal connected. Trigger manual del cron | Insight aparece en `/dashboard/copilot` + WA Personal recibe mensaje |
| Activar para Tez + QP (pilotos) | Toggle `notify_on_copilot_insight=true` para ambos | Lunes próximo: ambos reciben WA y ven feed |
| Monitorear Mes 1 | Costos LLM, tasa aprobación, lift revenue | KPIs sec. 7 del plan macro |
| Decision Gate Mes 1 | ¿Continuar a A1/A2/A3 o iterar A4? | Review con @tause |

---

## 12. Out-of-scope explícito

- Parser de respuestas WhatsApp `"1" / "2" / "todas"` → v1.
- Multi-canal (Email + SMS + IG DM) → B4 Ola 2.
- Real-time triggers (cart abandonment >1h → insight on-demand) → v1.
- LLM cost ladder (Hermes 4 + Haiku + Sonnet) → D2 Ola 4.
- LearnedSkill (memoria de patrones aprobados) → D3 Ola 4.
- Tenant timezone configurable → v1.
- Audit log dedicado de acciones del copilot → si compliance lo exige.

---

## 13. Documentos relacionados

- `requirements.md` — qué entregamos y por qué.
- `tasks.md` — desglose en T4.1 → T4.7.
- `docs-private/ATLAS_VALUE_FIRST_PLAN_2026-05-21.md` §8 — plan macro Slice A4.
- `docs-private/SLICE_COPILOT_MERCHANT_LOOP_V0.md` (a crear con la rama) — status vivo.
- `migrations/20260426_analytics_events.sql` — tabla legacy que NO se reemplaza.
- `src/app/api/cron/subscriptions/process-trials/route.ts` — patrón de referencia para el cron.
- `src/lib/notifications/whatsapp.ts` — patrón de referencia para `sendCopilotInsight`.
