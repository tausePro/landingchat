# i18n Fase 1 — Tareas

> Branch: `feat/i18n-fase-1`
> Documentos: `requirements.md`, `design.md`
> Estado vivo: `docs-private/TORRE_DE_CONTROL_EJECUCION.md` §18

---

## Convenciones

- Cada slice T1.X corresponde a uno o más commits atómicos en `feat/i18n-fase-1`.
- Cerrar un slice = commit + actualizar el checkbox aquí + actualizar TORRE_DE_CONTROL §18.
- No mergear a `main` hasta cerrar el slice completo y validar con QA.
- Cada slice debe pasar `npx tsc --noEmit` y `npx eslint` antes de commit.

---

## T1.1 — Schema multi-locale en `organizations` ✅ CÓDIGO LISTO (pending: apply migration)

**Estimado:** 2h
**Owner:** Cascade + tausePro
**Estado:** Código completado 2026-05-19. Falta aplicar migración en Supabase prod.

### Subtareas

- [x] Crear `migrations/20260519_organizations_locale_currency.sql` con:
  - [x] `ADD COLUMN currency_code text NOT NULL DEFAULT 'COP' CHECK IN ('COP','USD')`
  - [x] `ADD COLUMN locale text NOT NULL DEFAULT 'es-CO' CHECK IN ('es-CO','en-US')`
  - [x] `ADD COLUMN country_code text NOT NULL DEFAULT 'CO' CHECK IN ('CO','US')`
  - [x] COMMENT ON COLUMN para documentar cada uno
  - [x] BEGIN/COMMIT explícito
  - [x] DROP CONSTRAINT IF EXISTS antes del ADD para idempotencia
- [x] Actualizar `src/types/organization.ts`:
  - [x] `SupportedCurrency`, `SupportedLocale`, `SupportedCountry` types
  - [x] Extender `Organization` interface
- [x] Crear `src/lib/i18n/tenant-locale.ts`:
  - [x] `TenantLocaleContext` interface
  - [x] `getTenantLocale(org)` helper
  - [x] `DEFAULT_TENANT_LOCALE` constante (Object.freeze)
  - [x] Type guards `isSupportedCurrency/Locale/Country`
- [x] Tests:
  - [x] `src/__tests__/lib/i18n/tenant-locale.test.ts` — 15 tests, defaults, parciales, type guards
- [x] Validaciones:
  - [x] `npx tsc --noEmit --pretty false` ✅ sin errores
  - [x] `npx eslint src/lib/i18n/ src/types/organization.ts ...test.ts` ✅ sin warnings
  - [x] `npx vitest run src/__tests__/lib/i18n/` ✅ 15/15
- [ ] **Pendiente del usuario:** aplicar migración en Supabase prod (seguro: aditiva con defaults)
- [ ] **Pendiente del usuario:** verificar que organizaciones existentes tienen `COP/es-CO/CO`:
  ```sql
  SELECT count(*) FROM organizations
  WHERE currency_code != 'COP' OR locale != 'es-CO' OR country_code != 'CO';
  -- Debe devolver 0
  ```
- [x] Commit: `feat(i18n): T1.1 schema multi-locale en organizations`
- [x] Actualizar TORRE_DE_CONTROL §18

### Criterios de aceptación T1.1

- ✅ Migración construida con BEGIN/COMMIT, defaults seguros y CHECK constraints idempotentes.
- ✅ `Organization` type incluye los 3 campos nuevos como opcionales (compatible con SELECT parciales).
- ✅ Tests verdes (15/15).
- ✅ Cero regresión: el código todavía no consume los campos, defaults coinciden con tenants existentes.

---

## T1.2 — `formatCurrency()` parametrizado por contexto

**Estimado:** 4h
**Estado:** Pendiente

### Subtareas

- [ ] Refactor `src/lib/utils.ts:formatCurrency()` con `FormatCurrencyOptions` opcional
- [ ] Backward compat 100%: sin opciones → comportamiento legacy idéntico
- [ ] Agregar `formatCurrency(amount, getTenantLocale(org))` en al menos 1 componente del storefront público para validar
- [ ] Tests:
  - [ ] `formatCurrency(100)` → `"$100"` (COP, sin decimales)
  - [ ] `formatCurrency(100, { currency: 'USD', locale: 'en-US' })` → `"$100.00"`
  - [ ] `formatCurrency(1234.56, { currency: 'USD', locale: 'en-US' })` → `"$1,234.56"`
  - [ ] `formatCurrency(1234567, { currency: 'COP', locale: 'es-CO' })` → `"$ 1.234.567"` (locale CO)
