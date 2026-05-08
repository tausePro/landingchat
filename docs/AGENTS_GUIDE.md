# AGENTS_GUIDE.md - Guía operativa detallada para agentes en LandingChat

Este archivo expande el índice [AGENTS.md](../AGENTS.md) con las convenciones operativas detalladas. Es de consulta. Las reglas estables y la lista de fuentes autoridad viven en `AGENTS.md` (raíz).

> **Política**: este archivo describe el estado actual del proyecto. Si una regla aquí entra en conflicto con `docs-private/MANDATO_PRODUCTO_Y_ARQUITECTURA.md` o `docs-private/VISION_2026_CAMINO_ELEGIDO.md`, manda la doc autoridad.

## 🎯 Sobre el Proyecto

LandingChat es una plataforma de comercio conversacional para LATAM que permite a negocios vender a través de agentes AI integrados con WhatsApp.

**Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, Supabase, Claude AI
**Multi-tenant:** Cada organización tiene su subdominio (ej: `tez.landingchat.co`)
**Idioma del código:** Comentarios en español, código en inglés

## 🚀 Setup

```bash
# Instalar dependencias
npm install

# Variables de entorno
cp .env.example .env.local
# Configurar: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
#             SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY

# Desarrollo
npm run dev

# Tests
npm run test
npm run test:coverage
```

## 📁 Estructura del Proyecto

```
src/
├── app/                    # Next.js App Router
│   ├── api/                # API routes (webhooks, ai-chat, etc.)
│   ├── dashboard/          # Panel de administración (autenticado)
│   ├── store/[slug]/       # Storefront público
│   ├── chat/[slug]/        # Chat de ventas
│   └── admin/              # Panel de superadmin
├── components/
│   ├── ui/                 # Componentes base (shadcn)
│   ├── store/              # Componentes de tienda
│   └── shared/             # Componentes reutilizables
├── lib/
│   ├── ai/                 # Integración Claude (tools, context, agent)
│   ├── supabase/           # Clientes Supabase
│   ├── payments/           # Wompi, ePayco
│   ├── utils/              # Utilidades (encryption, slug, urls)
│   └── evolution/          # WhatsApp Evolution API
├── types/                  # Tipos TypeScript centralizados
└── proxy.ts                # Routing de subdominios + auth

migrations/                 # SQL migrations para Supabase
.kiro/specs/                # Especificaciones de Kiro (vivos)
.kiro/specs/_done/          # Specs completados
.kiro/specs/_archive/       # Specs descartados o vacíos
```

## 🔒 Reglas de Seguridad

**CRÍTICO - Siempre verificar:**

- **RLS (Row Level Security):** NUNCA usar `USING (true)` en tablas sensibles
- **Service Client:** Solo usar `createServiceClient()` cuando sea absolutamente necesario
- **Webhooks:** Siempre validar firma antes de procesar
- **API Keys:** Nunca loguear en `console.log`
- **Encriptación:** Usar `encrypt()/decrypt()` para datos sensibles

**Tablas sensibles (requieren RLS estricto):**
- `customers` - Datos personales
- `orders` - Transacciones
- `payment_gateway_configs` - Credenciales encriptadas
- `webhook_logs` - Logs de pagos

## 🧪 Testing

**Patrón de tests:**
```typescript
// Usar fast-check para property-based testing
import fc from 'fast-check'

// Tests en src/__tests__/
// Seguir patrón de archivos existentes: *.property.test.ts
```

**Áreas críticas (requieren >80% cobertura):**
- `src/lib/utils/encryption.ts`
- `src/app/api/webhooks/payments/`
- `src/proxy.ts`
- `src/lib/ai/tool-executor.ts`

**Comandos:**
```bash
npm run test                    # Ejecutar tests
npm run test:coverage           # Con cobertura
npm run test src/__tests__/lib  # Tests específicos
```

## 📝 Convenciones de Código

