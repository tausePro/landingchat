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

## T1.2 — `formatCurrency()` parametrizado por contexto ✅ COMPLETADO

**Estimado:** 4h
**Owner:** Cascade + tausePro
**Estado:** Cerrado 2026-05-19

### Subtareas

- [x] Refactor `src/lib/utils.ts:formatCurrency(amount, options?)` con `FormatCurrencyOptions` opcional
- [x] Backward compat 100%: sin opciones → comportamiento legacy idéntico (COP/es-CO/0 decimales)
- [x] Inferencia automática de decimales por currency (COP→0, USD→2) salvo override explícito
- [x] Migrar `src/app/store/[slug]/order/[orderId]/success/page.tsx` para usar `getTenantLocale(organization)` en lugar de helper local hardcoded
- [x] Refactor `getTenantLocale()` para aceptar `unknown` con narrowing interno (ergonomía: trabaja con tipos de Supabase, mocks, etc.)
- [x] Tests:
  - [x] Backward compat: 5 tests (default, redondeo, 0, negativos, símbolo)
  - [x] USD/en-US: 5 tests (formato, redondeo, entero, 0, negativo)
  - [x] COP explícito coincide con default
  - [x] Override `fractionDigits`: 3 tests (COP con 2, USD con 0, USD con 4)
  - [x] Integración con `getTenantLocale()`: 3 tests
- [x] Validaciones:
  - [x] `npx tsc --noEmit` ✅ sin errores en archivos tocados
  - [x] `npx eslint` sobre archivos tocados ✅ sin warnings
  - [x] `npx vitest run src/__tests__/lib/utils.test.ts src/__tests__/lib/i18n/` → 32/32 ✅
- [x] Commit: `feat(i18n): T1.2 formatCurrency parametrizado por contexto del tenant`
- [x] Actualizar TORRE_DE_CONTROL §18

### Criterios de aceptación T1.2

- ✅ Llamadas existentes a `formatCurrency(x)` siguen funcionando idéntico (backward compat verificado en tests).
- ✅ Tests cubren COP y USD con assertions semánticas (símbolos, dígitos, decimales) + comparaciones contra `Intl.NumberFormat` canónico.
- ✅ Storefront order success page usa contexto del tenant (`getTenantLocale(organization)`).
- ✅ `getTenantLocale` acepta `unknown` y filtra valores no soportados → seguro contra datos sucios de cualquier fuente.

---

## T1.3 — Diccionario i18n storefront público

**Estimado total:** 1-2 días (dividido en sub-slices T1.3a → T1.3z)
**Estado:** T1.3a + T1.3b cerrados (2026-05-19). T1.3c+ pendientes.

### T1.3a — Infraestructura del diccionario ✅ CERRADO

**Cerrado:** 2026-05-19

- [x] Crear `src/lib/i18n/storefront-strings.ts` con dict `{es-CO, en-US}` indexado por `SupportedLocale`
- [x] Tipo `StorefrontStringKey` derivado del dict base `'es-CO'` (compile-time check de keys)
- [x] Usar `as const satisfies Record<SupportedLocale, ...>` para preservar literal types + verificar paridad
- [x] Helper `t(key, locale)` con cascada de fallbacks:
  - Locale inválido → `'es-CO'`
  - Key faltante en locale → busca en `'es-CO'`
  - Key tampoco en `'es-CO'` → devuelve la key (visible para debug)
- [x] Crear `src/lib/i18n/use-tenant-strings.tsx` con:
  - `TenantLocaleProvider` (Client Component) para árbol de Client Components
  - `useTenantLocale()` hook que retorna el locale actual
  - `useT()` hook memoizado con `useCallback`
- [x] Tests `src/__tests__/lib/i18n/storefront-strings.test.ts`:
  - 12 tests cubriendo estructura del dict, lookups directos, fallbacks, paridad de keys es-CO ↔ en-US
- [x] Seed inicial del diccionario con 31 keys de las 3 order pages (success/pending/error + status pills + common)
- [x] Validaciones: tsc + eslint + 44/44 tests verdes (15 tenant-locale + 12 storefront-strings + 17 utils)
- [x] Commit: `feat(i18n): T1.3a infraestructura diccionario storefront`

### T1.3b — Migrar order success / pending / error pages ✅ CERRADO

**Cerrado:** 2026-05-19

