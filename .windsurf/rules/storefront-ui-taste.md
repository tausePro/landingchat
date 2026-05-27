---
trigger: glob
globs:
  - src/components/store/**
  - src/components/storefront/**
  - src/components/chat/**
  - src/app/store/**
  - src/app/chat/**
  - src/app/(marketing)/**
description: Disciplina de UI taste para storefront, chat y landing público de LandingChat. Anti-slop, premium, mix minimalist + soft.
---

# Storefront UI Taste

Adaptado de `Leonxlnx/taste-skill` (skills `soft-skill` y `minimalist-skill`). Aplica al construir o tocar componentes UI del storefront, chat público o landing marketing. No aplica al dashboard interno del merchant (su disciplina es funcional, no editorial).

## Por qué existe esto

LandingChat vende experiencia visual a merchants LATAM. La diferencia entre conversión 2% y conversión 4% es UI premium vs UI genérica. Esta rule combate el "AI-looking generic SaaS" en código nuevo.

## Scope y pragmatismo

- **Aplica a código nuevo o refactor sustantivo** que toca los paths del glob.
- **NO obliga refactor masivo** del UI existente. Si tocas un componente que rompe estas reglas, corrige solo lo que está en el bloque/flujo modificado.
- **El branding del tenant manda** en colores y fuentes (vía `Customizer` y `customization` de la org). Estas reglas aplican a estructura, spacing, motion y patrones.
- **shadcn/ui y `lucide-react` están permitidos** porque son la base actual. Pero preferir variantes light de iconos cuando se pueda.

## Banlist absoluto

**Tipografía:**

- ❌ NO usar `font-family` hardcoded `Inter`, `Roboto`, `Arial`, `Open Sans`, `Helvetica`. Si la org no definió fuente, fallback al `font-sans` de Tailwind (que ya está configurado por tenant).
- ❌ NO usar absolute black `#000000` para body text. Usar `text-slate-900` (= `#0f172a`) o `text-neutral-900`.

**Colores:**

- ❌ NO hardcodear hex/rgb fuera de tokens. Usar Tailwind o CSS variables semánticas (`--primary`, `--background`, `--foreground`).
- ❌ NO usar gradientes neón, glassmorphism agresivo, ni saturación alta sin razón.
- ❌ NO usar fondos de color primario para secciones grandes (ej. hero entero en azul brillante). El primary se usa para CTAs y acentos.

**Sombras:**

- ❌ NO usar `shadow-md`, `shadow-lg`, `shadow-xl` por defecto en cards.
- ✅ Usar `shadow-sm` o customizadas ultra-difusas:
  ```
  shadow-[0_2px_8px_rgba(0,0,0,0.04)]
  shadow-[0_1px_3px_rgba(0,0,0,0.06)]
  ```

**Layout:**

- ❌ NO sticky navbars edge-to-edge pegados al top en marketing/landing pages — preferir floating navbar con `mt-4` y bordes `rounded-full`.
- ❌ NO grids simétricos 3-col tipo Bootstrap sin macro-whitespace.

**Motion:**

- ❌ NO `transition: linear` ni `transition-all`. Usar curvas custom: `cubic-bezier(0.16, 1, 0.3, 1)` (out-expo) o `cubic-bezier(0.22, 1, 0.36, 1)` (out-quint).
- ❌ NO animar `width`, `height`, `top`, `left`. Solo `transform` y `opacity`.
- ❌ NO `window.addEventListener('scroll')` para reveals. Usar `IntersectionObserver` o Framer Motion `whileInView`.

**Copy:**

- ❌ NO clichés AI: "Elevate", "Seamless", "Unleash", "Next-Gen", "Game-changer", "Delve", "Revolutionize". Escribir directo y específico.
- ❌ NO placeholders genéricos: "John Doe", "Acme Corp", "Lorem Ipsum". Usar contenido contextual o real.
- ❌ NO emojis en headings, copy de marketing, o alt text. Replazar con ícono Lucide o SVG.

## Patrones positivos

### Spacing y rhythm

- **Macro-whitespace:** secciones del storefront/landing usan `py-16` a `py-24`. Para landing especialmente premium, hasta `py-32`. NO `py-8` en hero.
- **Container width:** texto largo en `max-w-2xl`, `max-w-4xl`. Layouts asimétricos en `max-w-7xl`.
- **Eyebrow tags:** preceder H1/H2 con badge pill microscópico:
  ```tsx
  <span className="inline-flex rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-medium bg-slate-100 text-slate-600">
    Categoría
  </span>
  ```

### Tipografía

- **Hero headings (marketing only):** familia serif si el tenant la tiene configurada, con `tracking-tight` (`letter-spacing: -0.02em`) y `leading-[1.1]`.
- **Body:** `text-slate-700` o `text-foreground/80` con `leading-relaxed` (≥ 1.6).
- **Secondary text:** `text-slate-500` o `text-muted-foreground`.
- **Tags/badges:** `text-[10px]` o `text-xs`, uppercase con `tracking-[0.15em]` o `tracking-widest`.

### Bordes y radius

- **Cards de feature grid:** `border border-slate-200` o `ring-1 ring-slate-200/60` con `rounded-xl` o `rounded-2xl`. Padding interno generoso `p-6` a `p-10`.
- **Containers premium ("double-bezel"):** outer wrapper sutil + inner content:
  ```tsx
  <div className="rounded-[2rem] bg-slate-50 p-1.5 ring-1 ring-slate-200/60">
    <div className="rounded-[calc(2rem-0.375rem)] bg-white p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)]">
      {children}
    </div>
  </div>
  ```
- **CTA buttons primarios:** `rounded-full` con padding `px-6 py-3` o variante shadcn `Button` con `className="rounded-full"`. Hover: `active:scale-[0.98]`.
- **CTA con flecha:** ícono dentro de su propio círculo nested, no flotando:
  ```tsx
  <Button className="rounded-full pr-1.5 group">
    <span>Empezar ahora</span>
    <span className="ml-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition-transform group-hover:translate-x-0.5 group-hover:scale-105">
      <ArrowRight className="w-4 h-4" />
    </span>
  </Button>
  ```

### Color palette por defecto

Cuando el tenant NO ha configurado branding (estado pre-customizer):

- Canvas: `bg-white` o `bg-stone-50`
- Surfaces: `bg-white` o `bg-slate-50`
- Borders/dividers: `border-slate-200` (= `#e2e8f0`)
- Primary text: `text-slate-900`
- Secondary text: `text-slate-500`
- Accents pasteles desaturados solo para badges/tags inline:
  - Pale Red: `bg-rose-50 text-rose-700`
  - Pale Blue: `bg-sky-50 text-sky-700`
  - Pale Green: `bg-emerald-50 text-emerald-700`
  - Pale Yellow: `bg-amber-50 text-amber-700`

Cuando el tenant SÍ tiene branding configurado, usar las CSS variables del Customizer (`var(--primary)`, etc.) en lugar de hardcoded.

### Iconografía

- **Lucide preferido** (ya está en el codebase) — usar `strokeWidth={1.5}` o `1.75` para look más fino.
- **Para componentes premium especialmente:** considerar Phosphor Icons (light variant) o Remix Line si el peso ya está justificado.
- **Tamaños:** `w-4 h-4` en buttons, `w-5 h-5` en headers, `w-6 h-6` o más en feature cards.
- **Stroke width consistente** en todo un componente. NO mezclar `strokeWidth=1` con `strokeWidth=2.5`.

### Motion

**Curvas:**

```css
transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1);   /* out-expo, default */
transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);  /* out-quint, suave */
transition-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1); /* spring suave para hover */
```

**Hover states:**

- Cards: `transition-shadow duration-200` con shift `shadow-none → shadow-[0_2px_8px_rgba(0,0,0,0.04)]`.
- Buttons: `transition-transform active:scale-[0.98]`.
- Inner icon translate diagonal en hover (ver patrón CTA arriba).

**Scroll entry:**

```tsx
// Con Framer Motion (preferido en LandingChat)
<motion.div
  initial={{ opacity: 0, y: 16 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: "-10%" }}
  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
