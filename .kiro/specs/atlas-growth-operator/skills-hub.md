# Atlas Skills Hub — Diseño (refinamiento)

> **Estado:** refinamiento estratégico (parte de `atlas-growth-operator`, **no aprobado para construir**).
> **Origen:** conversación 2026-06-30 (@tause + Devin) — idea del "panel de skills en Atlas" + `higgsfield-ai/skills` como referencia de formato y motor.
> **Relacionado:** `personas.md` (Capa 1), `requirements.md` (frentes F1–F7), `src/lib/ai/skills.ts` (patrón de skills del storefront).
> **Tesis:** **Atlas = nuestro Hermes** — un agente con un **hub de skills instalables** que actúa **con aprobación del merchant**. La parte "aprobación" ya está en el spec (`modelo Hermes`); esto agrega la parte "hub de skills".

---

## 1. Modelo de 2 capas

- **Capa 1 — Personas (cómo piensa):** el lente/expertise (Growth, Paid Social, Creativo, AEO). Ver `personas.md`. Determinan el framing y qué acciones tienen sentido.
- **Capa 2 — Skills hub (qué empuña):** las capacidades concretas que Atlas puede ejecutar.

> Una persona sin skill es solo un prompt; un skill sin persona es una herramienta suelta. **Juntas = operador de crecimiento.**

Un **AtlasSkill** = `{ persona que lo usa } × { data que lee } × { acción que ejecuta }`.

---

## 2. El modelo `AtlasSkill` (extiende tu `SkillDefinition`)

Reusar la forma de `src/lib/ai/skills.ts` (`SkillDefinition`) + campos nuevos para el hub:

```ts
interface AtlasSkill {
  id: string
  name: string
  description: string
  persona: "growth" | "paid_social" | "creative" | "aeo"   // Capa 1
  reads: string[]                       // data que necesita (métricas, ads, chats, catálogo)
  proposes: CopilotActionKind[]         // acción whitelisted (requires_approval)
  engine: "internal" | "higgsfield" | "recraft"            // quién ejecuta
  tier: "free" | "pro" | "premium"      // palanca de monetización
  status: "active" | "coming_soon"      // gate de readiness (no shipear switches muertos)
  defaultInstructions: string           // el LENS (prompt), como en skills.ts
}
```

**Diferencia clave con los skills del storefront:** viven a nivel **org** (no en `agents.configuration.skills`), porque Atlas no tiene fila en `agents`. Storage: `organizations.atlas_skills` (JSONB) o tabla `atlas_skills`.

---

## 3. El panel (la UI pedida)

- **Superficie:** nueva sección en `/dashboard/copilot` (o `/dashboard/atlas`).
- **Reusa** el patrón visual del panel de skills del storefront (`agent-config.tsx`: card por skill + `Switch` + descripción + `Badge`). No inventar UI.
- **Cada skill:** `Switch` activar/desactivar (solo si `status=active` y el `tier` alcanza el plan) · badge de estado (**Activa** / **Próximamente** / **candado por plan**) · botón "**usar ahora**" (on-demand) cuando aplique.
- **Doble función:** *control* (el merchant decide qué usa Atlas) + *vitrina/upsell* (ve lo que viene y lo que desbloquea el plan Pro).
- **v1 = registro curado por nosotros.** NO marketplace abierto donde el merchant instale 3rd-party arbitrario (seguridad + multi-tenant). El "browse & install from hub" es **norte, no v1**.

---

## 4. Higgsfield como motor del skill "Creativo"

`higgsfield-ai/skills` (MIT) trae:
- `product-photoshoot` — 10 modos (studio, lifestyle, **ad_creative_pack** Meta/TikTok, hero banner, virtual try-on, Pinterest…).
- `marketplace-cards` — imagen principal compliant + secundarias + A+ → **listings de MercadoLibre/Amazon**.
- `generate` + **Marketing Studio** (UGC / unboxing / TV spot / try-on video) + **Virality Predictor**.
- `soul-id` — identidad/rostro reutilizable.

Son skills **Markdown abiertos** (misma familia que `.agents/skills/`). **Pero el modelo de auth es de UN usuario** (`hf auth login` + `npx skills add`). Para Atlas multi-tenant:

- ❌ **No:** instalar el paquete `npx`/CLI por tenant en el backend.
- ✅ **Sí:** envolver la **API de Higgsfield** server-side con la **cuenta de plataforma** + **contabilidad de créditos por merchant** + aprobación (Hermes). **El skill "Creativo" del hub = nuestro wrapper**, no el paquete crudo.
- Decisión de negocio: créditos (pass-through o incluidos por tier).

---

## 5. Dos significados de "skill" (no confundir)

| | **dev-skills** | **product-skills (hub Atlas)** |
|---|---|---|
| Para quién | tú / equipo / agentes de código | el merchant |
| Formato | Markdown (`npx skills add`, `.agents/skills/`) | `AtlasSkill` (wrapper server-side) |
| Ejecuta | tu agente de código (Claude/Cursor/Devin) | backend de LandingChat |
| Ejemplo | `higgsfield-ai/skills` en Claude Code | skill "Creativo" que llama la API de Higgsfield |

---

## 6. Secuencia (YAGNI — el molde antes que el framework)

1. **Validar calidad (cero build):** el equipo instala `higgsfield-ai/skills` en Claude Code → genera assets de un producto real de QP → ¿calidad suficiente para SMB LATAM? *Decide si vale el wrapper.*
2. **Modelo + registro:** definir `AtlasSkill` + registrar las 4 personas (1 `active`, 3 `coming_soon`).
3. **Pilotar skill activo:** **Crecimiento** (interno, sin nueva integración) como sección `LENS` en `weeklyInsightPrompt.ts`.
4. **Panel mínimo:** 1 activa + 3 próximamente (vitrina + upsell).
5. **Skill Creativo (build grande):** wrapper server-side de la API de Higgsfield + billing + aprobación. Va con/después de **F3**.

---

## 7. Guardrails (heredados de `requirements.md` §5)

- Aprobación del merchant en todo lo que sale a clientes/público (patrón "1/2/3").
- Registro **curado**, no marketplace abierto en v1.
- Créditos/costo controlados por `tier`.
- **Nunca** auth de terceros por-tenant en el backend (wrap server-side con cuenta de plataforma).

## Changelog
- **2026-06-30** — Diseño del hub de skills (Capa 2) + modelo `AtlasSkill` + panel + Higgsfield como motor del skill Creativo + caveat de auth multi-tenant. Sin código (spec en refinamiento).