- [x] `src/app/store/[slug]/order/[orderId]/success/page.tsx`:
  - Strings hardcoded reemplazados por `t(key, locale)` (15 strings migrados)
  - Instrucciones de transferencia bancaria Bancolombia/Nequi **NO** migradas (van a venir de `payment_gateway_configs` en T1.5)
- [x] `src/app/store/[slug]/order/[orderId]/pending/page.tsx`:
  - Eliminado helper `formatCurrency` local hardcoded; usa global con tenant context
  - 12 strings migrados al diccionario
- [x] `src/app/store/[slug]/order/[orderId]/error/page.tsx`:
  - Eliminado helper `formatCurrency` local hardcoded
  - 13 strings migrados (incluyendo helper `getErrorMessage()` que devuelve `t(...)`)
- [x] Validaciones: tsc + eslint + 44/44 tests verdes
- [x] Commit: `feat(i18n): T1.3b migrar order pages al diccionario`

### T1.3c — Layout + Header/Footer/Nav globales ✅ CERRADO

**Cerrado:** 2026-05-19

- [x] Extender SELECT de `getStoreData` con `currency_code, locale, country_code` en `src/app/store/[slug]/actions.ts`
- [x] Montar `<TenantLocaleProvider locale={tenantLocale.locale}>` en `src/app/store/[slug]/layout.tsx` (Server Component pasa locale a Client Component)
- [x] Agregar 22 keys al diccionario:
  - `store.nav.*` (home, products, properties, profile, about)
  - `store.header.*` (cart_aria, profile_aria, open_menu, close_menu, start_chat, close_chat, ask_ai, book_visit, see_all)
  - `store.footer.*` (tagline, links, legal, terms, privacy, powered_by)
  - `store.whatsapp.*` (contact_aria, greeting)
  - `store.chat.start_aria`
- [x] Migrar `src/components/store/store-header.tsx` (legacy, usado en /chat) con `useT()`
- [x] Migrar `src/components/store/store-footer.tsx` con `useT()`
- [x] Migrar `src/components/store/enhanced-store-header.tsx` + `MobileMenu` interno (el que realmente usa el storefront)
- [x] Migrar `src/app/store/[slug]/store-layout-client.tsx` (defaultMenuItems labels + WhatsApp aria/greeting + chat aria)
- [x] Validaciones: tsc + eslint + 44/44 tests verdes
- [x] Commit: `feat(i18n): T1.3c layout + header + footer + nav global del storefront`

### T1.3d — Templates de home ✅ CERRADO (parcial: minimal + complete)

**Cerrado:** 2026-05-19

- [x] **T1.3d.1** — `MinimalTemplate` (template default). 6 keys + 6 strings migrados.
- [x] **T1.3d.2** — `CompleteTemplate` (51KB, hero + steps + features + products + testimonios + CTA + footer). 27 keys + ~30 strings migrados.
- [ ] **T1.3d.3** — `SingleProductTemplate`, `ServicesTemplate`, `RealEstateTemplate`: pendientes hasta que algún tenant los use con locale `en-US`.
- [ ] **T1.3d.4** — Custom pages del tenant (about, FAQ, etc.): pendiente análisis si tienen strings de código (no solo data del tenant).

### T1.3f — Checkout completo ✅ CERRADO

**Cerrado:** 2026-05-19

- [x] **Diccionario**: ~70 keys nuevas en `store.checkout.*` (paridad es-CO/en-US, ~120 entries por locale).
- [x] **Helper `t()` extendido** con interpolación de placeholders `{{var}}` + 8 tests nuevos.
- [x] **`useT()` extendido** para aceptar segundo arg `params`.
- [x] **T1.3f.1** — Diccionario + chrome (`page.tsx` server, `checkout-page-client.tsx`) + orchestrator (`checkout-flow.tsx`). 25 strings.
- [x] **T1.3f.2** — Auxiliares (`order-summary.tsx`, `success-step.tsx`). 10 strings.
- [x] **T1.3f.3** — Forms (`contact-step.tsx`, `payment-step.tsx`). 31 strings.
- [x] Validaciones: tsc + eslint + 35/35 tests verdes.

**Limitaciones documentadas:** strings que dependen del país (tipos de documento CC/NIT/CE/Passport/TI, bandera +57, placeholder de teléfono colombiano, "Bancolombia / Nequi" subtítulo del método transferencia) **no se migran via diccionario** — quedan para T1.4 (forms country-aware) y T1.5 (manual offline payment).

### T1.3e — Carrito (drawer + sidebar) ✅ CERRADO

