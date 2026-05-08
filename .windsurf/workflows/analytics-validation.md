---
description: Validar integridad de analytics (Meta Pixel, Meta CAPI, PostHog) tras cambios
---

# Analytics Validation

Ejecutar cuando se han tocado archivos de analytics o tracking para garantizar que el hardening de 2026-05 no se rompió.

## Lista de chequeo

### 1. Tests de regresión

```bash
npm run test src/__tests__/components/analytics
```

Deben pasar. Si fallan, **NO mergear**. Los tests cubren:
- No reintroducción de cliente Meta CAPI
- MetaPixel sin doble init/PageView
- Layout `/order` sin tracking duplicado

### 2. Inspección estática

```bash
# Buscar reintroducción accidental de Meta CAPI cliente
rg "sendMetaCapiFunnelEvent" src/components src/lib

# Debe aparecer SOLO en tracking-provider.tsx (definición no-op) y tests de regresión.
# Si aparece en otros archivos, revisar.
```

```bash
# Buscar dobles init de Meta Pixel
rg "fbq\\(.init.|fbq\\(.track., .PageView." src/components src/app

# Debe aparecer SOLO en src/components/analytics/meta-pixel.tsx
```

### 3. Validación en runtime (preview deploy)

Abrir el preview deploy en browser con DevTools → Network filtrado por `connect.facebook.net` y `t.co` (Pixel) y `app.posthog.com` (PostHog):

- **1 request** a `connect.facebook.net/.../fbevents.js` (carga del script)
- **1 request** `tr?id=...&ev=PageView` por navegación
- ❌ Si aparecen 2 PageView en la misma navegación → doble init, regresión.

PostHog en Live Events:
- Debe aparecer `$pageview` con `$current_url` correcto
- Debe aparecer `$autocapture` en clicks
- ❌ Si NO aparecen, verificar `NEXT_PUBLIC_POSTHOG_KEY` y proxy `/ingest/*`

### 4. Verificación cross-tenant

Probar en al menos 2 tenants:
- `tez.landingchat.co`
- `quality-pets.landingchat.co`

En ambos, validar `$pageview` y Meta Pixel `PageView` en una sesión nueva.

## Si algo falla

- **Test de regresión falla**: revisar el diff que rompió el invariante. NO debilitar el test.
- **Doble PageView**: buscar el segundo punto de montaje (probablemente layout anidado o useEffect duplicado).
- **PostHog sin eventos**: verificar bloqueo de adblocker, proxy `/ingest/*`, key correcta.
- **CAPI cliente reintroducido**: revertir; si era intencional, debe ser server-side.

## Referencias

- `.windsurf/rules/analytics-discipline.md`
- `AGENTS.md` § Analytics
- `docs-private/PUNCHLIST_HARDENING_PLATAFORMA_2026-04.md`