>
  ...
</motion.div>
```

**Stagger en listas:**

```tsx
{items.map((item, i) => (
  <motion.div
    key={item.id}
    initial={{ opacity: 0, y: 12 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
  >
    ...
  </motion.div>
))}
```

### Imagery

- Productos del catálogo: respetar lo que sube el merchant. NO aplicar filtros agresivos.
- Hero/marketing imagery: si usas placeholders, `https://picsum.photos/seed/{context}/1200/800`. Para ambient overlay: `opacity-[0.04]` warm grain.
- Backgrounds de sección: NO secciones planas vacías. Usar `radial-gradient` warm con `opacity: 0.03-0.05` o pattern geométrico sutil para profundidad.

## Performance guardrails

- **GPU-only animation**: solo `transform`, `opacity`, `filter`. NUNCA `top`, `left`, `width`, `height`.
- **`backdrop-blur` solo en fixed/sticky**: navbars, overlays, modales. NO en scrolling containers — causa repaints continuos en mobile.
- **Grain/noise overlays**: solo en `position: fixed; inset: 0; pointer-events: none; z-index: <fijo>`.
- **`will-change`**: solo en elementos actualmente animándose. Removerlo cuando no.
- **Z-index discipline**: reservar para capas sistémicas (sticky nav, modales, tooltips). NO `z-[9999]` arbitrarios.

## Pre-output checklist

Antes de cerrar un componente nuevo del storefront/chat/marketing, validar:

- [ ] Cero items de la banlist absoluta están presentes
- [ ] Spacing de sección ≥ `py-16` (storefront) o `py-24` (marketing)
- [ ] Cards con `border-slate-200` o `ring-1 ring-slate-200/60`, `rounded-xl`+
- [ ] CTAs primarios con `rounded-full` o el patrón shadcn `Button` con `active:scale-[0.98]`
- [ ] Transitions con curva custom — ningún `linear` ni `ease-in-out`
- [ ] Scroll entry usa `IntersectionObserver` o Framer Motion `whileInView`
- [ ] Animations solo `transform` y `opacity`
- [ ] Layout colapsa a single-column bajo `768px` con `w-full px-4`
- [ ] `backdrop-blur` solo en fixed/sticky
- [ ] Iconos con stroke width consistente
- [ ] Cero placeholder genérico ("John Doe", "Lorem Ipsum") y cero copy AI cliché
- [ ] Branding del tenant respetado vía CSS variables, no hardcoded

## Anti-patterns frecuentes en LandingChat

| Mal | Bien |
|---|---|
| `<div className="shadow-lg rounded-md">` | `<div className="shadow-[0_2px_8px_rgba(0,0,0,0.04)] rounded-xl">` |
| `<button className="bg-blue-500 hover:bg-blue-600">` | `<Button>` (shadcn, hereda primaryColor del tenant) |
| `transition-all duration-300` | `transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]` |
| `<h1>Elevate your business with seamless commerce</h1>` | `<h1>Vendé tus productos por chat. Cobrás en 24h.</h1>` |
| `useEffect(() => { window.addEventListener('scroll', ...) })` | `useInView()` de Framer Motion o `IntersectionObserver` |
| Card flat con border 1px solid | Card con outer wrapper + inner core (double-bezel) o ring sutil |

## Referencias

- Patrón origen: `Leonxlnx/taste-skill` (`soft-skill` + `minimalist-skill`)
- Customizer del tenant: `src/components/customizer/`
- Tokens del design system: `src/app/globals.css`, `tailwind.config.ts`
- `AGENTS.md` § React / Next.js
