# Platform Notifier v0 — Requirements

> Aprobado por @tause: 2026-06-11. Driver: las notificaciones a merchants
> (copilot, ventas) dependen de que cada tenant conecte WhatsApp Personal —
> nadie lo ha hecho. LandingChat ya tiene infraestructura propia (server
> Evolution vivo + Meta App) para notificar como PLATAFORMA.

## Contexto (hallazgos 2026-06-11, CORREGIDO tras T0)

1. ~~Tabla vacía~~ **FALSO** (diagnóstico inicial erróneo por JOIN
   silencioso): `whatsapp_instances` tiene 15 filas, con instancias
   personales CONECTADAS (tez, aliviate, invepet) y toggle copilot activo.
2. **Bug real y crítico**: la relación FK `whatsapp_instances →
   organizations` NO existe en prod — PostgREST no puede resolver joins
   embebidos (`organizations(slug)`, `whatsapp_instances!inner`). Prueba:
   filas huérfanas apuntando a orgs inexistentes (imposible con FK+CASCADE).
   **El worker del copilot usa ese join → habría fallado 500 el lunes.**
3. El server Evolution además tenía drift de estado (instancias con estado
   distinto al de la tabla) → reconciliación T0 lo corrige (created 1,
   updated 2 en la primera corrida real).
4. Config platform existente en `system_settings`: `evolution_api_config`
   (url+apiKey, server vivo) y `meta_whatsapp_config` (app de embedded
   signup, sin número emisor propio).

## Objetivos v0

- R1: Reconciliar `whatsapp_instances` con el estado real del server
  Evolution (crear filas faltantes, actualizar estados).
- R2: Canal de notificación DE LA PLATAFORMA: instancia Evolution propia
  (`platform_notifications`) + `sendPlatformNotification(to, message)`.
- R3: Cadena de entrega a merchants: instancia personal del tenant si
  existe → fallback al canal platform usando un teléfono de notificación
  por org (`organizations.notification_phone`).
- R4: Super admin operable: estado del canal platform, conexión por QR,
  test send, reconciliación manual.
- R5: Copilot: elegibilidad por ACTIVIDAD (no por WhatsApp); la entrega
  usa la cadena R3; sin canal disponible el insight vive en el dashboard.

## No-objetivos v0

- NO tocar el canal cliente↔tenant del chat (corporate instances).
- NO Meta Cloud API como emisor platform (requiere WABA propio + templates
  aprobados — v1 si Evolution muestra límites).
- NO migrar el flujo de conexión de tenants (embedded signup sigue igual).

## Criterios de aceptación

- ✅ Tras reconciliar: `whatsapp_instances` refleja el server (estados y
  números), sin duplicados, idempotente.
- ✅ Test send desde el super admin llega a un WhatsApp real.
- ✅ `notifyMerchant()` entrega por personal si existe, si no por platform
  + notification_phone; sin canal → retorna `{ delivered: false }` sin
  romper al caller.
- ✅ Cron del copilot genera insights para orgs con actividad semanal
  aunque no tengan WhatsApp; los entrega cuando hay canal.
- ✅ Cero `any` nuevos; tests por slice; secretos jamás logueados.
