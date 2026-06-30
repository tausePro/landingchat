# AGENTS.md — LandingChat

> Plataforma de comercio conversacional LATAM. Stack: Next.js 16, React 19, TS, Tailwind v4, Supabase, Claude. Multi-tenant por subdominio. Comentarios en español, código en inglés.
>
> Este archivo es **el índice** y las **reglas estables**. Para la guía operativa detallada (estructura, patrones, troubleshooting, AI tools, pagos, etc.) lee `docs/AGENTS_GUIDE.md`.

## 📚 Documentación autoridad (orden de prioridad)

1. **Mandato y arquitectura** → `docs-private/MANDATO_PRODUCTO_Y_ARQUITECTURA.md`
2. **Visión y principios** → `docs-private/VISION_2026_CAMINO_ELEGIDO.md`
3. **Plan maestro** → `docs-private/PLAN_MAESTRO_REFACTOR_MULTI_VERTICAL.md`
4. **Torre de control** (estado vivo) → `docs-private/TORRE_DE_CONTROL_EJECUCION.md`
5. **Punchlist hardening** → `docs-private/PUNCHLIST_HARDENING_PLATAFORMA_2026-04.md`
6. **Mapa de dominios** → `docs-private/DOMAIN_MAP_VERTICALS.md`
7. **Guía operativa detallada** → `docs/AGENTS_GUIDE.md`
8. **Steering Kiro** → `.kiro/steering/`
9. **Specs vivos** → `.kiro/specs/` (los `_done/` y `_archive/` son consulta histórica)
10. **Referencias arquitectónicas externas** (lectura previa para slices nuevos) → `docs-private/REFERENCIAS_ARQUITECTONICAS.md`

> Si una regla en este archivo entra en conflicto con #1-#6, manda la doc autoridad.

## 🚀 Setup mínimo

```bash
npm install
cp .env.example .env.local
# Setear: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
#         SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
npm run dev          # http://localhost:3000
npm run test         # Vitest
npm run test:coverage
```

Variables completas y comandos detallados en `docs/AGENTS_GUIDE.md`.

## 🚦 Reglas estables NO NEGOCIABLES

### Seguridad
- ❌ NUNCA `USING (true)` en RLS de tablas sensibles (`customers`, `orders`, `payment_gateway_configs`, `webhook_logs`)
- ❌ NUNCA loguear API keys, tokens, passwords ni datos de tarjetas
- ✅ Webhooks: validar firma SIEMPRE antes de procesar
- ✅ Datos sensibles encriptados con `encrypt()/decrypt()` de `src/lib/utils/encryption.ts`
- ✅ `createServiceClient()` solo cuando es absolutamente necesario y queda documentado

### TypeScript
- ❌ NO usar `any`. Si encuentras `any` en el archivo que tocas, corrige dentro del slice
- ❌ NO refactor transversal solo por perseguir deuda técnica fuera del scope
- ✅ Usar Zod para validar inputs externos (forms, APIs, webhooks)
- ✅ Server Actions devuelven `ActionResult<T>` (success/error pattern)
- ✅ YAGNI: el mínimo que funcione bien. Antes de una abstracción o dependencia nueva, preferir stdlib / feature nativa / lo ya instalado. NUNCA recortar validación, seguridad, manejo de pérdida de datos ni tests

### React / Next.js
- ✅ Server Components por defecto; `'use client'` solo cuando se necesite estado/efectos del cliente
- ✅ `next/image` SIEMPRE — nunca `<img>`
- ✅ Componentes funcionales con hooks; Tailwind v4 + `shadcn/ui` para UI

### Multi-tenancy
- ✅ Cada request identifica `organization_id` por slug; RLS filtra con `get_my_org_id()`
- ❌ NO romper `src/proxy.ts` (routing crítico de subdominios)
- ❌ NO hardcodear URLs — usar `getStoreLink()`, `getChatUrl()`

### Analytics (post hardening 2026-05)
- ❌ Cliente Meta CAPI desactivado — NO reintroducir `sendMetaCapiFunnelEvent` desde el navegador. Si se necesita CAPI, hacerlo server-side
- ❌ Meta Pixel `init` y `PageView` solo una vez vía `<MetaPixel>`. NO duplicar en `useEffect`
- ❌ NO montar `<MetaPixel>` ni `<TrackingProvider>` en layouts anidados si el padre ya los monta
- ✅ PostHog: `capture_pageview: false`, emitimos `$pageview` manualmente vía `usePosthogTracking`

