# 🔍 Auditoría Técnica Completa — LandingChat

**Fecha:** 16 de febrero de 2026  
**Alcance:** Revisión archivo por archivo de toda la plataforma  
**Criterio:** Bugs, seguridad, deuda técnica, duplicaciones, mejoras  

---

## 📊 Resumen Ejecutivo

| Categoría | Crítico | Alto | Medio | Bajo |
|-----------|---------|------|-------|------|
| Seguridad | 3 | 4 | 2 | 1 |
| Bugs / Código Roto | 2 | 3 | 4 | 2 |
| Duplicaciones | 0 | 3 | 5 | 3 |
| Deuda Técnica | 0 | 5 | 8 | 6 |
| Mejoras de Arquitectura | 0 | 2 | 5 | 4 |

---

## 🚨 CRÍTICO — Requiere acción inmediata

### C1. API Routes de migración/fix expuestas en producción SIN autenticación

**Archivos afectados:**
- `src/app/api/fix-customers-table/route.ts`
- `src/app/api/fix-security-policies/route.ts`
- `src/app/api/setup-agent/route.ts`

**Problema:** Estas rutas ejecutan SQL directo con `SUPABASE_SERVICE_ROLE_KEY` sin NINGUNA verificación de autenticación. Cualquier persona puede hacer POST a `/api/fix-customers-table` o `/api/fix-security-policies` y ejecutar migraciones DDL en producción. La ruta `fix-security-policies` incluso modifica políticas RLS.

**Impacto:** Vulnerabilidad de seguridad **extrema**. Un atacante podría alterar la estructura de la base de datos.

**Recomendación:** Eliminar estas rutas de producción inmediatamente o, como mínimo, protegerlas con autenticación de superadmin.

---

### C2. API Routes de test/debug expuestas en producción SIN autenticación

**Archivos afectados:**
- `src/app/api/test/route.ts` — Expone datos de organizaciones y productos
- `src/app/api/test-claude/route.ts` — Consume créditos de Anthropic sin control
- `src/app/api/test-nuby/route.ts` — Expone tokens desencriptados y stack traces
- `src/app/api/debug/domain/route.ts`
- `src/app/api/meta-config/route.ts`

**Problema:** Todas estas rutas están accesibles públicamente. `test-nuby` especialmente peligroso porque desencripta tokens de API y los expone en respuesta JSON. `test-claude` gasta créditos de la API de Anthropic sin rate limiting.

**Impacto:** Fuga de credenciales, costos innecesarios, superficie de ataque expuesta.

**Recomendación:** Eliminar todas las rutas de test/debug del código de producción.

---

### C3. Salt estático y hardcodeado en encriptación

**Archivo:** `src/lib/utils/encryption.ts:21`

```typescript
return crypto.scryptSync(key, "salt", 32)
```

**Problema:** El salt es el string literal `"salt"`. Esto debilita significativamente la derivación de clave. Si un atacante obtiene datos encriptados, el salt predecible facilita ataques de diccionario.

**Impacto:** Todas las credenciales encriptadas en la BD (payment_gateway_configs, tokens de API) son más vulnerables de lo necesario.

**Recomendación:** Usar un salt aleatorio por cada encriptación o, mínimo, un salt único derivado de una variable de entorno dedicada.

---

## 🔴 ALTO — Bugs y problemas serios

### A1. Inconsistencia de modelo AI: metadata reporta un modelo, se usa otro

**Archivo:** `src/lib/ai/chat-agent.ts`

- **Línea 299:** Se llama a Claude con `model: "claude-3-5-haiku-latest"`
- **Línea 401:** El metadata de retorno dice `model: "claude-sonnet-4-20250514"`
- **Línea 373:** El metadata guardado en BD dice `model: "claude-3-5-haiku-latest"`

**Problema:** El modelo real usado es Haiku, pero la interfaz reporta Sonnet 4. Esto genera datos de analytics incorrectos y confusión sobre costos.

---

### A2. Duplicación completa del módulo Wompi (2 implementaciones paralelas)

**Archivos duplicados:**
- `src/lib/wompi/client.ts` + `src/lib/wompi/types.ts` — Cliente para suscripciones
- `src/lib/payments/wompi-gateway.ts` — Gateway para pagos de tienda

**Problema:** Dos implementaciones independientes de Wompi con lógica duplicada:
- Ambas implementan `createTransaction`, `getTransaction`, `getTransactionByReference`, `validateWebhookSignature`, `testConnection`
- Ambas definen las mismas constantes de URL (`WOMPI_API_URL`)
- Ambas tienen su propia lógica de validación de firma

**Impacto:** Si se corrige un bug de Wompi en una, la otra queda rota. Mantenimiento duplicado.

---

### A3. Webhook de Wompi duplicado (2 endpoints diferentes)

