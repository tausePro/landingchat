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

### Migraciones DB
- ✅ `migrations/` con naming `YYYYMMDD_descripcion.sql`
- ✅ Usar `IF NOT EXISTS` y `DROP POLICY IF EXISTS` siempre
- ❌ NUNCA modificar `schema.sql` directamente — usar migraciones incrementales
- ✅ Auditoría RLS periódica con `scripts/db-audit-rls.sql`

### Contexto y memoria
- ✅ Decisiones importantes → `docs-private/` o este `AGENTS.md`
- ❌ NO dejar invariantes operativos solo en el chat
- ✅ Antes de asumir arquitectura o fuentes de datos, leer doc autoridad y luego código

## 📝 Commits

- `feat:` nueva funcionalidad
- `fix:` corrección de bug
- `refactor:` cambios sin alterar funcionalidad
- `docs:` documentación
- `test:` agregar o modificar tests
- `security:` mejoras de seguridad

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