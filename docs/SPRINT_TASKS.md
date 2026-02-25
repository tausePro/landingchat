# Sprint Tasks — LandingChat v1.10+

> Última actualización: 2026-02-25
> Estado: En progreso

---

## 🔴 P0 — Urgente (Tez va a campaña)

### 1. Meta Pixel + CAPI — Verificación y Deduplicación
**Estado:** 80% implementado, falta verificar y deduplicar
**Archivos clave:**
- `src/components/analytics/meta-pixel.tsx` — Client fbq
- `src/components/analytics/tracking-provider.tsx` — Unifica Meta + PostHog
- `src/components/analytics/purchase-tracker.tsx` — Client Purchase event
- `src/lib/analytics/meta-conversions-api.ts` — Server CAPI
- `src/app/api/webhooks/payments/epayco/route.ts` — CAPI en webhook

**Tareas:**
- [ ] Verificar que Tez tiene pixel_id + access_token configurados (SQL pendiente)
- [ ] Agregar `event_id` compartido entre client Purchase y server CAPI Purchase para deduplicación
  - Client: `fbq('track', 'Purchase', data, { eventID: 'purchase_ORDER_ID' })`
  - Server: `event_id: 'purchase_ORDER_ID'` (ya lo tiene parcialmente)
- [ ] Probar flujo completo: ViewContent → AddToCart → InitiateCheckout → Purchase
- [ ] Verificar en Meta Events Manager que los eventos llegan correctamente
- [ ] Opcional: Agregar CAPI a Wompi webhook (para otros clientes)

### 2. Checkout — Rediseño Stitch (Modal vs Vista Completa)
**Estado:** Propuesta Stitch revisada, pendiente decisión UX
**Archivos clave:**
- `src/app/chat/components/checkout-modal.tsx` — Checkout actual (modal)
- `src/app/store/[slug]/checkout/` — Posible nueva ruta (vista completa)
- `.kiro/specs/e-commerce-checkout-flow/` — Spec existente

**Decisión pendiente:** ¿Modal mejorado o vista completa dedicada?

**Tareas (comunes a ambas opciones):**
- [ ] Definir diseño final (modal vs full page) — decisión conjunta
- [ ] Campos fiscales: documento, tipo persona, razón social (spec Property 11)
- [ ] Mejorar UX de shipping: selector de ciudad, costos dinámicos
- [ ] Integrar cupones/descuentos visualmente
- [ ] Loading states y error handling mejorados
- [ ] Responsivo mobile
- [ ] Tracking: event_id compartido Purchase client ↔ server

---

## 🟡 P1 — Alto (funcionalidad core)

### 3. Agentes — Configuración y Afinamiento
**Estado:** Skills system existe, campos editables parciales
**Archivos clave:**
- `src/lib/ai/agent-factory.ts` — Composición de tools por modo
- `src/lib/ai/skills.ts` — Skills configurables
- `src/lib/ai/modes/` — shared.ts, ecommerce.ts, real-estate.ts
- `src/app/dashboard/agents/[id]/config/` — UI de configuración

**Tareas:**
- [ ] Identificar campos faltantes en la config del agente (por reportar)
- [ ] Mejorar prompt del agente real estate para agenda de visitas
- [ ] Verificar que schedule_appointment funciona end-to-end con el nuevo redirect a /asesor
- [ ] Validar que el agente ecommerce no interfiere con el inmobiliario
- [ ] Revisar skills defaults vs overrides

### 4. Google Calendar — OAuth + Integración Real
**Estado:** createCalendarEvent() existe, falta OAuth
**Archivos clave:**
- `src/lib/calendar/google-calendar.ts` — Client actual
- `src/lib/ai/tool-executor.ts` — scheduleAppointment llama a GCal
- `src/app/dashboard/settings/` — UI de settings

**Tareas:**
- [ ] Implementar OAuth 2.0 flow para Google Calendar
  - Ruta: `/api/auth/google/callback`
  - Guardar refresh_token encriptado en organizations
  - UI: Botón "Conectar Google Calendar" en settings
- [ ] Verificar que createCalendarEvent usa el token correcto
- [ ] Probar flujo: BookingPanel → Chat asesor → schedule_appointment → Google Calendar event
- [ ] Manejar token refresh automático
- [ ] UI para ver/gestionar citas desde el dashboard

---

## 🟠 P2 — Medio (estructural)

### 5. Planes — Modularidad desde Admin Dashboard
**Estado:** Estructura de plans/features existe en BD, admin limitado

**Tareas:**
- [ ] Dashboard admin: CRUD de planes con features toggleables
- [ ] Mapeo de features a funcionalidades (real_estate, ecommerce, whatsapp, etc.)
- [ ] Límites por plan (productos, propiedades, mensajes, agentes)
- [ ] UI para asignar plan a organización
- [ ] Middleware de verificación de features en rutas protegidas

### 6. Plantillas Premium — Módulo Nuevo
**Estado:** Concepto aprobado, requiere diseño

**Tareas:**
- [ ] Diseñar sistema de plantillas (estructura, schema, rendering)
- [ ] Crear primera plantilla premium para Tez
- [ ] UI selector de plantillas en dashboard
- [ ] Preview de plantilla antes de aplicar
- [ ] Sistema de personalización (colores, secciones, contenido)

---

## ✅ Completado en este sprint

- [x] v1.9.1 — Eliminar rutas debug inseguras
- [x] v1.9.2 — Fix categoría en product detail (categories[0] vs category)
- [x] v1.9.3 — Asesor redirect + product form field errors
- [x] Auditoría RLS producción
- [x] Media hotfix (Wind)

---

## Notas

- **Tez usa ePayco** — CAPI ya integrado en ese webhook
- **Error "Validation failed" de Goldcaps** — Fix de fieldErrors desplegado, pendiente que reproduzcan
- **Error "529 Anthropic"** — API sobrecargada temporalmente, no es bug nuestro
- **Flujo git:** develop → commit → push → verificar → merge main → tag