**Archivos:**
- `src/app/api/webhooks/wompi/route.ts` — Para suscripciones (usa `WompiClient`)
- `src/app/api/webhooks/payments/wompi/route.ts` — Para órdenes de tienda (usa `WompiGateway`)

**Problema:** Dos webhooks de Wompi con lógicas completamente diferentes, cada uno con su propia función `logWebhook` y su propio mapeo de estados. Si Wompi se configura para enviar a un solo endpoint, el otro queda sin funcionar.

Además, `webhooks/payments/wompi/route.ts` define su propia función `logWebhook` local (línea 306) que es independiente de la función en `webhook-utils.ts`.

---

### A4. `createServiceClient()` no es async, pero `PaymentService` lo trata como async

**Archivo:** `src/lib/payments/payment-service.ts:90`

```typescript
const supabase = await createServiceClient()  // ← await innecesario, no es Promise
```

**Vs.** `src/lib/supabase/server.ts:73` donde `createServiceClient()` es síncrono.

Esto no causa un error runtime (await de un non-Promise retorna el valor), pero indica confusión sobre la API e inconsistencia. También ocurre en `src/lib/whatsapp/provider.ts:51` y `src/lib/messaging/unified.ts:34`.

---

### A5. Archivo vacío: `embeddings.ts`

**Archivo:** `src/lib/ai/embeddings.ts` — 0 bytes

**Problema:** Archivo vacío que fue parte de una feature de product embeddings (migración `20241215_product_embeddings.sql` existe). La migración crea la tabla `product_embeddings` pero no hay código que la use.

---

### A6. Middleware hace hasta 5 queries a Supabase por request

**Archivo:** `src/middleware.ts`

Para un request a un subdominio con mantenimiento activo y usuario autenticado, el middleware ejecuta:
1. Query para dominio personalizado (línea 157)
2. Query de mantenimiento (línea 243)
3. `auth.getUser()` (línea 277)
4. Query de perfil (línea 294)
5. `auth.getUser()` de nuevo en `handleAuth` (línea 409)
6. Query de perfil de nuevo para onboarding (línea 431)
7. Query de organización para onboarding (línea 439)

**Impacto:** Latencia significativa en cada request. El cache en memoria ayuda pero no cubre todos los casos.

---

### A7. `identifyCustomer` duplicada en 3 ubicaciones

**Archivos:**
1. `src/lib/ai/tool-executor.ts` → `identifyCustomer()` (línea 123)
2. `src/lib/messaging/unified.ts` → `identifyCustomer()` (línea 250)
3. `src/lib/whatsapp/webhook-utils.ts` → `findOrCreateCustomer()` (línea 23)

Cada una con lógica sutilmente diferente:
- `tool-executor` busca por email O phone, crea con `full_name`
- `unified.ts` busca por phone O email, crea con `name` y campo `source`
- `webhook-utils` usa variantes de teléfono (`getPhoneVariants`), normaliza phone

**Problema:** La del `tool-executor` NO normaliza teléfonos ni usa variantes. Si un cliente se registra por WhatsApp (phone normalizado) y luego por web chat (phone sin normalizar), se crean 2 clientes duplicados.

---

## 🟡 MEDIO — Deuda técnica y mejoras importantes

### M1. Uso masivo de `any` — 252 ocurrencias en 104 archivos

Los peores ofensores:
- `src/lib/ai/tool-executor.ts` — **51 usos** de `any` (parámetro `supabase: any`, `input: any`, etc.)
- `src/app/dashboard/chats/actions.ts` — 14 usos
- `src/app/store/[slug]/producto/[slugOrId]/product-detail-client.tsx` — 13 usos

**Impacto:** Se pierde toda la seguridad de tipos de TypeScript. Bugs silenciosos, refactoring peligroso.

---

### M2. Opciones de envío hardcodeadas

**Archivo:** `src/lib/ai/tool-executor.ts:556-578`

```typescript
const options = [
    { id: "standard", name: "Envío Estándar", price: 10000, days: "3-5 días hábiles" },
    { id: "express", name: "Envío Express", price: 20000, days: "1-2 días hábiles" }
]
```

Las opciones de envío están hardcodeadas directamente en el tool executor. Debería usar `shipping_settings` de la BD.

---

### M3. `formatCurrency` duplicada en 3+ lugares

- `src/lib/utils.ts:25` → `formatCurrency()`
- `src/lib/ai/tool-executor.ts:1392` → `formatPrice()` (definida inline 2 veces: línea 1392 y 1433)
- Múltiples componentes con su propio format inline

---

### M4. Migraciones SQL sin convención de nombres consistente

**Directorio:** `migrations/`