**Cerrado:** 2026-05-20

- [x] **Provider extendido**: `TenantLocaleProvider` ahora expone `currencyCode`. Nuevo hook `useTenantCurrency()` para Client Components.
- [x] **Layout server**: pasa `currency_code` derivado de `getTenantLocale()` al provider.
- [x] **Diccionario**: 28 keys nuevas en `store.cart.*` (paridad es-CO/en-US).
- [x] **`cart-drawer.tsx`** migrado + deuda técnica `any[]` cerrada.
- [x] **`cart-sidebar.tsx`** migrado completo:
  - 25+ strings UI a `useT()`.
  - `formatPrice` hardcoded → `formatCurrency` con `locale` + `currencyCode` del context.
  - Tracking events (`cart_opened`, `cart_coupon_*`, `cart_item_removed`, `cart_quantity_changed`) usan `currencyCode` dinámico — Meta/PostHog reciben USD para Tantor's House.
  - 5 `aria-label` agregados (mejora a11y).
- [x] 4 tests nuevos para keys del carrito (39/39 verdes en total).

**Limitaciones documentadas:**
- `formatPrice` del checkout (`src/components/checkout/utils/format-price.ts`) sigue hardcoded a `'es-CO'`/`'COP'`. Slice futuro de currency awareness del checkout.
- Tracking events del checkout (`currency: 'COP'` hardcoded en `checkout-flow.tsx`) misma situación.
- Cart en `/chat/[slug]/` cae a defaults (`es-CO`, `COP`) por falta de provider en ese layout. Sin regresión.

### T1.3g — Order detail page ✅ CERRADO

**Cerrado:** 2026-05-20

- [x] **Diccionario**: 25 keys nuevas en `store.order_detail.*` (paridad es-CO/en-US).
- [x] **`page.tsx`** (Server Component) migrado completo:
  - `getTenantLocale(organization)` deriva locale + currency dinámicamente.
  - `formatCurrency` local hardcoded → helper global parametrizado.
  - `getStatusConfig` refactorizado: retorna `labelKey` (type-safe `StorefrontStringKey`) en vez de label hardcoded.
  - `progressSteps` definido como array de keys i18n.
  - `whatsappMessage` interpolado vía `t()` con `{{number}}`.
  - `PurchaseTracker` recibe `currency={tenantLocale.currency}` — analytics correctos en USD para Tantor.
- [x] 5 tests nuevos: interpolación, status labels, payment badges, person type neutralizado.
- [x] 44/44 tests verdes.

**Limitaciones documentadas:**
- `formatBogotaDateTime` sigue hardcoded a `America/Bogota`. Timezone awareness queda para slice futuro (i18n fase 2).
- `document_type` `'CC'` hardcoded como fallback — dependiente de país, T1.4.
- `person_type === 'Jurídica'` comparison sigue siendo valor canónico CO. T1.4.

### T1.3h — Profile view + access form ✅ CERRADO

**Cerrado:** 2026-05-20

- [x] **Diccionario**: 60 keys nuevas en `store.profile.*` (paridad es-CO/en-US).
- [x] **`profile-view.tsx`** (Client) migrado completo:
  - `useT()`, `useTenantLocale()`, `useTenantCurrency()` del provider del slice T1.3e.
  - `formatCurrency` parametrizado con `locale` + `currency` del tenant.
  - `getStatusBadge` refactor: `getStatusBadgeMeta` helper retorna `{ className, labelKey, rawLabel }`. Type-safe contra el diccionario.
  - 50+ strings UI: header/nav, profile greeting interpolado, tabs, active shipments, orders history table (headers + filas + empty + showing count), conversations empty, tracking timeline, sidebar chats + help, floating WhatsApp button.
- [x] **`profile-access-form.tsx`** (Client) migrado: 12 strings + error handler con `t()` fallback.
- [x] 7 tests nuevos: interpolación de name/number/shown+total/org name, tabs, badges, access form CTAs.
- [x] 51/51 tests verdes.

**Limitaciones documentadas:**
- `formatBogotaDate` hardcoded a `America/Bogota` — slice futuro (i18n fase 2).
- `'+57'` prefix + `'300 123 4567'` placeholder + `pattern='[0-9]{10}'` son formato CO — T1.4.
- `<img>` del logo del header genera warning Next.js. Migrar a `<Image>` requiere agregar dominio a `remotePatterns` — slice futuro de optimización de imágenes.