- [ ] Commit: `feat(i18n): T1.2 formatCurrency parametrizado por contexto del tenant`

### Criterios de aceptación T1.2

- ✅ Llamadas existentes a `formatCurrency(x)` siguen funcionando idéntico.
- ✅ Tests cubren COP y USD.
- ✅ Al menos 1 componente del storefront ya usa el contexto del tenant.

---

## T1.3 — Diccionario i18n storefront público

**Estimado:** 1-2 días (slice más grande)
**Estado:** Pendiente

### Subtareas

- [ ] Crear `src/lib/i18n/storefront-strings.ts` con tipo `StorefrontStringKey` y dict `{es-CO, en-US}`
- [ ] Crear helper `t(key, locale)` con fallback a `es-CO`
- [ ] Crear `src/lib/i18n/use-tenant-strings.ts` con `TenantLocaleProvider` + `useT()` hook
- [ ] Extraer strings de los siguientes archivos en orden:
  - [ ] Storefront templates (`src/components/store/templates/*`)
  - [ ] PDP (`src/app/store/[slug]/products/[productId]/...`)
  - [ ] Carrito (`src/components/store/cart/...`)
  - [ ] Checkout (`src/app/chat/components/checkout-modal.tsx`, `src/app/store/[slug]/checkout/...`)
  - [ ] Emails (`src/components/emails/...`) — solo strings, no templates aún
- [ ] Pasar `organization.locale` desde Server Components y `TenantLocaleProvider` desde Client Components
- [ ] Tests:
  - [ ] `t('cart.empty', 'es-CO')` → "Tu carrito está vacío"
  - [ ] `t('cart.empty', 'en-US')` → "Your cart is empty"
  - [ ] `t('unknown.key', 'en-US')` → fallback a es-CO o error claro
- [ ] Commits separados por área (storefront templates, PDP, carrito, checkout)

### Criterios de aceptación T1.3

- ✅ Diccionario tiene al menos 80% de los strings del storefront público.
- ✅ Strings dispersos en componentes reemplazados por `t()` o `useT()`.
- ✅ Tenant en `es-CO` sigue viendo todo en español sin cambios visuales.
- ✅ Tenant en `en-US` (mock) muestra storefront en inglés correctamente.

---

## T1.4 — Forms country-aware (direcciones)

**Estimado:** 4-6h
**Estado:** Pendiente

### Subtareas

- [ ] Crear `src/lib/validation/shipping-address.ts` con `discriminatedUnion` Zod por `country_code`
- [ ] Crear `<ShippingAddressForm countryCode={...}>` que renderiza fields correctos
- [ ] Migrar formularios actuales del checkout para usar el componente nuevo
- [ ] Verificar que orders existentes en `customer_info` siguen siendo válidas (compat)
- [ ] Tests:
  - [ ] Schema CO acepta `{country_code: 'CO', departamento, ciudad, direccion}`
  - [ ] Schema US acepta `{country_code: 'US', state, city, zip_code, address_line_1}`
  - [ ] Schema rechaza mezcla (US sin zip, CO con state)
- [ ] Commit: `feat(i18n): T1.4 forms country-aware con Zod discriminated union`

### Criterios de aceptación T1.4

- ✅ Tenant CO ve formulario con departamento/ciudad como antes.
- ✅ Tenant US ve formulario con state/zip.
- ✅ Validación rechaza datos del país equivocado.

---

## T1.5 — Método de pago manual offline

**Estimado:** 4-6h
**Estado:** Pendiente

### Subtareas

- [ ] Migración: ampliar CHECK de `payment_gateway_configs.provider` a incluir `'manual'`
- [ ] UI configuración manual offline en `Dashboard > Settings > Payments`:
  - [ ] Selector de tipo (Zelle, transferencia, depósito, otros)
  - [ ] Textarea con instrucciones (markdown)
  - [ ] Campo de contacto (email/teléfono Zelle, número cuenta)
- [ ] UI checkout: si tenant tiene `provider='manual'` activo, mostrar como opción de pago
- [ ] Al confirmar orden con manual offline:
  - [ ] `payment_method = 'manual'`
  - [ ] `payment_status = 'pending'`
  - [ ] Email confirmación incluye instrucciones
- [ ] Tests:
  - [ ] Server action `saveManualPaymentConfig` valida inputs
  - [ ] Order creation con method='manual' deja `payment_status='pending'`
