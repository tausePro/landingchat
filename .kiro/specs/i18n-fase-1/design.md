# i18n Fase 1 — Diseño técnico

> Complementa: `requirements.md`
> Branch: `feat/i18n-fase-1`

---

## 1. Modelo de datos

### 1.1 Cambios en `organizations`

```sql
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS currency_code text NOT NULL DEFAULT 'COP'
    CHECK (currency_code IN ('COP', 'USD')),
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'es-CO'
    CHECK (locale IN ('es-CO', 'en-US')),
  ADD COLUMN IF NOT EXISTS country_code text NOT NULL DEFAULT 'CO'
    CHECK (country_code IN ('CO', 'US'));
```

**Garantías:**
- `NOT NULL DEFAULT` aplica a todas las filas existentes inmediatamente con el valor seguro.
- CHECK garantiza que solo valores válidos pueden insertarse.
- Ampliar a MX/ES/BR es una migración trivial: `DROP CONSTRAINT ... ADD CONSTRAINT ... CHECK (... IN (..., 'COP', 'USD', 'EUR', 'MXN', 'BRL'))`.

### 1.2 No tocar otras tablas en T1.1

- `products`, `product_variants` → siguen con `price` único en moneda del tenant. Fase 2 agrega `variant_prices` con multi-currency.
- `orders`, `order_items` → ya tienen `currency` en algunos casos (verificar). Fase 1 los normaliza a leer del tenant.
- `payment_gateway_configs.currency` → en Fase 1 sigue hardcoded `COP`. Fase 3 lo parametriza con Stripe.

### 1.3 RLS

No requiere políticas nuevas. Las columnas heredan las políticas existentes de `organizations` que ya filtran por `id = get_my_org_id()`.

---

## 2. Capa de tipos TypeScript

### 2.1 Extender `src/types/organization.ts`

```ts
export type SupportedCurrency = 'COP' | 'USD'
export type SupportedLocale = 'es-CO' | 'en-US'
export type SupportedCountry = 'CO' | 'US'

export interface Organization {
  // ...existentes
  currency_code: SupportedCurrency
  locale: SupportedLocale
  country_code: SupportedCountry
}
```

### 2.2 Helper de contexto

```ts
// src/lib/i18n/tenant-locale.ts
export interface TenantLocaleContext {
  currency: SupportedCurrency
  locale: SupportedLocale
  country: SupportedCountry
}

export function getTenantLocale(organization: Pick<Organization, 'currency_code' | 'locale' | 'country_code'>): TenantLocaleContext {
  return {
    currency: organization.currency_code,
    locale: organization.locale,
    country: organization.country_code,
  }
}

export const DEFAULT_TENANT_LOCALE: TenantLocaleContext = {
  currency: 'COP',
  locale: 'es-CO',
  country: 'CO',
}
```

---

## 3. `formatCurrency()` parametrizado (T1.2)

### 3.1 Estado actual

```ts
// src/lib/utils.ts
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount)
}
```

Hardcoded a `es-CO + COP + 0 decimales`. Usado por ~40+ componentes según grep.

### 3.2 Refactor backward-compatible

```ts
export interface FormatCurrencyOptions {
  currency?: SupportedCurrency
  locale?: SupportedLocale
  fractionDigits?: number
}

export function formatCurrency(amount: number, options?: FormatCurrencyOptions): string {
  const currency = options?.currency ?? 'COP'
  const locale = options?.locale ?? 'es-CO'
  const fractionDigits = options?.fractionDigits ?? (currency === 'USD' ? 2 : 0)

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(amount)
}
```

**Backward compat:** Sin opciones → idéntico al comportamiento actual. Componentes existentes no requieren cambio inmediato.

**Migración progresiva:** componentes de storefront van adoptando la versión parametrizada cuando reciben el contexto del tenant.

---

## 4. i18n strings storefront (T1.3)

### 4.1 Diccionario simple sin librería

