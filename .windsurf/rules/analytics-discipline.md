---
trigger: glob
globs:
  - src/components/analytics/**
  - src/lib/analytics/**
  - src/app/order/**
  - src/__tests__/components/analytics/**
description: Disciplina de analytics post-hardening 2026-05 (Meta Pixel, Meta CAPI, PostHog)
---

# Analytics Discipline

Tras el hardening de analytics de 2026-05 hay invariantes operativos que no se deben romper. Esta regla aplica al editar archivos de analytics y al layout de orden.

## Invariantes

### Meta Pixel
- `init` y `PageView` se ejecutan **una sola vez** vía `<MetaPixel>` (`src/components/analytics/meta-pixel.tsx`).
- ❌ NO agregar `useEffect` que llame `fbq('init', ...)` ni `fbq('track', 'PageView')` en otros componentes.
- ❌ NO montar `<MetaPixel>` en layouts anidados (ej. `src/app/order/layout.tsx`) si el padre ya lo monta.

### Meta Conversions API (CAPI)
- ❌ Cliente Meta CAPI **desactivado**. NO reintroducir `sendMetaCapiFunnelEvent` desde el navegador.
- ✅ Si se necesita CAPI, hacerlo **server-side** desde route handlers o server actions usando el access token desde `process.env`.
- ✅ Si tocas `src/components/analytics/tracking-provider.tsx`, mantener `sendMetaCapiFunnelEvent` como no-op o eliminarla, y NO llamarla desde los handlers `trackXxx`.

### PostHog
- ✅ `capture_pageview: false` en `ensurePosthog()` (`src/lib/analytics/posthog-client.ts`). Emitimos `$pageview` manualmente con `usePosthogTracking().trackPageView()`.
- ✅ `autocapture: true` está habilitado a propósito.
- ✅ El proxy `/ingest/*` debe seguir activo en `next.config.ts` para evitar adblockers.

### Layouts y montaje
- `<TrackingProvider>` y `<MetaPixel>` se montan **una sola vez** en el layout más alto pertinente (chat layout, store layout). NO duplicar en sub-layouts.
- En `src/app/order/layout.tsx` específicamente, NO montar tracking — la página específica es responsable.

## Tests de regresión

- `src/__tests__/components/analytics/tracking-provider.regression.test.ts` cubre estas invariantes. NO desactivar ni debilitar esos tests sin revisión humana.

## Antes de mergear cambios de analytics

- Correr `npm run test src/__tests__/components/analytics`
- Verificar en preview con DevTools → Network: 1 request `init` y 1 `PageView` por sesión
- Verificar en PostHog Live Events que aparezca `$pageview` y `$autocapture`

## Referencias

- `docs-private/PUNCHLIST_HARDENING_PLATAFORMA_2026-04.md`
- `AGENTS.md` § Analytics
