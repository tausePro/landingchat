# Platform Notifier v0 — Design

## 1. T0 — Reconciliación `whatsapp_instances` ↔ server Evolution

`src/lib/whatsapp/reconcileInstances.ts`:

```ts
export interface ReconcileResult {
    created: number
    updated: number
    unmatched: string[]   // instancias del server sin org resoluble
    errors: string[]
}
export async function reconcileEvolutionInstances(): Promise<ReconcileResult>
```

- Lee `evolution_api_config` → `GET /instance/fetchInstances`.
- Resolución de org por instancia:
  - `org_<uuid>` → organization_id directo (convención canónica).
  - Nombre libre (`tez`, `aliviate`) → match por `organizations.slug`
    (trim + lowercase). Sin match → va a `unmatched`, NO se toca DB.
- Mapeo de estado Evolution → nuestro CHECK: `open→connected`,
  `connecting→connecting`, `close→disconnected`.
- Upsert por `instance_name` (UNIQUE): crea fila si falta
  (`instance_type: 'corporate'`, `provider: 'evolution'`), actualiza
  status/phone si existe. `connected_at`/`disconnected_at` según transición.
- Trigger: server action en `/admin/whatsapp` (botón "Reconciliar con
  servidor") con gate `checkSuperAdmin()` existente. `createServiceClient`
  justificado (operación cross-org del super admin).

## 2. T1 — Canal platform

- Instancia dedicada en el MISMO server Evolution: `platform_notifications`
  (creación + QR desde super admin, igual al flujo de tenants pero sin org).
- Config en `system_settings.platform_notifications_config`:
  `{ enabled: boolean, provider: 'evolution', instance_name: string }`.
- `src/lib/notifications/platform-whatsapp.ts`:

```ts
export async function sendPlatformNotification(
    to: string, message: string
): Promise<{ delivered: boolean; error?: string }>
```

- EvolutionClient directo con la instancia platform. NUNCA lanza.
- Si `enabled=false` o instancia no conectada → `{ delivered: false }`.

## 3. T2 — Cadena de entrega a merchants

- Migración: `organizations.notification_phone TEXT` (E.164, nullable).
- `src/lib/notifications/notify-merchant.ts`:

```ts
export async function notifyMerchant(params: {
    organizationId: string
    message: string
    kind: 'copilot_insight' | 'sale' | 'system'
}): Promise<{ delivered: boolean; channel: 'personal' | 'platform' | null }>
```

1. Instancia personal del tenant conectada (+ toggles por kind) →
   `sendWhatsAppMessage` (comportamiento actual, intacto).
2. Fallback: `notification_phone` del org → `sendPlatformNotification`.
3. Sin canal → `{ delivered: false, channel: null }` (no es error).

- Refactor de consumers: `sendCopilotInsight`, `sendSaleNotification` y
  `sendOwnerNotification` delegan la ENTREGA en `notifyMerchant`
  (mantienen su construcción de mensaje y sus checks de toggles).
- Config del teléfono: campo en dashboard → Configuración → Organización
  (server action existente del form) + editable desde admin/organizations.

## 4. T3 — Super admin `/admin/settings/platform-notifications`

- Estado: server Evolution alcanzable, instancia platform
  (estado/QR para conectar), config enabled on/off.
- Test send: input de teléfono + botón (usa `sendPlatformNotification`).
- Tabla de orgs: slug, notification_phone, instancia personal conectada
  (sí/no) → visibiliza cobertura de la cadena R3.
- Gate: `checkSuperAdmin()` (patrón existente en admin/whatsapp/actions).

## 5. T4 — Copilot sobre la cadena

- Worker `weekly-insights`: elegibilidad nueva = org con
  `onboarding_completed=true` Y actividad en la semana (≥1 orden o
  conversación — query barata previa). El INNER JOIN de whatsapp se
  elimina.
- Entrega: `notifyMerchant({ kind: 'copilot_insight' })`. `generated++`
  aunque `delivered=false` (el feed del dashboard es la fuente de verdad).
- `metrics_snapshot` ya registra el contexto; agregar `delivered_via` al
  payload del platform_event de proposed.

## 6. Seguridad y operación

- apiKey/QR jamás logueados; logger por módulo (`[platform-notifier]`).
- RLS: `system_settings` ya es admin-only; `notification_phone` cae bajo
  policies existentes de organizations.
- Rollback: `enabled=false` en config apaga el canal platform sin deploy.
