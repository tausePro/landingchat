# ChatLink — Design (MVP + decisión de entrada)

> **Estado**: Diseño. Acompaña a `requirements.md`. Investigación de la superficie existente hecha 2026-06-25 (autónoma, mientras @tause caminaba).
> **Resumen**: la pieza clave **NO es el chat** (ya existe completo en `/chat/[slug]`), es **cómo entra el visitante de bio al chat sin la fricción del "gate"** sin perder la captura de lead. Aquí está el hallazgo + las opciones + un plan por etapas.

---

## 1. Hallazgos (superficie existente, file:line)

- **El chat ya existe y es completo**: `src/app/chat/[slug]/page.tsx` — product-cards inline, carrito, pay-bar, agente IA, tracking `chat_opened`. Es chat-first por diseño.
- **PERO requiere sesión de cliente**: el init (`initializeChat` / `fetchHistory`, ~líneas 260-347) hace `redirectToChatGate()` ante 401/403 (sin `customerId`). **Un visitante FRESCO no puede chatear directo** — lo manda al gate.
- **El gate es un MODAL en el storefront**: `?action=chat` en `src/app/store/[slug]/store-layout-client.tsx:233-263` → si hay `customerId` (localStorage) → redirige a `/chat`; si no → `setShowGateModal(true)` (captura nombre → `handleCustomerIdentified` → identifica en PostHog → chat).
- **El tracking ya captura `utm_*` + fuente**: `src/hooks/use-tracking-params.ts`. → la variante del A/B se puede **etiquetar con utm SIN código nuevo**.
- **El funnel ya está instrumentado**: `$pageview`, `view_content`, `chat_opened`, `add_to_cart`, `checkout_order_created`.

→ El chat existe; lo que falta es **la entrada chat-first** (sin el gate-modal) + etiquetar la variante.

## 2. La decisión clave: ¿cómo entra al chat sin perder el lead?

| Opción | UX | Costo | Riesgo |
|---|---|---|---|
| **A. `?action=chat` + utm** (reusa el gate-modal) | Aterriza en storefront + modal de nombre → chat | **~0 código** | Bajo. NO es full chat-first (storefront detrás + modal) |
| **B. Superficie chat-first real** (aterriza EN el chat; nombre anónimo o inline) | Full chat-first (como el mockup) | Medio-alto | **Toca el modelo customer/sesión + RLS + la captura de lead** |

## 3. Plan por etapas (recomendado)

### MVP-0 — validar la hipótesis YA (casi sin código)
- Bio link → `{slug}.landingchat.co/?action=chat&utm_source=instagram&utm_medium=chatlink`.
- Control → storefront normal (`utm_medium=storefront`).
- **A/B en goldcaps** (IG-heavy, 0.08% conv). Mide con utm + el funnel existente.
- **Si `chat_opened` + conversión suben → invertir en MVP-1.** Si no, el problema es otro (ahorro de semanas de build).
- Único código (opcional, pequeño y seguro): botón **"Copia tu ChatLink"** en el dashboard que arma esa URL.

### MVP-1 — la superficie chat-first real (sólo si MVP-0 valida)
Requiere **decidir el gate** (la decisión de §2/B):
- **B1 — chat anónimo**: auto-crear customer sin nombre → capturar el nombre IN-CHAT tras N mensajes. Cero fricción, pero **toca RLS** (customers anónimos) y cambia *cuándo* se captura el lead.
- **B2 — nombre inline**: un input dentro del propio chat (no un modal aparte) → conserva la captura de lead pero sin sacar al visitante del chat.
- **Voto**: **B2** (conserva el lead, baja la fricción). B1 sólo si aceptamos leads anónimos a cambio de cero fricción.

## 4. A/B (mecánica)
- **Variante**: `utm_medium = chatlink` vs `storefront`.
- **Métrica primaria**: visita → `checkout_order_created`. **Leading**: visita → `chat_opened`.
- **Segmento**: goldcaps.
- **Criterio**: chatlink sube `chat_opened` **y** conversión de forma clara → construir MVP-1 (y luego el builder visual = v2).

## 5. Lo que NO toqué (a propósito)
El **modelo customer/sesión + RLS + el gate**. Es la decisión de §2/B — la dejo para **alinear con @tause** porque afecta (a) la **captura de lead** (el valor #1 del merchant) y (b) **RLS multi-tenant** (customers anónimos). No la reescribí en solitario; primero el approach.

## 6. Tasks (al aprobar)
- [ ] **MVP-0**: (opcional) botón "Copia tu ChatLink" en dashboard + confirmar que utm fluye a los eventos. Correr el A/B en goldcaps.
- [ ] **Decisión gate**: B1 (anónimo) vs B2 (nombre inline).
- [ ] **MVP-1**: superficie chat-first + entrada sin gate-modal (según la decisión) + etiquetado de variante.
- [ ] Medir → decidir el builder visual completo (v2).

## 7. Tracking + acortador de URL

**¿Hace falta un acortador para ChatLink? NO uno separado.** La propia ruta de ChatLink ya es la URL corta, branded y trackeable:
- `landingchat.co/c/{slug}` (o `{slug}.landingchat.co`) → la landing Visual-First.
- El **`$pageview` ES el "click en bio"** (métrica first-party, sin Bitly).
- La fuente se pasa por utm (`?s=ig` / `?s=tiktok` o utm completos) → `use-tracking-params` lo adjunta a los eventos.

**Cadena de rastreo (qué tenemos / qué falta):**
| Paso | Cómo | Estado |
|---|---|---|
| Click en bio | `$pageview` de la ruta ChatLink | ✅ (con la ruta nueva) |
| Fuente (IG/TikTok) | utm en la URL → eventos | ✅ `use-tracking-params` |
| Chat abierto | `chat_opened` (smart-trigger) | ✅ |
| Funnel | `view_content` → `add_to_cart` → `checkout_order_created` | ✅ |
| Venta → fuente | `orders.utm_data` (utm persistido en la orden) | ✅ (verificar) |
| Ads (pago) | Meta CAPI server-side | ✅ `meta-conversions-api` |

→ Para el A/B + el rastreo de ChatLink **no necesitamos nada externo**: se arma con lo que hay + la ruta nueva.

**Acortador GENÉRICO (opcional, feature aparte)**: para acortar/trackear *otros* links de la bio (no solo ChatLink) o un dominio corto tipo `lc.link`, lo construimos in-house (mejor que Bitly: first-party):
- Tabla `short_links` (code, target_url, org_id, clicks) + ruta `/l/{code}` (registra click + redirige con utm) + reusa el proxy. ~1 slice pequeño.
- **No es prerequisito de ChatLink** — es un add-on para los "smart links" de la bio.

## 8. Actualización: enfoque Visual-First (2026-06-25)

El mockup refinado movió a **Visual-First** (landing visual + chat vía Smart Triggers). Esto **reduce el problema del gate** de §2: el gate-modal existente se dispara **al tocar un trigger** (post-intención), donde pedir el nombre es natural → el MVP **reusa el flujo `?action=chat` existente**, sin tocar el modelo customer/sesión/RLS. La decisión B1/B2 pasa a **polish posterior**, no bloquea. El MVP es ahora **mayormente UI** (la landing bento) + reuso (chips, chat, gate).
