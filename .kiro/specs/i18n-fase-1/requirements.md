# i18n Fase 1 — Single-locale-per-tenant

> **Estado**: Planificación
> **Branch**: `feat/i18n-fase-1`
> **Documento estratégico**: `docs-private/INTERNATIONALIZATION_STRATEGY_2026-05.md`
> **Iniciado**: 2026-05-19
> **Esfuerzo estimado**: 5-7 días dedicados (~1.5 semanas calendario)

---

## 1. Objetivo

Permitir que cada organización (tenant) opere con un **idioma + moneda + país fijos** distintos a los defaults colombianos, sin romper a los tenants existentes que están todos en `COP / es-CO / CO`.

## 2. Drivers reales

1. **Tantors House** — cliente nuevo en Estados Unidos.
   - Storefront en inglés (`en-US`).
   - Precios cargados en USD.
   - Cobra a clientes USA con Zelle (transferencia manual offline).
   - Dashboard del merchant puede quedar en español (no es bloqueante para Fase 1).

2. **Tausornamentos** — driver futuro de Fase 2 (presentment currency con selector cliente final).
   - **No bloqueante para Fase 1**, solo se considera para no cerrar puertas.

## 3. NO objetivos (explícitos)

- ❌ Selector de moneda por cliente final (`presentment currency`) → **Fase 2**.
- ❌ Conversión automática con tasas de cambio en tiempo real → nunca.
- ❌ Multi-warehouse logístico → nunca.
- ❌ Translation engine automático del catálogo → nunca.
- ❌ i18n full del dashboard del merchant → opcional Fase 3.
- ❌ Stripe gateway → Fase 3.

## 4. Alcance reducido (decisión 2026-05-19)

Locales soportados en Fase 1:

| Currency | Locale | Country |
| --- | --- | --- |
| `COP` (default) | `es-CO` (default) | `CO` (default) |
| `USD` | `en-US` | `US` |

**Razón:** son los dos pares con drivers reales. Ampliar a MX/ES/BR cuando aparezcan tenants concretos, mediante migración aditiva al CHECK constraint.

## 5. Requisitos funcionales

### RF1 — Schema multi-locale aditivo

`organizations` debe tener 3 columnas nuevas con CHECK constraints y defaults seguros:

- `currency_code text DEFAULT 'COP' CHECK (currency_code IN ('COP', 'USD'))`
- `locale text DEFAULT 'es-CO' CHECK (locale IN ('es-CO', 'en-US'))`
- `country_code text DEFAULT 'CO' CHECK (country_code IN ('CO', 'US'))`

Toda organización existente queda en COP/es-CO/CO automáticamente.

### RF2 — Contexto del tenant exponible

`resolvePublicOrganization()` y `getCurrentOrganization()` deben exponer los nuevos campos en el objeto retornado.

### RF3 — `formatCurrency()` parametrizable

`src/lib/utils.ts:formatCurrency()` debe aceptar opcionalmente un contexto `{ currency, locale }`. Sin contexto, mantener comportamiento legacy (`COP / es-CO / 0 decimales`).

### RF4 — Storefront público bilingüe

Strings hardcoded del storefront público (`/store/[slug]/...`, templates, checkout) deben venir de un diccionario `src/lib/i18n/storefront-strings.ts` indexado por locale.

### RF5 — Forms country-aware

Direcciones de envío deben adaptarse:
- `CO`: campos `departamento`, `ciudad`, `direccion`.
- `US`: campos `state`, `city`, `zip_code`, `address_line_1`, `address_line_2`.

Validación con Zod `discriminatedUnion` por `country_code`.

### RF6 — Método de pago manual offline

Permitir configurar un método de pago "manual offline" (Zelle, transferencia, depósito) con instrucciones de pago en texto rico. Dashboard server action `markOrderAsPaid` para confirmar manualmente con audit log.

### RF7 — AI agent en idioma del tenant

System prompt del agente AI debe forzar idioma según `organization.locale`. Sin esto, Claude auto-detecta y puede mezclar idiomas.

### RF8 — Emails de notificación bilingües

Templates de notificación duplicados por locale: `order-confirmation.es.tsx`, `order-confirmation.en.tsx`. El sender elige según `organization.locale`.

## 6. Requisitos no funcionales

### RNF1 — Cero regresión

Tenants colombianos existentes (QP, Tez, Goldcaps, Casa Inmob, Aliviate, Inve Pet, Latte, Demo Store) deben mantener comportamiento idéntico antes y después de cada slice. Tests E2E obligatorios para 2+ tenants COP antes de cada merge a main.

### RNF2 — Multi-tenancy intacta

RLS sigue filtrando por `organization_id`. Las nuevas columnas no rompen políticas existentes ni requieren políticas nuevas.

### RNF3 — Rollback seguro por slice

Cada slice (T1.1 a T1.7) debe ser independientemente reversible. Si T1.3 (i18n strings) tiene problemas, revertir su PR no afecta a T1.1 ni T1.2.

### RNF4 — Sin librería i18n externa en Fase 1

Usar `Intl.NumberFormat`, `Intl.DateTimeFormat`, `Intl.DisplayNames` nativos. No agregar `next-intl`, `react-intl` ni `i18next` en Fase 1. Migrar a librería solo si Fase 3 lo requiere.

## 7. Criterios de aceptación globales

- ✅ Migración SQL aplicada en prod sin downtime.
- ✅ `npm run test` verde con todos los tests existentes + nuevos.
- ✅ `npx tsc --noEmit` verde.
- ✅ `npx eslint` verde sobre archivos tocados.
- ✅ QA E2E manual: storefront QP en COP/es-CO funciona idéntico antes/después.
- ✅ QA E2E manual: storefront Tantors en USD/en-US funciona end-to-end (catálogo → checkout → pago manual → confirmación).
- ✅ TORRE_DE_CONTROL §18 actualizada con cada slice cerrado.

## 8. Decisiones operativas pendientes (no bloquean T1.1)

1. **Subdominio Tantors**: `tantors.landingchat.co` o custom domain `tantorshouse.com`?
2. **Plan asignado a Tantors**: recomendado `Growth` con feature gate `international_storefront`.
3. **Fecha de lanzamiento Tantors** — define urgencia vs otros frentes (commerce reset, hardening P0).
4. **¿Stripe ahora o solo Zelle?** Recomendación: Zelle para Fase 1, Stripe en Fase 3.

---

## 9. Documentos relacionados

- `docs-private/INTERNATIONALIZATION_STRATEGY_2026-05.md` — análisis estratégico completo.
- `docs-private/MANDATO_PRODUCTO_Y_ARQUITECTURA.md` — principios de plataforma multi-tenant.
- `docs-private/TORRE_DE_CONTROL_EJECUCION.md` §18 (futura) — estado vivo del slice.
- `.kiro/specs/i18n-fase-1/design.md` — arquitectura técnica detallada.
- `.kiro/specs/i18n-fase-1/tasks.md` — checklist de slices T1.1 → T1.7.
