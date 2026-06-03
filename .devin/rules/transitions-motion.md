---
trigger: glob
globs:
  - src/components/store/**
  - src/components/storefront/**
  - src/components/chat/**
  - src/components/ui/**
  - src/app/store/**
  - src/app/chat/**
  - src/app/(marketing)/**
description: Catálogo canónico de 12 transiciones UI portadas de transitions.dev. Anti-keyframes ad-hoc, anti-easing default, pro `prefers-reduced-motion`. Complementa `storefront-ui-taste.md`.
---

# Transitions Motion — Catálogo Canónico

Adaptado de [transitions.dev](https://transitions.dev/) (Jakub Antalik, MIT). Aplica al construir o tocar componentes con micro-interacciones en storefront, chat público o landing marketing. Es complemento técnico de `storefront-ui-taste.md` (que define la disciplina general); este archivo es el **catálogo concreto de transiciones** que estamos autorizados a copiar.

## Por qué existe esto

- Los keyframes ad-hoc y `transition: all 300ms` por todos lados es slop visual y suele estar mal calibrado.
- Las 12 transiciones de transitions.dev están **tuneadas, accesibles y portables** (cada una incluye `@media (prefers-reduced-motion: reduce)`).
- Tener un catálogo cerrado reduce decisiones y unifica el lenguaje motion entre componentes.
- NO obliga a refactorear todo el storefront. Aplica cuando agregas o tocas una micro-interacción.

## Scope

- ✅ Aplica al **código nuevo** que necesita una micro-interacción dentro del glob.
- ✅ Aplica al **refactor sustantivo** de un componente animado (dropdown, modal, panel, badge, etc.).
- ❌ NO refactorear UI existente solo por adoptar el catálogo. Si la transición vieja funciona y es accesible, déjala.
- ❌ NO aplica al dashboard interno del merchant (su motion es funcional, sobrio, no editorial).

## El catálogo (12 transiciones)

| # | Nombre | Cuándo usar | Fuente |
|---|--------|-------------|--------|
| 1 | **Card resize** | Tween de width/height cuando el layout interno cambia. | [`01-card-resize.md`](https://github.com/Jakubantalik/transitions.dev/blob/main/skills/transitions-dev/01-card-resize.md) |
| 2 | **Number pop-in** | Re-enter dígito a dígito con blur stagger cuando un número se actualiza (precio, contador, stock). | [`02-number-pop-in.md`](https://github.com/Jakubantalik/transitions.dev/blob/main/skills/transitions-dev/02-number-pop-in.md) |
| 3 | **Notification badge** | Slide + pop de un dot pequeño sobre un trigger (icono carrito, campana). | [`03-notification-badge.md`](https://github.com/Jakubantalik/transitions.dev/blob/main/skills/transitions-dev/03-notification-badge.md) |
| 4 | **Text states swap** | Swap de texto en el mismo slot con blur up/down (CTA "Agregar" → "Agregado"). | [`04-text-states-swap.md`](https://github.com/Jakubantalik/transitions.dev/blob/main/skills/transitions-dev/04-text-states-swap.md) |
| 5 | **Menu dropdown** | Dropdown origin-aware que crece desde su trigger (filtros, opciones de variante). | [`05-menu-dropdown.md`](https://github.com/Jakubantalik/transitions.dev/blob/main/skills/transitions-dev/05-menu-dropdown.md) |
| 6 | **Modal open / close** | Scale-up de modal con scale-down más suave al cerrar (modal de pago, info de envío). | [`06-modal.md`](https://github.com/Jakubantalik/transitions.dev/blob/main/skills/transitions-dev/06-modal.md) |
| 7 | **Panel reveal** | Slide de panel en una región con cross-blur (drawer de filtros móvil, carrito lateral). | [`07-panel-reveal.md`](https://github.com/Jakubantalik/transitions.dev/blob/main/skills/transitions-dev/07-panel-reveal.md) |
| 8 | **Page side-by-side** | Slide entre dos páginas (lista ↔ detalle, step 1 ↔ step 2 del checkout). | [`08-page-side-by-side.md`](https://github.com/Jakubantalik/transitions.dev/blob/main/skills/transitions-dev/08-page-side-by-side.md) |
| 9 | **Icon swap** | Cross-fade de dos iconos en el mismo slot con blur+scale (favorito on/off, ver password). | [`09-icon-swap.md`](https://github.com/Jakubantalik/transitions.dev/blob/main/skills/transitions-dev/09-icon-swap.md) |
| 10 | **Success check** | Fade + rotate + Y-bob + path stroke-draw para celebrar acción completada (pago aprobado, suscripción). | [`10-success-check.md`](https://github.com/Jakubantalik/transitions.dev/blob/main/skills/transitions-dev/10-success-check.md) |
| 11 | **Avatar group hover** | Lift con falloff de distancia en stack horizontal (avatares, chips, tags). | [`11-avatar-group-hover.md`](https://github.com/Jakubantalik/transitions.dev/blob/main/skills/transitions-dev/11-avatar-group-hover.md) |
| 12 | **Error state shake** | Shake per-segment con auto-revert (validación de formulario, PIN inválido, error de pago). | [`12-error-state-shake.md`](https://github.com/Jakubantalik/transitions.dev/blob/main/skills/transitions-dev/12-error-state-shake.md) |

## Decision rules — elegir la correcta

Match contra el **elemento UI primero**, luego el verbo:

- **Trigger + dot pequeño flotando encima** → notification badge.
- **Trigger + superficie que crece desde él** → dropdown (anchored, origin-aware) o modal (centrado, sin anchor).
- **Superficie que slide en una región de la página** → panel reveal.
- **Dos pantallas, lista ↔ detalle o step 1 ↔ step 2** → page side-by-side.
- **Elemento cambia width o height** → card resize.
- **Texto cambia en el mismo slot** → text states swap.
- **Dos iconos en el mismo slot** → icon swap.
- **Un número se actualiza** → number pop-in.
- **Confirmation / success / "listo"** (checkmark, pago procesado, suscripción) → success check.
- **Hover de un item en stack horizontal** (avatares, chips, segmented buttons, tag pills) → avatar group hover.
- **Error de validación / "esto está mal"** (input inválido, PIN incorrecto, código de descuento erróneo) → error state shake.
- **No hay match claro** → NO inventar. Pedir referencia al usuario.

Si dos transiciones podrían aplicar, **preferir la de menor overhead** (card resize antes que panel reveal, dropdown antes que modal, success check antes que celebración full-modal). Excepción: el diseño claramente pide la superficie más pesada.

El success check es **animación pura**. Si necesitas swap de spinner → check, **combinar con icon swap**.

## El bloque `:root` (instalar UNA sola vez)

Copiar este bloque al stylesheet global de cada app/layout que vaya a usar las transiciones. **NO duplicar.** Si ya está, no agregarlo de nuevo.

Path sugerido para LandingChat: `src/app/store/[slug]/storefront.css` (storefront) o `src/app/globals.css` (raíz). Decidir según scope.

```css
:root {
  /* Card resize */
  --resize-dur: 300ms;
  --resize-ease: cubic-bezier(0.22, 1, 0.36, 1);

  /* Number pop-in */
  --digit-dur: 500ms;
  --digit-distance: 8px;
  --digit-stagger: 70ms;
  --digit-blur: 2px;
  --digit-ease: cubic-bezier(0.34, 1.45, 0.64, 1);
  --digit-dir-x: 0;
  --digit-dir-y: 1;

  /* Notification badge */
  --badge-slide-dur: 260ms;
  --badge-pop-dur: 500ms;
  --badge-pop-close-dur: 180ms;
  --badge-fade-dur: 400ms;
  --badge-fade-close-dur: 180ms;
  --badge-blur: 2px;
  --badge-offset-x: -8.2px;
  --badge-offset-y: 12.4px;
  --badge-slide-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --badge-pop-ease: cubic-bezier(0.34, 1.36, 0.64, 1);
  --badge-close-ease: cubic-bezier(0.4, 0, 0.2, 1);

  /* Text states swap */
  --text-swap-dur: 150ms;
  --text-swap-translate-y: 4px;
  --text-swap-blur: 2px;
  --text-swap-ease: ease-in-out;

  /* Menu dropdown */
  --dropdown-open-dur: 250ms;
  --dropdown-close-dur: 150ms;
  --dropdown-pre-scale: 0.97;
  --dropdown-closing-scale: 0.99;
  --dropdown-ease: cubic-bezier(0.22, 1, 0.36, 1);

  /* Modal open / close */
  --modal-open-dur: 250ms;
  --modal-close-dur: 150ms;
  --modal-scale: 0.96;
  --modal-scale-close: 0.96;
  --modal-ease: cubic-bezier(0.22, 1, 0.36, 1);

  /* Panel reveal */
  --panel-open-dur: 400ms;
  --panel-close-dur: 350ms;
  --panel-translate-y: 100px;
  --panel-blur: 2px;
  --panel-ease: cubic-bezier(0.22, 1, 0.36, 1);

  /* Page side-by-side */
  --page-slide-dur: 200ms;
  --page-fade-dur: 200ms;
  --page-slide-distance: 8px;
  --page-blur: 3px;
  --page-stagger: 0ms;
  --page-exit-enabled: 1;
  --page-slide-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --page-fade-ease: cubic-bezier(0.22, 1, 0.36, 1);

  /* Icon swap */
  --icon-swap-dur: 200ms;
  --icon-swap-blur: 2px;
  --icon-swap-start-scale: 0.25;
  --icon-swap-ease: ease-in-out;

  /* Success check */
  --check-opacity-dur: 550ms;
  --check-rotate-dur: 550ms;
  --check-rotate-from: 80deg;
  --check-bob-dur: 450ms;
  --check-y-amount: 40px;
  --check-blur-dur: 500ms;
  --check-blur-from: 10px;
  --check-path-dur: 550ms;
  --check-path-delay: 80ms;
  --check-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --check-ease-opacity: cubic-bezier(0.22, 1, 0.36, 1);
  --check-ease-rotate: cubic-bezier(0.22, 1, 0.36, 1);
  --check-ease-bob: cubic-bezier(0.34, 1.35, 0.64, 1);
  --check-ease-path: cubic-bezier(0.22, 1, 0.36, 1);

  /* Avatar group hover */
  --avatar-lift: -4px;
  --avatar-dur: 320ms;
  --avatar-scale: 1.05;
  --avatar-falloff: 0.45;
  --avatar-ease-in: cubic-bezier(0.22, 1, 0.36, 1);
  --avatar-ease-out: cubic-bezier(0.34, 3.85, 0.64, 1);

  /* Error state shake */
  --shake-distance: 6px;
  --shake-overshoot: 4px;
  --shake-dur-a: 80ms;
  --shake-dur-b: 60ms;
  --shake-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --revert-hold: 3000ms;
  --revert-dur: 280ms;
}
```

## Output format — al aplicar una transición

1. **Asegurar que el `:root` block está instalado UNA VEZ** en el stylesheet global del scope (storefront, marketing, chat). No duplicar.
2. **Pegar el CSS de la transición verbatim** del archivo de referencia en GitHub. NO reescribir selectores, NO colapsar a shorthand, NO quitar `will-change`. Los snippets están tuneados.
3. **Cablear los hooks documentados**:
   - Clases: `.t-dropdown`, `.t-modal`, `.t-panel`, `.t-success-check`, `.t-avatar`, `.t-input`, etc.
   - Estados: `data-open`, `data-state`, `data-page`, `.is-open`, `.is-closing`, `.is-exit`, `.is-enter-start`, `.is-animating`, `.is-error`, `.is-shaking`.
4. **Preservar el bloque `@media (prefers-reduced-motion: reduce)`** que ships cada snippet. Quitarlo rompe la auditoría de accesibilidad (ver `.agents/skills/accessibility/SKILL.md`).
5. **Para transiciones con JS** (dropdown, modal, text swap, number pop-in, page slide, success check, avatar group hover, error state shake): copiar el snippet de orquestación de la referencia y adaptar los selectores. **Mantener las lecturas `getComputedStyle(...).getPropertyValue("--...")`** para que las duraciones queden en sync con `:root`.

**Diff pequeño**: editar solo los archivos necesarios. NO renombrar variables del proyecto, NO reformatear CSS no relacionado, NO traer una librería de motion.

## Common mistakes — no romper la transición

- ❌ **Quitar el cleanup del close-state** en dropdown/modal. Sin el `setTimeout` que remueve `.is-closing`, el próximo open salta desde la closing scale en vez del pre-open resting scale.
- ❌ **Olvidar el reflow** en text swap, number pop-in, success check replay y error state shake. `void el.offsetWidth` (o `offsetHeight`) entre remove y re-add de clase es lo que garantiza que la animación se replay.
- ❌ **Animar el container** en vez de las piezas internas. Badge: animar el dot, no el trigger. Page slide: animar las secciones, no el container.
- ❌ **Reemplazar `transition: ...` con `transition: all`**. Cada snippet enumera propiedades exactas a propósito para que cambios de estilo no relacionados no rideen.
- ❌ **Hardcodear `stroke-dasharray: 20`** en success check. El snippet trae `20` como placeholder. Reemplazar con `path.getTotalLength()` redondeado +1 para TU path, sino el stroke pre-revela o sobre-dibuja.
- ❌ **Setear `transition-timing-function` en CSS** para avatar group hover. Debe setearse inline en JS **antes** de escribir `--shift`/`--scale-active` para que el bouncy ease-out solo aplique en `mouseleave`.
- ❌ **Mezclar `.is-error` y `.is-shaking` en una clase** para error state shake. Mantenerlas ortogonales es lo que permite replay del shake (remove → reflow → re-add) sin flickear el error treatment completo.

## Integración LandingChat — dónde aplican

Lugares concretos del producto donde estas transiciones suman conversión:

### Storefront público (`src/app/store/[slug]/**`)

- **Add to cart CTA**: text states swap ("Agregar" → "Agregado") + icon swap (cart → check).
- **Mini-cart drawer**: panel reveal desde la derecha.
- **Filtros móvil**: panel reveal desde abajo (drawer).
- **Filtros desktop sticky**: dropdown menu (categorías colapsables, rangos de precio).
- **Variantes de producto** (talla, color): icon swap o text states swap.
- **Stock counter low**: number pop-in cuando baja.
- **Card de producto en grid**: card resize cuando expande detalles inline.

### Chat conversacional (`src/app/chat/**`)

- **Burbuja IA "escribiendo"** → text states swap o icon swap (dots → mensaje).
- **Sugerencias de productos del agente**: card resize al expandir.
- **CTA pago dentro del chat**: text states swap.

### Checkout / pago

- **Modal de pago** (Wompi, ePayco): modal open/close.
- **Pago aprobado** → success check (animación de cierre del flow). Caso clásico LATAM: este momento de "confirmación" reduce ansiedad y mejora la repurchase rate.
- **Pago rechazado / validación form**: error state shake en el input erróneo.

### SmartSearch header (`src/components/store/smart-search.tsx`)

- **Apertura del panel de resultados**: dropdown menu (anchored al input).
- **Resultados que llegan**: card resize del panel cuando cambia el tamaño según número de items.
- **Resultado vacío con sugerencias**: text states swap entre "Sin resultados" y "¿Quizás buscabas…?".

## Caveats LandingChat

- **Tailwind v4**: los snippets vienen en CSS vanilla. Pueden coexistir con clases Tailwind del componente (Tailwind para layout/spacing, el snippet para motion). NO intentar convertir a `@apply`.
- **Performance**: las 12 transiciones son lightweight. Pero si una página usa **muchas a la vez** (ej. storefront con 50 cards animando entrada), evaluar `IntersectionObserver` para animar solo lo visible.
- **Hydration**: los snippets que requieren JS deben correr **después** de `useEffect` o `'use client'`. NO ponerlos en server components.
- **Server Actions y motion**: si el cambio de estado viene de un Server Action, el motion se dispara en el cliente vía `useTransition` (React) + clase CSS. No mezclar conceptualmente "React Transition" con "CSS transition".
- **Mobile**: probar en device real, no solo emulador. iOS Safari tiene bugs con `backdrop-filter` y blur que pueden romper el badge fade-out.

## Cuándo NO usar el catálogo

- Si la transición que necesitas **no está en los 12** → diseñar específica con `cubic-bezier` y `prefers-reduced-motion`, pero **documentar en el componente** por qué se sale del catálogo.
- Si shadcn/ui ya provee la transición (ej. `Dialog`, `Sheet`, `Popover` ya tienen motion incluido), **NO sobrescribir** con estos snippets a menos que la diferencia sea perceptible y justificada.
- En el dashboard interno del merchant: usar shadcn por defecto, sin acentos de este catálogo.

## Referencias

- **Sitio**: https://transitions.dev/
- **Repo (MIT)**: https://github.com/Jakubantalik/transitions.dev
- **Skill SKILL.md**: https://github.com/Jakubantalik/transitions.dev/blob/main/skills/transitions-dev/SKILL.md
- **Creador**: [Jakub Antalik](https://x.com/jakubantalik)
- **Curso recomendado** (más profundo en motion): [animations.dev](https://animations.dev/) por Emil Kowalski
- Complementa: `.windsurf/rules/storefront-ui-taste.md`