**TypeScript:**
- ❌ NO usar `any` - usar `unknown` o tipos específicos
- ✅ Usar Zod para validación de inputs
- ✅ Usar `ActionResult<T>` para retornos de server actions
- ✅ Si se toca un archivo y hay `any` o deuda local de tipado de bajo riesgo en el mismo bloque/flujo, corregirla dentro del slice
- ❌ NO convertir un fix acotado en un refactor transversal solo por perseguir deuda técnica

**React:**
- ✅ Componentes funcionales con hooks
- ✅ Server Components por defecto, `'use client'` solo cuando necesario
- ❌ NO usar `<img>` - usar `next/image`

**Server Actions:**
```typescript
// Patrón estándar
export async function myAction(input: MyInput): Promise<ActionResult<MyOutput>> {
  try {
    const validated = MySchema.parse(input)
    // ... lógica
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: 'Mensaje amigable' }
  }
}
```

**Commits:**
- `feat:` nueva funcionalidad
- `fix:` corrección de bug
- `refactor:` refactorización sin cambiar funcionalidad
- `docs:` documentación
- `test:` agregar o modificar tests
- `security:` mejoras de seguridad

## 🧠 Preservación de contexto

- Toda decisión importante de arquitectura o rollout debe quedar en `docs-private/` si pertenece a un frente activo
- `AGENTS.md` (raíz) refleja reglas estables; este `AGENTS_GUIDE.md` refleja convenciones operativas detalladas
- Si un frente tiene invariantes operativos claros, documentarlos explícitamente para que no dependan de la memoria del chat
- Antes de asumir arquitectura o fuentes de datos, revisar primero la documentación vigente del workspace y luego el código autoridad

## 🗄️ Base de Datos

**Clientes Supabase:**
```typescript
// Usuario autenticado (respeta RLS)
import { createClient } from '@/lib/supabase/server'

// Service role (bypassa RLS) - USAR CON CUIDADO
import { createServiceClient } from '@/lib/supabase/server'
```

**Migraciones:**
- Ubicación: `migrations/`
- Naming: `YYYYMMDD_descripcion.sql`
- Siempre usar `IF NOT EXISTS` y `DROP POLICY IF EXISTS`
- Auditoría RLS: ejecutar `scripts/db-audit-rls.sql` en Supabase SQL Editor periódicamente

## 🌐 Multi-tenancy

**Cómo funciona:**
- `tez.landingchat.co` → middleware reescribe a `/store/tez`
- Cada request identifica `organization_id` por slug
- RLS filtra datos automáticamente con `get_my_org_id()`

**Rutas públicas (no requieren auth):**
- `/store/[slug]/*` - Storefront
- `/chat/[slug]` - Chat de ventas
- `/api/webhooks/*` - Webhooks de pagos

**Rutas protegidas:**
- `/dashboard/*` - Requiere auth + pertenencia a org
- `/admin/*` - Requiere superadmin

## 💳 Pagos

**Pasarelas soportadas:**
- **Wompi:** Colombia (tarjetas, PSE, Nequi)
- **ePayco:** Colombia (alternativa)

**Flujo de webhook:**
1. Cliente paga → Gateway procesa
2. Gateway envía webhook → `/api/webhooks/payments/[provider]`
3. Validar firma → Actualizar orden → Notificar

**Credenciales:**
- Encriptadas en `payment_gateway_configs`
- Usar `encrypt()/decrypt()` de `src/lib/utils/encryption.ts`

## 🤖 AI Chat

**Herramientas disponibles (17 tools):**
- `identify_customer` - Registrar cliente
- `search_products` - Buscar productos
- `show_product` - Mostrar detalles
- `get_product_availability` - Verificar stock
- `add_to_cart` / `get_cart` / `remove_from_cart` / `update_cart_quantity` - Carrito
- `start_checkout` - Iniciar pago
- `get_shipping_options` - Opciones de envío
- `apply_discount` - Aplicar cupón
- `get_store_info` - Info de la tienda
- `get_order_status` - Estado de órdenes
- `get_customer_history` - Historial del cliente
- `confirm_shipping_details` - Confirmar datos de envío
- `escalate_to_human` - Transferir a humano