Hay 71 archivos de migración con 2 convenciones de nombres mezcladas:
- Con fecha: `20241124_schema.sql`, `20250216_appointments.sql`
- Sin fecha: `add_agent_policies.sql`, `create_badges_table.sql`, `fix_agent_insert_policy.sql`

Las migraciones sin fecha no tienen orden de ejecución definido. Algunas parecen ser duplicadas o superpuestas:
- `20241124_fix_products_rls.sql` + `add_product_policies.sql`
- `20241128_fix_customers_table.sql` + `enhance_customers_table.sql`
- `20241204_fix_security_policies.sql` + `enable_rls_security_fixes.sql` + `optimize_rls_policies.sql`

---

### M5. `console.log` extensivo en producción

Hay logging de debug masivo en archivos críticos:
- `src/lib/ai/chat-agent.ts` — 15+ console.log con datos de agente, productos, contexto
- `src/lib/ai/tool-executor.ts` — console.log en cada tool execution
- `src/app/api/ai-chat/route.ts` — Loguea si API keys están configuradas
- `src/middleware.ts` — console.log en cada request con slug

Mientras que existe un `logger.ts` estructurado, la mayoría del código usa `console.log` directo.

---

### M6. `searchProducts` no valida input con Zod schema

**Archivo:** `src/lib/ai/tool-executor.ts:223-224`

```typescript
async function searchProducts(supabase: any, input: any, context: ToolContext) {
    const { query, category, max_price, limit = 5 } = input  // ← Sin validación
```

A diferencia de otros tools que usan `Schema.parse(input)`, `searchProducts` extrae directamente del input sin validación. También `showProduct` (línea 269) y `getProductAvailability` (línea 302) no validan.

---

### M7. Rate limiting solo en `/api/ai-chat`, no en otros endpoints

El rate limiting con Upstash Redis solo está implementado para el endpoint de chat AI. Los webhooks, API de store, y endpoints admin no tienen rate limiting.

---

### M8. `normalizePhone` solo soporta Colombia (57)

**Archivo:** `src/lib/utils/phone.ts`

La normalización de teléfono asume código de país 57 (Colombia). Si la plataforma se expande a otros países de LATAM, toda la lógica de identificación de clientes fallará.

---

### M9. `PaymentService` en `payment-service.ts` es singleton pero crea nueva instancia de gateway por cada llamada

**Archivo:** `src/lib/payments/payment-service.ts`

```typescript
export const paymentService = new PaymentService()  // Singleton
```

Pero `PaymentService` no tiene estado — cada llamada a `initiatePayment` crea un nuevo gateway. El singleton no aporta nada.

---

### M10. Cross-channel context hace N+1 queries

**Archivo:** `src/lib/ai/chat-agent.ts:230-264`

Para cargar contexto cross-channel, se hace:
1. Una query para obtener chats del cliente en otros canales (hasta 3)
2. Por CADA chat, una query para obtener últimos mensajes

Esto puede resultar en 4 queries solo para contexto cross-channel, sumadas a las 7+ queries que ya hace `processMessage`.

---

### M11. Webhook `[...event]/route.ts` catch-all para Evolution

**Archivo:** `src/app/api/webhooks/whatsapp/[...event]/route.ts`

Existe una ruta catch-all además de `route.ts` para el mismo endpoint de WhatsApp Evolution. Esto puede causar conflictos de routing.

---

### M12. Campo `agent_id` vs `assigned_agent_id` inconsistente

En `src/lib/messaging/unified.ts:39`:
```typescript
.select("organization_id, customer_id, agent_id")
```

Pero en `src/app/api/ai-chat/route.ts:127`:
```typescript
.select("assigned_agent_id, customer_id, organization_id")
```

El campo real de la tabla podría ser `assigned_agent_id`. Si `agent_id` no existe, el unified messaging silenciosamente falla al obtener el agente.

---

### M13. `buildConversationHistory` es un pass-through innecesario

**Archivo:** `src/lib/ai/context.ts:316-321`

```typescript
export function buildConversationHistory(messages: Message[]) {
    return messages.map(msg => ({ role: msg.role, content: msg.content }))
}
```

Esta función simplemente mapea el array sin transformación real. Es overhead innecesario.

---

## 🟢 BAJO — Mejoras de calidad y limpieza

### B1. Archivos de documentación/plan excesivos en la raíz del proyecto

**24+ archivos `.md`** en la raíz que no son documentación del proyecto sino notas de debug, planes, análisis:
- `AI_AGENT_DEBUG_STATUS.md`
- `ANALISIS-IMPACTO-TESTS.md`
- `CHAT_ARCHITECTURE_ANALYSIS.md`
- `CHECKLIST-DEMO-MARTES.md`
- `CRITICAL_SECURITY_ACTION_PLAN.md`
- `CUSTOMER_PROFILE_IMPLEMENTATION.md`
- `EPAYCO_CONFIGURATION_FIX.md`
- `ESLINT_REMEDIATION_PLAN.md`
- `ESTADO-FINAL-RESTAURACION.md`
- etc.