- [ ] Commit: `feat(i18n): T1.5 metodo de pago manual offline (Zelle, transferencia, deposito)`

### Criterios de aceptación T1.5

- ✅ Merchant configura instrucciones desde dashboard.
- ✅ Cliente ve instrucciones claras en checkout.
- ✅ Orden queda en `pending` esperando confirmación manual.

---

## T1.6 — `markOrderAsPaid` dashboard server action

**Estimado:** 4-6h
**Estado:** Pendiente

### Subtareas

- [ ] Server action `src/app/dashboard/orders/[id]/actions.ts:markOrderAsPaid`
- [ ] Validación: solo orders con `payment_status='pending'` y `payment_method='manual'`
- [ ] Audit log: insertar en tabla nueva `order_payment_audit` o reutilizar existente
- [ ] Trigger email confirmación pagada al cliente (locale-aware)
- [ ] Decrementar stock idempotentemente (`orders.stock_decremented_at` flag)
- [ ] UI dashboard: botón "Marcar como pagado" en orden pending con manual offline
- [ ] Tests:
  - [ ] Idempotencia: llamar dos veces no decrementa stock dos veces
  - [ ] Permisos: solo owner/admin puede marcar
  - [ ] Audit log inserta correctamente
- [ ] Commit: `feat(i18n): T1.6 markOrderAsPaid server action con audit log`

### Criterios de aceptación T1.6

- ✅ Merchant marca pago manual como confirmado desde dashboard.
- ✅ Audit log registra quién y cuándo.
- ✅ Cliente recibe email confirmación en idioma del tenant.

---

## T1.7 — AI agent locale-aware + emails bilingües + onboarding Tantors

**Estimado:** 1 día
**Estado:** Pendiente

### Subtareas

- [ ] AI: parametrizar system prompt en `src/lib/ai/chat-agent.ts` con `organization.locale`
- [ ] Templates emails:
  - [ ] `src/components/emails/order-confirmation/es.tsx`
  - [ ] `src/components/emails/order-confirmation/en.tsx`
  - [ ] `src/components/emails/order-confirmation/index.tsx` (selector por locale)
  - [ ] Idem para `order-paid`, `order-shipped`, `order-cancelled` si existen
- [ ] Sender email respeta `organization.locale`
- [ ] Onboarding manual de Tantors:
  - [ ] Crear organization con `currency_code='USD', locale='en-US', country_code='US'`
  - [ ] Configurar pago manual Zelle
  - [ ] Cargar productos en USD con strings en inglés
- [ ] QA E2E:
  - [ ] Quality Pets en COP/es-CO: cero regresión
  - [ ] Tez en COP/es-CO: cero regresión
  - [ ] Tantors en USD/en-US: flujo completo catálogo → carrito → checkout → confirmación → email → mark as paid
- [ ] Commit: `feat(i18n): T1.7 AI agent locale-aware + emails bilingues`
- [ ] Merge `feat/i18n-fase-1` → `main` con tag `v1.14.0`

### Criterios de aceptación T1.7

- ✅ AI agent responde en idioma correcto según tenant.
- ✅ Emails llegan en idioma correcto.
- ✅ Tantors operativo end-to-end en producción.
- ✅ Tenants existentes en COP/es-CO sin regresión visible.

---

## Resumen de progreso

| Slice | Estado | Estimado | Cerrado |
| --- | --- | --- | --- |
| T1.1 | ✅ Código listo (pending migration apply) | 2h | 2026-05-19 |
| T1.2 | Pendiente | 4h | — |
| T1.3 | Pendiente | 1-2 días | — |
| T1.4 | Pendiente | 4-6h | — |
| T1.5 | Pendiente | 4-6h | — |
| T1.6 | Pendiente | 4-6h | — |
| T1.7 | Pendiente | 1 día | — |

**Tag al cerrar Fase 1:** `v1.14.0`

---

## Cómo retomar este trabajo

1. `git checkout feat/i18n-fase-1`
2. `git pull` (si trabajaste en otra máquina)
3. Leer este archivo para ver qué slice sigue.
4. Leer `design.md` si necesitas detalle técnico.
5. Leer `requirements.md` si necesitas entender el "por qué".
6. (Opcional, si tienes acceso al workspace local) leer `docs-private/INTERNATIONALIZATION_STRATEGY_2026-05.md` y `docs-private/TORRE_DE_CONTROL_EJECUCION.md` §18 para contexto estratégico.
