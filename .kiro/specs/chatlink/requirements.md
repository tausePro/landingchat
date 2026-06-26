# ChatLink — Requirements (spec / dirección)

> **Estado**: En definición. MVP + plan de validación A/B. Saca `design.md` + `tasks.md` al aprobarse el build.
> **Origen**: conversación de roadmap 2026-06-25 (@tause + Devin), a partir de mockups (Google Stitch) + el análisis de tráfico en PostHog del mismo día.
> **Tesis**: el tráfico social (IG/TikTok) **navega y rebota** en el storefront; meterlo **directo al chat** (chat-first) sube conversión. ChatLink es la superficie de entrada chat-first para el link de la bio.
> **Doc relacionado**: `.kiro/specs/atlas-growth-operator/requirements.md` (F6 tráfico), `AGENTS.md`.

---

## 1. El problema (data real, PostHog 2026-06-25)

- **goldcaps**: 54% del tráfico es **Instagram**, pero solo **0.6% abre el chat** → **0.08% de conversión** (1 orden / 1.250 visitas). Navega 3.8 págs/sesión y se va.
- **quality-pets** (chat-driven): **6% de conversión** (17 órdenes / 284 visitas), **6.3% abre chat**.
- **Diagnóstico**: *donde el visitante entra al chat, convierte; el tráfico social no entra* (rebota en la grilla del storefront). El `proactive_nudge` rinde ~3% CTR.
- **78% del tráfico social es móvil** (goldcaps).
- **Hipótesis**: una entrada **chat-first** para el tráfico de bio convierte el tráfico social mejor que el storefront actual.

## 2. Qué es ChatLink (enfoque Visual-First)

Un **link-in-bio VISUAL + conversacional**: el visitante de IG/TikTok aterriza en una **landing de bio bonita** (greeting + **bento de productos** + video + social proof "as seen in") con el chat **tejido vía Smart Triggers** — chips ("Ayúdame a elegir rutina", "¿Hay stock en mi talla?") que **abren el chat con contexto**.

- **Por qué Visual-First (mejor que chat-first puro)**: el visitante ve algo lindo primero y entra al chat **por intención** (un trigger) → esquiva el aterrizaje en frío y hace **natural** el gate de nombre (ocurre post-intención, no antes).
- **Diferenciador vs Linktree / Beacons / Stan / Shopify Linkpop**: ellos **listan links** (visual pero tonto); ChatLink **cierra la venta conversando** (agente + carrito + checkout + WhatsApp).
- **Diferenciador vs Manychat / bots**: conversacional pero **sin la capa visual/catálogo**.
- **El moat**: nadie junta **visual + conversacional + comercio completo**. LandingChat ya tiene las 3.
- **Objetivo**: canalizar tráfico social hacia la plataforma y subir la conversión del tráfico que hoy rebota (goldcaps 0.08%).

## 3. Inventario: qué REUSA (no reconstruir)

| Capacidad | Estado | Dónde |
|---|---|---|
| Agente IA + chat con product-cards | ✅ | `src/lib/ai/`, `/chat/[slug]` |
| Catálogo + import de marca/fotos | ✅ | `src/lib/onboarding/store-importer.ts` |
| Links WhatsApp + número del tenant | ✅ | settings / `whatsapp_instances` |
| Atribución por fuente (`$pageview` + utm + `$referring_domain`; Meta) | ✅ | `src/hooks/use-tracking-params.ts`, analytics |
| "Productos en tendencia" (`view_content` ya capturado) | ✅ | `analytics_events` / events |
| Quick-reply chips (gancho al chat) | ✅ | `proactive-chat-bubble` / `home-proactive-nudge` (v1.49.1) |
| Entrega + visibilidad (`notification_logs`) | ✅ | (v1.49.5) |

→ ChatLink es **ensamblar lo existente** en una ruta de entrada nueva, **no infra nueva**.

## 4. MVP (delgado — lo mínimo para correr el A/B)

**Incluye**:
- Ruta pública **Visual-First** por tenant, mobile (resuelve org por slug vía proxy; respeta RLS).
- **Greeting** del agente + **bento de catálogo** (data e imágenes ya existen; el *layout* bento es lo nuevo).
- **Smart Triggers** = los **quick-reply chips existentes** (v1.49.1) → al tocarlos van a `?action=chat` con contexto → el **gate-modal existente** se dispara **post-intención** (natural) → el chat.
- **Atribución por fuente/variante** (utm → eventos; ver `design.md` §7).

**NO incluye en v1** (a v2 sólo si el A/B valida):
- El **builder visual** completo (la pantalla de configuración de los mockups).
- Bloques avanzados (video / social-proof se reusan de storefront si aplica), skills marketplace.
- Cambio de gate (B1 anónimo / B2 inline): **polish posterior** — con Visual-First el gate ya cae post-intención y el flujo existente sirve.
- Inbox / CRM / campañas (fase *operator suite*).

## 5. El A/B (la validación — el corazón del MVP)

- **Dónde**: **goldcaps** (el que más sufre: IG-heavy, 0.08% conv).
- **Test**: fracción del tráfico de bio → ChatLink vs storefront actual.
- **Métrica primaria**: conversión **visita → orden**. **Leading**: visita → `chat_opened`.
- **Cómo medir**: ya tenemos los eventos (`$pageview`, `view_content`, `chat_opened`, `add_to_cart`, `checkout_order_created`) + la fuente. Sólo falta **etiquetar la variante** en los eventos.
- **Criterio de decisión**:
  - Si ChatLink sube `chat_opened` **y** conversión vs storefront de forma clara → construir el builder completo (v2).
  - Si no → session recordings + iterar el layout/copy antes de invertir más.

## 6. Secuencia + dónde va el TEAM

1. **ChatLink MVP + A/B** (este spec) — **no necesita team**.
2. **Calidad del agente** (skills + escalado humano) — que convierta a los que ya entraron.
3. **Operator suite** (Inbox multi-agente, CRM 360, campañas WhatsApp) — **AQUÍ entra el TEAM**: el Inbox necesita multi-usuario + roles + asignación (ver análisis de equipo/roles, 2026-06-25). El team es el cimiento de esta fase, **no** de ChatLink. También habilita *seats por plan* (monetización).

→ **Team = después de ChatLink, emparejado con el Inbox** (es su prerequisito).

## 7. Guardrails

- **Multi-tenant**: la ruta resuelve org por slug (proxy), RLS. NO romper `src/proxy.ts`.
- **Reusar** agente/catálogo/tracking existentes — no duplicar superficies.
- **Medir desde el día 1**: sin la variante etiquetada en eventos no hay A/B.
- **Mobile-first**: el tráfico social es 78% móvil (dato real).
- Evitar **dos superficies que compitan/confundan**: ChatLink = entrada social chat-first; storefront = browse completo. Distinción clara.

## 8. Fuera de alcance (v1)

- Builder visual completo (config UI de los mockups).
- **Cambio de WhatsApp por horario: DESCARTADO** (no sólo v1). El agente IA responde 24/7 → no hay que ocultar WhatsApp por horario. ChatLink es una herramienta exclusiva de LandingChat con el agente siempre activo.
- Skills marketplace, reorder automático configurable (eval. en v2).
- Inbox / CRM / campañas (fase operator suite, depende del team).
- Personalización por visitante (prematuro para el tráfico SMB).
