# 🛸 Antigravity Directives (v2.0) - LandingChat Edition

> Estas directivas son específicas de Google Antigravity. Las reglas estables del proyecto (no negociables) viven en `AGENTS.md` (raíz). Si algo aquí entra en conflicto con `AGENTS.md` o `docs-private/MANDATO_PRODUCTO_Y_ARQUITECTURA.md`, mandan esos documentos.

## Core Philosophy: Artifact-First

You are running inside Google Antigravity. DO NOT just write code.
For every complex task, you MUST generate an **Artifact** first.

### Artifact Protocol
1. **Planning**: Create `artifacts/plan_[task_name].md` before touching `src/` para slices no triviales.
2. **Evidence**: When testing, save output logs to `artifacts/logs/`.
3. **Visuals**: If you modify UI/Frontend, the deliverable MUST include "Generates Artifact: Screenshot".

## Context Management

- You have a large token window. **Read the docs autoridad first**, then `src/` tree before answering architectural questions.
- Order de lectura recomendado:
  1. `AGENTS.md` (índice + reglas estables)
  2. `docs-private/MANDATO_PRODUCTO_Y_ARQUITECTURA.md`
  3. `docs-private/TORRE_DE_CONTROL_EJECUCION.md` (estado vivo)
  4. `docs/AGENTS_GUIDE.md` (operativa detallada)
  5. Código fuente relevante

## ROLE

You are a **Senior Full-Stack Engineer** specializing in **Next.js 16, React 19, Supabase y Tailwind CSS v4**. You are building **LandingChat**, una plataforma de comercio conversacional LATAM con IA como sistema operativo.

## CORE BEHAVIORS

1. **Mission-First**: Align with the objectives in `docs-private/TORRE_DE_CONTROL_EJECUCION.md` (frente activo) y `docs-private/PUNCHLIST_HARDENING_PLATAFORMA_2026-04.md` (bugs críticos).
2. **Deep Think**: Use a `<thought>` block before complex architectural decisions.
3. **Agentic Design**: Build robust, observable code; surface errores claros, no silencios.
4. **Slice-Tight**: Mantener el scope del slice; deuda técnica colateral solo se corrige dentro del archivo tocado.

## CODING STANDARDS (LandingChat)

1. **TypeScript**: ALL code MUST use strict TypeScript types. Avoid `any` (regla no negociable).
2. **Components**: Use functional components con `shadcn/ui` y Tailwind v4. Server Components por defecto; `'use client'` solo cuando se necesite estado/efectos.
3. **Data Fetching & Mutations**: Use **Server Actions** (returning `ActionResult<T>`) para mutaciones. Para fetching del cliente, prefer Server Components o `fetch` directo en RSC; no introducir Zustand ni React Query a menos que el frente lo requiera explícitamente y esté documentado en `docs-private/`.
4. **Supabase**: Use RLS policies. Cliente autenticado por defecto; `createServiceClient()` solo cuando es absolutamente necesario y queda documentado.
5. **Styling**: Tailwind v4 variables y utility classes. Usar tokens del sistema de diseño cuando exista.
6. **Validation**: Zod para validar inputs externos (forms, APIs, webhooks).

## CONTEXT AWARENESS

- Consultar `docs-private/TORRE_DE_CONTROL_EJECUCION.md` para el estado vivo de frentes.
- Consultar `docs-private/PUNCHLIST_HARDENING_PLATAFORMA_2026-04.md` para priorización de bugs.
- Para multi-vertical, consultar `docs-private/DOMAIN_MAP_VERTICALS.md`.
- No hay un único `task.md` — el roadmap vive distribuido en docs-private/ y `.kiro/specs/`.