Estos archivos contaminan la raíz y hacen difícil encontrar la documentación real.

---

### B2. Archivo suelto en raíz: `test-claude.ts` y `validate_security_fixes.ts`

Archivos TypeScript sueltos en la raíz del proyecto que no forman parte del build ni de los tests.

---

### B3. `getCookieOptions` es un pass-through en middleware y server.ts

**Archivos:** `src/middleware.ts:372-374` y `src/lib/supabase/server.ts:17-19`

```typescript
function getCookieOptions(options?: Record<string, unknown>) {
    return options || {}
}
```

Función idéntica duplicada en 2 archivos que simplemente retorna su argumento. No agrega valor.

---

### B4. `buildProductContext` nunca se usa en producción

**Archivo:** `src/lib/ai/context.ts:271-287`

La función `buildProductContext` genera contexto de productos, pero `buildSystemPromptOptimized` (la función usada en producción) solo necesita el count, no la lista de productos. Es código muerto.

---

### B5. `buildSystemPrompt` (legacy) es un wrapper innecesario

**Archivo:** `src/lib/ai/context.ts:260-268`

```typescript
export function buildSystemPrompt(...) {
    return buildSystemPromptOptimized(agent, organizationName, products.length, customer, currentProduct)
}
```

Función legacy que no se usa en ningún lugar del código actual.

---

### B6. `.antigravity/` directorio con archivos de notas de desarrollo

Directorio con notas personales de desarrollo que no debería estar en el repo.

---

### B7. `postcss.config.mjs` sin verificar

Faltaría verificar que la configuración de PostCSS es consistente con Tailwind v4.

---

## 📐 Arquitectura — Observaciones

### ARQ1. El `tool-executor.ts` es un archivo monolítico de 1479 líneas

Contiene la implementación de **21 tools** en un solo archivo. Debería dividirse en módulos:
- `tools/cart.ts`
- `tools/products.ts`
- `tools/checkout.ts`
- `tools/properties.ts`
- `tools/appointments.ts`

---

### ARQ2. El middleware es demasiado complejo (475 líneas)

Maneja:
- Cache en memoria + circuit breaker
- Modo emergencia
- Detección de slug (dev/prod/subdomain/custom domain)
- Redirecciones de campañas
- Modo mantenimiento (con bypass token y auth check)
- Reescritura de URLs
- Autenticación + onboarding

Debería dividirse en middlewares encadenados o al menos funciones auxiliares separadas.

---

### ARQ3. No hay generación de tipos de Supabase

No existe un archivo `database.types.ts` generado automáticamente. Todo el tipado de BD es manual, lo que explica el uso masivo de `any` en las queries.

**Recomendación:** Ejecutar `npx supabase gen types typescript` para generar tipos automáticos.

---

### ARQ4. No hay capa de abstracción para BD

Cada archivo hace queries directas a Supabase. No hay un "repository pattern" ni funciones de acceso centralizadas. Si la estructura de una tabla cambia, hay que buscar y actualizar queries en decenas de archivos.

---

### ARQ5. Los prompts del sistema están inline en código TypeScript

Los prompts de AI (>200 líneas) están embebidos directamente en `context.ts` y `chat-agent.ts`. Deberían estar en archivos separados (`.txt` o `.md`) para facilitar iteración sin tocar código.

---

## 📋 Resumen de acciones prioritarias

### Inmediato (esta semana)
1. ❌ **Eliminar** rutas de fix/test/debug de producción (C1, C2)
2. 🔐 **Corregir** salt de encriptación (C3)
3. 🔧 **Corregir** modelo reportado en metadata del AI (A1)

### Corto plazo (2 semanas)
4. 🗑️ **Consolidar** módulo Wompi en una sola implementación (A2, A3)
5. 🔄 **Unificar** lógica de `identifyCustomer` usando `normalizePhone` + `getPhoneVariants` en todos los puntos de entrada (A7)
6. 📝 **Generar tipos de Supabase** y reemplazar `any` progresivamente (M1, ARQ3)

### Medio plazo (1 mes)
7. 🏗️ **Dividir** `tool-executor.ts` en módulos (ARQ1)
8. 📊 **Reemplazar** `console.log` con `logger` estructurado (M5)
9. ⚡ **Optimizar** queries del middleware (A6)
10. 🧹 **Limpiar** migraciones y establecer convención única (M4)
11. 🗂️ **Mover** archivos `.md` de debug a `docs/internal/` (B1)

---

*Auditoría realizada sobre la rama actual del proyecto. No se modificó ningún archivo.*
