# Platform Notifier v0 — Tasks

> Branch: `feat/platform-notifier-v0` · Release objetivo: v1.30.0
> Regla: cada task → tests + tsc/eslint verdes → commit.

## T0 — Reconciliación whatsapp_instances ↔ Evolution (0.5d)

- [x] `src/lib/whatsapp/reconcileInstances.ts` per design §1
- [x] Server action + botón "Reconciliar con servidor" en `/admin/whatsapp`
- [x] Tests: org_<uuid> crea fila, slug-match, unmatched no toca DB,
      mapeo de estados, idempotencia (2ª corrida → 0 created)
- [x] Ejecutar reconciliación real en prod y verificar tabla

## T0b — FK rota whatsapp_instances → organizations (CRÍTICO, hallado en T0)

- [x] Worker del copilot: eliminar JOIN embebido (PostgREST no resuelve la
      relación) → query en 2 pasos (instances → org ids → orgs)
- [ ] Migración: limpiar filas huérfanas (⚠️ destructivo, OK del usuario) +
      ADD CONSTRAINT FK ON DELETE CASCADE + NOTIFY pgrst reload schema
- [x] Ajustar tests del worker al query nuevo

## T1 — Canal platform (0.5d)

- [ ] Config `platform_notifications_config` en system_settings
- [ ] Creación/QR de instancia `platform_notifications` (server action admin)
- [ ] `sendPlatformNotification()` per design §2 + tests (enabled=false,
      no conectada, envío feliz, error del server → delivered:false)

## T2 — Cadena notifyMerchant (0.5d)

- [ ] Migración `organizations.notification_phone` (aditiva)
- [ ] `notifyMerchant()` per design §3 + tests (personal primero, fallback
      platform, sin canal, toggles por kind)
- [ ] Refactor consumers (sendCopilotInsight/sendSaleNotification/
      sendOwnerNotification) sin cambiar formato de mensajes
- [ ] Campo teléfono de notificación en dashboard settings

## T3 — Super admin (0.5d)

- [ ] Página `/admin/settings/platform-notifications` per design §4
- [ ] Test send real (smoke manual con número del super admin)

## T4 — Copilot sobre la cadena (0.5d)

- [ ] Worker: elegibilidad por actividad (sin INNER JOIN whatsapp)
- [ ] Entrega vía notifyMerchant; generated++ aunque no se entregue
- [ ] Ajustar tests del worker + suite copilot completa

## Cierre

- [ ] Suite completa + build + doc slice + torre + release v1.30.0
- [ ] Smoke e2e: test send admin → WhatsApp real; cron manual → insights
      para orgs activas; QR platform conectado con número LandingChat