### T1.3j — PDP (Product Detail Page) — EN PROGRESO

Dividido en 3 sub-slices por tamaño (2184 líneas client + page metadata + cta-button).

#### T1.3j.1 — Infraestructura ✅ CERRADO

**Cerrado:** 2026-05-20

- [x] **Helper `formatCurrency` local eliminado** (línea 187, hardcoded `'es-CO'`/`COP`). Reemplazado por:
  - Import del global con alias `formatTenantCurrency` desde `@/lib/utils`.
  - Type `FormatPriceFn` para inyección a sub-helpers stateless.
  - Closure `formatPrice` dentro del componente principal usando `useTenantLocale()` + `useTenantCurrency()`.
- [x] **Sub-helpers parametrizados**: `formatConfiguredCtaText(text, total, formatPrice)`, `<ProductShippingCard formatPrice={formatPrice} />`.
- [x] **Renombrado masivo**: 15+ call sites `formatCurrency(` → `formatPrice(`.
- [x] **`page.tsx` metadata** migrado: `priceLabel` usa `formatCurrency(p, { locale, currency })`. Tantor's House ve `$24.99` en OG/Twitter cards vs `$ 24.000` de tenants COP. 404 metadata + description fallback con `t(key, locale, params)` interpolada.
- [x] **`product-cta-button.tsx`**: 1 string ("Chatear para Comprar") migrado.
- [x] 4 keys nuevas en `store.product_detail.*` + 3 tests (54/54 verdes).
- [x] Cero `any` en el directorio `/producto/[slugOrId]/`.

#### T1.3j.2 — Render principal ✅ CERRADO

**Cerrado:** 2026-05-20

- [x] **`useT()` reintroducido** en el componente principal.
- [x] **Tracking event currency dinámica**: `trackAddToCart(..., currency)` en vez de `"COP"` hardcoded. Tantor envía `'USD'` a Meta/PostHog.
- [x] **`inventoryMessage` useMemo migrado**: 13 strings via `t()`, concordancia singular/plural inline para es-CO. `inventoryCfg{Badge,Title,Description}` extraídos a vars locales para satisfacer React Compiler.
- [x] **CTA defaults**: 6 fallback strings (`cta_buy_now`, `cta_buy_now_with_price` con `{{price}}` interpolado, etc.).
- [x] **Image OOS overlay**: `Color agotado` + `Agotado`.
- [x] **Bundle price block**: 4 strings (Valor individual, Descuento configurado, Precio del kit hoy, Ahorras X (Y% descuento)).
- [x] **Stock bar**: Disponibilidad, ¡Quedan solo X!, Disponible hoy, Agotado.
- [x] **Variant selectors**: tooltip + label `Agotado` (4 sitios).
- [x] **Quantity pricing**: título, mínimo, ranges (X-Y vs X+), per unit.
- [x] **Quantity selector**: Cantidad + Total.
- [x] **Hero value rows + signals**: 8 strings interpolados.
- [x] **Price support label**: 6 variantes traducidas.
- [x] **Active promotion label**: percent_off + amount_off.
- [x] **CTA unavailable**: 3 sitios (desktop, mobile sticky, desktop sticky).
- [x] **Helpers externos parametrizados**: `OfferCountdown` recibe `label`, `ProductShippingCard` recibe `labels` (objeto con funciones para interpolar).
- [x] 60 keys nuevas en `store.product_detail.*` + 8 tests (62/62 verdes).

#### T1.3j.3 — Secciones secundarias ✅ CERRADO

**Cerrado:** 2026-05-20