### Supabase / PostgREST
- ⚠️ PostgREST capa TODA respuesta en **1000 filas** sin importar `.limit(5000)` o `.range(0, 4999)` — el exceso se descarta EN SILENCIO. Toda query de agregación que pueda superar 1000 filas DEBE paginar con `fetchAllPages` (`src/lib/supabase/fetch-all.ts`). Los `count: "exact", head: true` son inmunes (se calculan server-side)
- ✅ En queries de inspección SIEMPRE verificar `error` — un JOIN embebido que falla retorna `data: null` silencioso (causó un diagnóstico falso de "tabla vacía")
- ⚠️ Antes de un DELETE en migraciones: mapear TODAS las tablas que referencian la entidad (`grep "REFERENCES <tabla>" migrations/`) y verificar cada una contra los registros a borrar — verificar "las 2 obvias" no basta (caso real: carts bloqueó un DELETE de customers tras verificar solo orders/chats)
- ✅ El schema histórico tiene FKs fantasma (tablas multi-tenant sin FK a organizations → joins embebidos rotos + huérfanas). Barrido 2026-06-12 reparó: whatsapp_instances, subscriptions, customers, coupons, payment_gateway_configs, shipping_settings. Si un JOIN embebido falla con "Could not find a relationship", revisar si falta la FK

### Migraciones DB
- ✅ `migrations/` con naming `YYYYMMDD_descripcion.sql`
- ✅ Usar `IF NOT EXISTS` y `DROP POLICY IF EXISTS` siempre
- ❌ NUNCA modificar `schema.sql` directamente — usar migraciones incrementales
- ✅ Auditoría RLS periódica con `scripts/db-audit-rls.sql`

### Contexto y memoria
- ✅ Decisiones importantes → `docs-private/` o este `AGENTS.md`
- ❌ NO dejar invariantes operativos solo en el chat
- ✅ Antes de asumir arquitectura o fuentes de datos, leer doc autoridad y luego código

### Zona horaria (LATAM / Colombia) — NO asumir UTC para el usuario
- ✅ La plataforma es **Colombia-first**: zona horaria de referencia **America/Bogota** (UTC-5), locale `es-CO`. Fechas mostradas al usuario → formatear en `America/Bogota` (`toLocaleString("es-CO", { timeZone: "America/Bogota" })` o `formatBogotaDate`).
- ⚠️ El server corre en **UTC**. Un `<input type="datetime-local">` da hora **local del browser** → convertir a ISO/UTC **en el cliente** (`new Date(value).toISOString()`) ANTES de mandar al server. NUNCA `new Date(localString)` en el server: lo toma como UTC y desfasa 5h.

## 📝 Commits

- `feat:` nueva funcionalidad
- `fix:` corrección de bug
- `refactor:` cambios sin alterar funcionalidad
- `docs:` documentación
- `test:` agregar o modificar tests
- `security:` mejoras de seguridad

## 🚀 Workflow de releases (no negociable)

- ✅ Toda feature/fix en **rama propia** (`feat/…`, `fix/…`, `chore/…`) → `develop` → `main`. NUNCA commitear features directo en `develop`
- ✅ Antes de mergear a `main`: `tsc` + `vitest` + `build` **Y smoke local del flujo real** — "compila y renderiza" NO es suficiente. Para UI: levantar dev y recorrer el camino a mano (o Puppeteer) antes del release
- ✅ Release por slice: `chore(release): vX.Y.Z` + tag; verificar `develop == main` (0 0)

## 🤖 Otros archivos para agentes

- `CLAUDE.md` → alias a este archivo (estándar agents.md)
- `.antigravity/rules.md` → directivas Antigravity (alineadas con este archivo)
- `.devin/rules/` → reglas específicas Devin/Windsurf/Cascade (antes `.windsurf/`)
- `.devin/workflows/` → workflows operativos automatizables
- `.cursorrules` → redirige aquí
- `.agents/skills/` → skills AI instaladas vía `npx autoskills`

---

**Última actualización:** 2026-05  
**Mantenedor:** @tause