**Archivos clave:**
- `src/lib/ai/tools.ts` - Definición de herramientas
- `src/lib/ai/tool-executor.ts` - Implementación
- `src/lib/ai/context.ts` - Construcción de prompts
- `src/lib/ai/chat-agent.ts` - Orquestador principal

**Modelo usado:** `claude-sonnet-4-20250514`

## 📊 Analytics (PostHog + Meta Pixel)

**Reglas operativas:**
- PostHog inicializa con `capture_pageview: false` y emitimos `$pageview` manualmente vía `usePosthogTracking`
- Meta Pixel se inicializa **una sola vez** vía `<MetaPixel>`; NUNCA duplicar `init` ni `PageView` en useEffect del componente
- **Cliente Meta CAPI desactivado**: no llamar a `sendMetaCapiFunnelEvent` desde el navegador. Si se necesita CAPI, hacerlo server-side en server actions/api routes
- En layouts anidados (ej. `/order`) NO montar `<MetaPixel>` ni `<TrackingProvider>` si el layout padre ya los monta

## 📱 WhatsApp Integration

**Evolution API (legado, mantener):**
- Cliente: `src/lib/evolution/client.ts`
- Tipos: `src/lib/evolution/types.ts`
- Webhooks: `src/app/api/webhooks/whatsapp/route.ts`

**Funcionalidades:**
- Instancias personales y corporativas
- QR para conexión
- Mensajes unificados (web + WhatsApp)
- Límites por plan de suscripción

> Migración a WhatsApp Cloud API es un frente abierto. Ver `docs-private/TORRE_DE_CONTROL_EJECUCION.md`.

## ⚠️ Errores Comunes a Evitar

- **No romper el proxy** - Es crítico para routing
- **No hardcodear URLs** - Usar `getStoreLink()`, `getChatUrl()`
- **No olvidar RLS** - Cada tabla nueva necesita políticas
- **No loguear datos sensibles** - Passwords, tokens, tarjetas
- **No modificar `schema.sql`** - Usar migraciones incrementales en `migrations/`
- **No usar `any`** - Siempre tipar correctamente
- **No dejar contexto importante solo en el chat** - persistir decisiones en `AGENTS.md` o `docs-private/` según corresponda
- **No reintroducir Meta CAPI cliente** ni doble init de Meta Pixel - hay tests de regresión

## 📚 Documentación Adicional

- `.kiro/steering/product.md` - Visión del producto (steering Kiro)
- `.kiro/steering/structure.md` - Estructura detallada
- `.kiro/specs/` - Especificaciones vivas
- `CONTRIBUTING.md` - Guía de contribución
- `SECURITY_AUDIT_REPORT.md` - Auditoría de seguridad

**Documentos autoridad (docs-private/):**
- `MANDATO_PRODUCTO_Y_ARQUITECTURA.md` - Mandato oficial
- `VISION_2026_CAMINO_ELEGIDO.md` - Rumbo y principios
- `PLAN_MAESTRO_REFACTOR_MULTI_VERTICAL.md` - Plan de fases
- `TORRE_DE_CONTROL_EJECUCION.md` - Estado vivo de ejecución
- `PUNCHLIST_HARDENING_PLATAFORMA_2026-04.md` - Bugs y hardening
- `DOMAIN_MAP_VERTICALS.md` - Mapa de dominios

## 🆘 Troubleshooting

**"Error de hidratación"**
→ Verificar que componentes con estado usen `'use client'`

**"RLS policy violation"**
→ Verificar que el usuario está autenticado y pertenece a la org

**"Webhook no procesa"**
→ Verificar firma, revisar logs en `webhook_logs`

**"Chat no responde"**
→ Verificar `ANTHROPIC_API_KEY`, revisar modelo en `chat-agent.ts`

**"Tests fallan"**
→ Verificar que Vitest esté configurado correctamente, usar `npm run test:coverage`

**"PostHog no muestra eventos"**
→ Verificar que `NEXT_PUBLIC_POSTHOG_KEY` esté configurada y que el proxy en `/ingest/*` esté activo

---

**Última actualización:** 2026-05  
**Mantenedor:** @tause