- [x] **`ProductVideoBlock`** parametrizado con `labels` (eyebrow/title/iframeTitle/description). Eliminado prop `productName` (ya no necesario).
- [x] **`ProductDescription`** parametrizado con `labels` (eyebrow/title/seeMore/seeLess).
- [x] **`ProductTrustRail`** invoca `useT()` directo. 5 strings + fallback `inventory_confirmed` + plural concordance en `days_label`.
- [x] **Trust badges chat**: 3 strings (assisted_purchase, whatsapp_available, we_help_chat).
- [x] **Section links**: 5 labels (benefits, specifications, questions, reviews, video).
- [x] **Reviews count inline**: `reviews_count_inline` con `{{plural}}` param para soportar singular/plural en ambos locales.
- [x] **AI recommendation heading**: "Recomendado por tu agente IA ✦".
- [x] **Sold/viewing inline counters**: 2 strings interpolados.
- [x] **Description fallback**: "Sin descripción disponible." → "No description available.".
- [x] **Reviews section completa**: title, subtitle, verified_purchase, showing_count (con shown/total interpolados).
- [x] **Benefits + FAQ section titles**: 2 strings.
- [x] **Bundle full section**: 5 strings (eyebrow, title, products_count, savings_amount_label, included_n).
- [x] **Related products section title**.
- [x] **WhatsApp default message** migrado con interpolación de `{{productName}}`.
- [x] **Date formatting** de reviews: `toLocaleDateString("es-CO")` → `toLocaleDateString(locale)`.
- [x] **Eliminados 2 `new Intl.NumberFormat('es-CO', ...)` hardcoded**: bundle discount label + related products price. Ambos ahora usan `formatPrice` closure.
- [x] 35 keys nuevas en `store.product_detail.*` + 10 tests (72/72 verdes).

#### T1.3j — PDP completo ✅ CERRADO

**Total slice T1.3j:** 4 + 60 + 35 = **99 keys nuevas** en `store.product_detail.*`. Diccionario actualizado a ~430 keys totales con paridad es-CO/en-US verificada por 72 tests.

PDP está ahora 100% i18n-aware. Tantor's House muestra:
- Strings UI en inglés.
- Precios en USD ($24.99) en lugar de COP ($ 24.000).
- Fechas formato US en reseñas.
- Tracking events con currency `'USD'` a Meta Pixel/PostHog.
- WhatsApp default message en inglés.
- OG/Twitter meta tags con currency correcta.

### T1.3i — Emails ✅ CERRADO

**Cerrado:** 2026-05-20

- [x] **`src/lib/notifications/email.ts`** migrado completo:
  - Imports nuevos: `t()` server-side, `formatCurrency` global parametrizado, tipos `SupportedCurrency`/`SupportedLocale`.
  - `OrderEmailData` interface acepta `locale?` y `currency?` (default es-CO/COP).
  - 2 helpers locales `formatCurrency` hardcoded a 'es-CO'/'COP' eliminados. Reemplazados por closure `formatPrice` usando el global parametrizado.
  - `sendOrderConfirmationEmail` + `generateOrderEmailHTML`: 25 strings hardcoded migrados a `t()`; subject interpolado; HTML completo localizado; payment method `'manual'` traducido como `'payment_bank_transfer'` (otros providers quedan crudos).
  - `sendOrderNotificationToOwner` + `generateOwnerNotificationHTML`: 8 strings + subject migrados.
- [x] **`src/app/chat/actions.ts`** caller actualizado:
  - Import `getTenantLocale`.
  - SELECT a `organizations` expandido a `locale` + `currency_code`.
  - Ambas llamadas pasan `locale: tenantLocale.locale` y `currency: tenantLocale.currency`.
- [x] 39 keys nuevas en `email.*` (28 confirmation + 11 owner) + 7 tests (79/79 verdes).
- [x] Backward compatible: tenants legacy con `locale/currency_code` en NULL siguen recibiendo emails idénticos al comportamiento previo.

**Limitaciones documentadas:** payment methods de providers (Wompi, MercadoPago, etc.) quedan crudos porque vienen pre-formateados de la capa del provider. Si en futuro hace falta traducirlos, agregar mapping en `email.order_confirmation.payment_*`.

### Criterios de aceptación T1.3 (cuando se cierre completo)

- ✅ Diccionario tiene cobertura del storefront público.
- ✅ Strings dispersos reemplazados por `t()` o `useT()`.
- ✅ Tenant en `es-CO` sigue viendo todo en español sin cambios visuales (verificado con QP/Tez/etc).
- ✅ Tenant en `en-US` (mock o Tantors) muestra storefront en inglés correctamente.
- ✅ Cero regresión en tests E2E (manuales) sobre tenants COP.

---

## T1.4 — Forms country-aware (direcciones) ✅ CERRADO

**Cerrado:** 2026-05-20
**Esfuerzo real:** 1.5h

### Implementación

Patrón final: **registry de country profiles** (no Zod discriminated union, que era over-engineering para single-country-per-tenant en Fase 1).

- [x] **Nueva infraestructura:**
  - `src/lib/i18n/country-profiles.ts` — `CountryProfile` interface + `COUNTRY_PROFILES` registry (CO + US) + `getCountryProfile(country)` defensivo.
  - `src/lib/constants/us-states.ts` — 50 states + DC + Puerto Rico (52 entries).