```ts
// src/lib/i18n/storefront-strings.ts
export const storefrontStrings = {
  'es-CO': {
    'cart.empty': 'Tu carrito está vacío',
    'cart.checkout': 'Ir a pagar',
    'product.add_to_cart': 'Agregar al carrito',
    'checkout.shipping': 'Envío',
    // ... ~200-400 strings
  },
  'en-US': {
    'cart.empty': 'Your cart is empty',
    'cart.checkout': 'Checkout',
    'product.add_to_cart': 'Add to cart',
    'checkout.shipping': 'Shipping',
    // ...
  },
} as const

export type StorefrontStringKey = keyof typeof storefrontStrings['es-CO']

export function t(key: StorefrontStringKey, locale: SupportedLocale = 'es-CO'): string {
  return storefrontStrings[locale]?.[key] ?? storefrontStrings['es-CO'][key]
}
```

### 4.2 Hook React para usar en componentes

```ts
// src/lib/i18n/use-tenant-strings.ts
'use client'

import { createContext, useContext } from 'react'
import type { SupportedLocale } from '@/types/organization'
import { t as translateRaw, type StorefrontStringKey } from './storefront-strings'

const TenantLocaleContext = createContext<SupportedLocale>('es-CO')

export const TenantLocaleProvider = TenantLocaleContext.Provider

export function useT() {
  const locale = useContext(TenantLocaleContext)
  return (key: StorefrontStringKey) => translateRaw(key, locale)
}
```

### 4.3 Server Components

Para Server Components (que es la mayoría del storefront), `t(key, organization.locale)` directo sin hook.

---

## 5. Forms country-aware (T1.4)

### 5.1 Schema condicional con Zod discriminatedUnion

```ts
// src/lib/validation/shipping-address.ts
import { z } from 'zod'

const ShippingAddressCO = z.object({
  country_code: z.literal('CO'),
  departamento: z.string().min(2),
  ciudad: z.string().min(2),
  direccion: z.string().min(5),
})

const ShippingAddressUS = z.object({
  country_code: z.literal('US'),
  state: z.string().length(2), // 2-letter US state code
  city: z.string().min(2),
  zip_code: z.string().regex(/^\d{5}(-\d{4})?$/),
  address_line_1: z.string().min(5),
  address_line_2: z.string().optional(),
})

export const ShippingAddressSchema = z.discriminatedUnion('country_code', [
  ShippingAddressCO,
  ShippingAddressUS,
])

export type ShippingAddress = z.infer<typeof ShippingAddressSchema>
```

### 5.2 Componente que renderiza según país

`<ShippingAddressForm countryCode={organization.country_code}>` renderiza el subset correcto de campos.

---

## 6. Método de pago manual offline (T1.5)

### 6.1 Sin gateway nuevo

No requiere nuevo `PaymentGateway` en el registry. Es un "no-gateway" — la orden se crea en estado `pending` con instrucciones visibles al cliente.

### 6.2 Configuración por tenant

```sql
-- Reusar payment_gateway_configs con provider='manual'
INSERT INTO payment_gateway_configs (organization_id, provider, settings, ...)
VALUES (
  $org_id,
  'manual',
  '{"type": "zelle", "instructions_md": "...", "contact": "tantors@..."}'::jsonb,
  ...
);
```

Ampliar el CHECK constraint del provider:

```sql
ALTER TABLE payment_gateway_configs
  DROP CONSTRAINT IF EXISTS payment_gateway_configs_provider_check;
ALTER TABLE payment_gateway_configs
  ADD CONSTRAINT payment_gateway_configs_provider_check
  CHECK (provider IN ('wompi', 'epayco', 'bold', 'addi', 'manual'));
```

### 6.3 UI del checkout

Cuando el cliente elige "Pago manual offline":
1. Storefront muestra `instructions_md` del config.
2. Cliente hace clic en "Confirmar pedido".
3. Orden se crea con `payment_method: 'manual'`, `payment_status: 'pending'`.
4. Email de confirmación incluye instrucciones de pago.
5. Merchant valida pago externamente (Zelle, banco, etc.) y marca como pagada en dashboard.

### 6.4 `markOrderAsPaid` server action

```ts
// src/app/dashboard/orders/[id]/actions.ts
export async function markOrderAsPaid(orderId: string, note?: string): Promise<ActionResult<void>> {
  // 1. Validar permisos (RLS)
  // 2. Actualizar order.payment_status = 'paid', payment_confirmed_at = now(), confirmed_by = userId
  // 3. Insertar audit log con note y userId
  // 4. Trigger email confirmación pagada al cliente
  // 5. Decrementar stock idempotentemente (si no se hizo ya)
}
```

