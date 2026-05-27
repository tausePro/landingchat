---
description: Refinar una idea o slice nuevo en design doc antes de codear (Socratic, threshold de complejidad)
---

# Brainstorm Slice (Socratic Design)

Adaptado de `obra/superpowers/skills/brainstorming`. Convierte una idea cruda en un design doc validado antes de escribir código. Aplica para slices NO triviales en LandingChat.

## Cuándo aplicar (threshold)

| Tamaño del slice | ¿Brainstorm? |
|---|---|
| Hotfix de 1 línea, typo, fix de copy | ❌ No, ir directo |
| UI polish menor (cambio de espaciado, color) | ❌ No, ir directo |
| Migración SQL idempotente conocida | ❌ No, leer doc autoridad y aplicar |
| Slice de 1-3 archivos con scope claro y patrón existente | ⚠️ Opcional. 1-2 preguntas de aclaración bastan |
| Slice de 4+ archivos, nueva feature, nuevo dominio | ✅ Sí, design doc obligatorio |
| Cualquier slice que toque pagos, webhooks, RLS, multi-tenancy core | ✅ Sí, design doc obligatorio |
| Refactor cross-vertical o cambio de arquitectura | ✅ Sí, design doc obligatorio + decomposición |

## HARD GATE

> No invocar implementación, escribir código, ni proponer commits hasta que el usuario apruebe el design doc explícitamente.

Esto aplica a CUALQUIER slice que cruce el threshold, sin importar si "parece simple".

## El proceso

### 1. Entender el contexto actual

Antes de hacer cualquier pregunta, leer:

- Doc autoridad en `docs-private/` (`MANDATO_PRODUCTO_Y_ARQUITECTURA.md`, `VISION_2026_CAMINO_ELEGIDO.md`, `PLAN_MAESTRO_REFACTOR_MULTI_VERTICAL.md`).
- `docs-private/TORRE_DE_CONTROL_EJECUCION.md` — estado vivo de slices recientes.
- `AGENTS.md` — reglas estables.
- Si el slice toca un dominio específico (search, payments, chat, webhooks), leer también el template relevante de `docs-private/REFERENCIAS_ARQUITECTONICAS.md`.

### 2. Evaluar scope

**Si la solicitud describe múltiples subsistemas independientes** (ej. "rediseña /productos + agrega filtros + cambia chat + nuevo dashboard"), **no refinar todavía**. Decir al usuario:

> Esto cubre N subsistemas independientes. Necesito decomponer antes de refinar el primero. Te propongo este orden: 1. X (driver Y), 2. Z (depende de X), ... ¿Empezamos por el #1?

Cada sub-slice se brainstormea por separado.

### 3. Refinar con preguntas socráticas

- **Una pregunta a la vez.** Esperar respuesta antes de la siguiente.
- **Multiple choice cuando se pueda** — más fácil de responder que open-ended.
- Foco en: propósito, restricciones, criterios de éxito.
- Si una pregunta requiere visual (mockup, layout), avisar primero al usuario que se abre el browser preview.

### 4. Explorar 2-3 enfoques

Antes de cerrar el design, presentar 2-3 alternativas con tradeoffs. Liderar con la recomendación y razonar.

Ejemplo (slice search v1.14.6 real):

> Opción A: Migrar a Algolia (~5-7 días, mejor UX out-of-box, costo $50/mes/tenant, vendor lock-in).
> Opción B: Extender Postgres FTS actual con highlight + skeleton + keyboard nav (~4-6h, sin costo extra, controlado).
> Opción C: Híbrido (Algolia para tenants premium, FTS para resto).
>
> **Recomiendo B** — el dolor de Tez es UX del header dropdown, no relevancia. FTS de v1.14.5 ya es suficiente.

### 5. Presentar el design por secciones

Una sección a la vez. Cada una escala a su complejidad (1-2 párrafos si simple, 200-300 palabras si rico). Pedir confirmación al cierre de cada sección. Cubrir como mínimo:

- **Driver**: qué dolor resuelve, qué tenant lo pidió
- **Arquitectura**: qué archivos toca, qué tipo de cambios (UI, RPC, migración, etc.)
- **Componentes y dependencias**
- **Flujo de datos**
- **Manejo de errores y degradación elegante**
- **Plan de tests**: focales del slice
- **Pendientes operativos**: migraciones a aplicar, smoke prod, torre de control
- **Out of scope**: qué decisiones explícitas se posponen

### 6. Diseño para aislamiento y claridad

Cada unidad nueva debe poder responderse:

- ¿Qué hace?
- ¿Cómo se usa?
- ¿De qué depende?

Si un archivo crece demasiado, está haciendo demasiado. Para LandingChat:

- **Server actions** en `src/app/<route>/actions.ts` — un dominio
- **Helpers compartidos** en `src/lib/<dominio>/` — testables solos
- **Componentes** en `src/components/<dominio>/` — clientes mínimos
- **Tipos** en `src/types/` — nunca duplicar
- **Migraciones** en `migrations/` con naming `YYYYMMDD_descripcion.sql`

### 7. Trabajar en código existente

Antes de proponer cambios:

- Explorar la estructura actual con `code_search` o `grep_search`.
- Seguir patrones existentes (ej. cómo otros slices manejaron RLS, RPC, FTS).
- Si encuentras código problemático que afecta el slice (ej. archivo enorme, boundaries borrosas), incluir mejoras targeted como parte del design — pero NO refactor transversal fuera del scope.

## Después del design

### Documentación

Escribir el spec validado a `docs-private/specs/YYYY-MM-DD-slice-<topic>.md`. Naming convention LandingChat:

```
docs-private/specs/2026-05-27-search-ux-polish.md
```

Si el spec es público (no tiene info sensible de cliente o pricing), puede ir en `docs/specs/` en lugar de `docs-private/`.

### Self-review del spec

Antes de pedir review humano, leer con ojos frescos:

1. **Placeholder scan**: ¿algún "TBD", "TODO", sección incompleta o requisito vago? Corregir.
2. **Consistencia interna**: ¿secciones se contradicen entre sí? ¿La arquitectura coincide con las features?
3. **Scope check**: ¿está suficientemente focal para un solo plan de implementación?
4. **Ambigüedad**: ¿algún requisito puede interpretarse de 2 formas? Pickear una explícitamente.
5. **Aislamiento multi-tenant**: ¿el slice respeta RLS y `get_my_org_id()`? ¿Funciona en todos los tenants relevantes?

Corregir inline. Sin re-review, solo fix y siguiente.

### User Review Gate

Tras el self-review:

> Spec escrito y commiteado en `docs-private/specs/YYYY-MM-DD-<topic>.md`. Por favor revisa antes de que escriba el plan de implementación.

**Esperar respuesta explícita.** Si pide cambios, aplicarlos y re-correr el self-review.

### Implementación

Tras la aprobación, redactar el plan de implementación con tareas chicas (2-5 min cada una) y pedir luz verde para arrancar. NO implementar todavía.

## Principios clave

- **One question at a time** — no abrumar
- **Multiple choice preferred** — más fácil de responder
- **YAGNI ruthless** — quitar features innecesarias
- **Explore alternatives** — siempre 2-3 enfoques antes de cerrar
- **Incremental validation** — cada sección con OK del usuario
- **Be flexible** — volver atrás si algo no encaja

## Anti-patterns

- ❌ Empezar a codear "porque parece simple" sin design doc cuando el slice cruza el threshold
- ❌ Hacer múltiples preguntas en un solo mensaje
- ❌ Presentar el design completo de golpe sin secciones validadas
- ❌ Saltar el self-review antes del User Review Gate
- ❌ Documentar el spec solo en el chat sin escribir el archivo en `docs-private/specs/`

## Referencias

- Patrón origen: `obra/superpowers/skills/brainstorming`
- `AGENTS.md` § Reglas estables
- `docs-private/REFERENCIAS_ARQUITECTONICAS.md` (si existe — templates de awesome-architecture)