- [x] **Provider extendido:**
  - `TenantLocaleContextValue` agrega `country: SupportedCountry`.
  - `TenantLocaleProvider` acepta prop `country` (default `'CO'`).
  - Hook nuevo: `useTenantCountry()`.
- [x] **Strings i18n:** 11 keys US-specific (phone/document/state/city/address placeholders + person type Individual/Business).
- [x] **`contact-step.tsx`** migrado:
  - Phone: `profile.phoneFlag` + `profile.phonePrefix` + `profile.phonePlaceholderKey`.
  - Document types: `profile.documentTypes.map()` reemplaza los 5 `SelectItem` hardcoded.
  - Person type: `profile.personTypeOptions.map()` reemplaza los 2 radios hardcoded.
  - States: `profile.states` reemplaza `COLOMBIA_DEPARTMENTS` hardcoded.
  - City + address placeholders parametrizados.
- [x] **`checkout-flow.tsx`** migrado:
  - `identifyUser({ country: countryProfile.metaPixelCountry })` reemplaza `country: 'co'` hardcoded. Tantor ahora envía `'us'` a Meta Pixel Advanced Matching.
- [x] **`layout.tsx`** propaga `country={tenantLocale.country}` al provider.
- [x] **20 tests nuevos** en `country-profiles.test.ts` (registry completo, defaults CO/US, defensivo, keys i18n existen). 99/99 verdes globales.

### Criterios de aceptación T1.4

- ✅ Tenant CO ve formulario con departamento/ciudad como antes.
- ✅ Tenant US (Tantor) ve formulario con state/city.
- ✅ Phone prefix dinámico: `+57` (CO) vs `+1` (US).
- ✅ Document types dinámicos: CC/NIT/CE/Passport/TI (CO) vs SSN/EIN/Passport (US).
- ✅ Person type labels: Natural/Jurídica (CO) vs Individual/Business (US).
- ✅ Meta Pixel `country` field correcto por tenant.

### Limitaciones documentadas

- `ShippingFormInline` (`src/components/chat/shipping-form-inline.tsx`) está exportado pero NO se usa en producción (código muerto). Tiene hardcoded a CO. Se deja para limpieza futura.
- Validación Zod por country (de la propuesta original) NO se hizo. La validación actual del backend (`createOrder` en `actions.ts`) acepta cualquier shape de `customerInfo`. Si en futuro hace falta validar `state` ∈ `profile.states`, agregar al schema Zod del payload.

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
| T1.2 | ✅ Cerrado | 4h | 2026-05-19 |
| T1.3a | ✅ Infra diccionario cerrado | 3h | 2026-05-19 |
| T1.3b | ✅ Order pages migradas | 1h | 2026-05-19 |
| T1.3b' | ✅ SELECT order pages extendido | 5min | 2026-05-19 |
| T1.3c | ✅ Layout + header + footer + nav global | 2h | 2026-05-19 |
| T1.3d.1 | ✅ MinimalTemplate (home default) | 1h | 2026-05-19 |
| T1.3d.2 | ✅ CompleteTemplate (home alternativo, 51KB) | 2h | 2026-05-19 |
| T1.3f.1 | ✅ Checkout chrome + flow + diccionario + interpolación | 2h | 2026-05-19 |
| T1.3f.2 | ✅ Checkout OrderSummary + SuccessStep | 30min | 2026-05-19 |
| T1.3f.3 | ✅ Checkout ContactStep + PaymentStep (forms) | 1.5h | 2026-05-19 |
| T1.3e | ✅ Carrito (drawer + sidebar) + currency provider | 1.5h | 2026-05-20 |
| T1.3g | ✅ Order detail page + currency aware | 1h | 2026-05-20 |
| T1.3h | ✅ Profile view + access form | 1.5h | 2026-05-20 |
| T1.3j.1 | ✅ PDP infraestructura (formatCurrency + page metadata + cta) | 45min | 2026-05-20 |
| T1.3j.2 | ✅ PDP render principal + currency en tracking | 2h | 2026-05-20 |
| T1.3j.3 | ✅ PDP secciones secundarias + cierre completo PDP | 1.5h | 2026-05-20 |
| T1.3i | ✅ Email templates (cliente + owner) i18n-aware | 1h | 2026-05-20 |
| T1.4 | ✅ Forms country-aware (registry CO/US) | 1.5h | 2026-05-20 |
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