---

## 7. AI agent locale-aware (T1.7)

### 7.1 System prompt parametrizado

```ts
// src/lib/ai/chat-agent.ts
function buildSystemPrompt(organization: Organization): string {
  const localeInstruction = organization.locale === 'en-US'
    ? 'Respond ALWAYS in English. Do not switch to Spanish unless the customer writes in Spanish.'
    : 'Responde SIEMPRE en español. No cambies a inglés a menos que el cliente escriba en inglés.'

  return `
${baseInstructions}
${localeInstruction}
Currency: ${organization.currency_code}
Country: ${organization.country_code}
  `.trim()
}
```

---

## 8. Emails bilingües (T1.7)

### 8.1 Estructura de archivos

```
src/components/emails/
  order-confirmation/
    es.tsx       # template español
    en.tsx       # template inglés
    index.tsx    # selector según locale
```

### 8.2 Selector

```tsx
// src/components/emails/order-confirmation/index.tsx
import OrderConfirmationES from './es'
import OrderConfirmationEN from './en'

export function OrderConfirmation({ locale, ...props }: { locale: SupportedLocale } & Props) {
  if (locale === 'en-US') return <OrderConfirmationEN {...props} />
  return <OrderConfirmationES {...props} />
}
```

---

## 9. Estrategia de tests

### 9.1 Tests unitarios

- `formatCurrency()`: COP sin decimales, USD con 2 decimales, locale formats.
- `t(key, locale)` fallback a `es-CO` si falta traducción.
- Schema Zod `ShippingAddressSchema` rechaza inputs incorrectos.
- `getTenantLocale(org)` retorna defaults correctos.

### 9.2 Tests de integración

- Mock `organizations` con `currency_code='USD', locale='en-US'`.
- Verificar que `formatCurrency(100, getTenantLocale(org))` retorna `"$100.00"`.
- Verificar que un order checkout en `en-US` muestra strings en inglés.

### 9.3 Tests E2E manuales (QA gate)

- QP en COP/es-CO: ningún cambio visible.
- Tantors en USD/en-US: catálogo → carrito → checkout → confirmación, todo en inglés con precios en USD.

---

## 10. Riesgos técnicos

### 10.1 `formatCurrency()` usado en 40+ componentes

Migrar todos a la versión parametrizada de un golpe es alto riesgo. **Estrategia:** mantener backward compat (default `COP/es-CO`), migrar componentes solo cuando reciban el contexto del tenant. T1.3 prioriza componentes del storefront público; dashboard interno se queda con default hasta Fase 3.

### 10.2 `accept-language` del navegador vs `organization.locale`

En Fase 1 ignoramos `accept-language` del navegador. **El locale lo dicta el tenant**, no el cliente final. Si Tantors tiene `locale='en-US'`, todos los visitantes ven inglés, aunque hablen español. Cliente que necesite multi-locale por visitor → es Fase 2.

### 10.3 Strings dispersos vs diccionario centralizado

Hay strings hardcoded en 50+ archivos del storefront. **Migración progresiva por slice T1.3:** extraer en orden de prioridad (homepage → PDP → carrito → checkout → emails). Aceptar que durante T1.3 algunos strings sigan hardcoded; el siguiente slice los completa.

### 10.4 AI executor confundiendo idiomas

Riesgo descrito en RF7. Mitigación: forzar idioma en system prompt. Validar con prompt de prueba en QA.

---

## 11. Plan de migración progresiva

| Etapa | Estado |
| --- | --- |
| Tenants existentes | Sin cambio (`COP/es-CO/CO` por default) |
| Tantors onboarding | Override manual a `USD/en-US/US` por superadmin |
| Storefront Tantors | Renderiza con strings inglesas + precios USD |
| Tantors checkout | Forms US, método pago manual Zelle |
| Tantors emails | Templates en inglés |
| Tantors AI agent | Prompt forzando inglés |

Cada etapa es un slice independiente. Tantors arranca operativo cuando los slices T1.1 a T1.7 estén cerrados.
