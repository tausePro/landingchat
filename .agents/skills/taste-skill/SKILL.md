---
name: taste-skill
description: Anti-slop frontend skill for landing pages, storefronts, portfolios, and redesigns. Reads the brief, infers the right design direction, and ships interfaces that do not look templated. Real design systems when applicable, audit-first on redesigns, strict pre-flight check.
---

# Taste Skill — Anti-Slop Frontend

For landing pages, storefronts, marketing pages, portfolios, and redesigns — NOT dashboards / data tables / multi-step product UI. Every rule is contextual: read the brief, then pull only what fits.

The full playbook lives in `references/playbook.md` (Sections 0–9). This file is the concise core; **read the relevant playbook section before generating or auditing**, instead of loading the whole thing into context.

## Always do this (core discipline)
1. **Design Read first.** Before any code, state one line: *"Reading this as: <page kind> for <audience>, with a <vibe> language, leaning toward <design system / aesthetic family>."* (playbook §0)
2. **Ask one question if the brief is ambiguous — do not guess** the aesthetic. (§0.C)
3. **Anti-default discipline:** never ship the generic AI default (centered hero + 3 equal cards + purple gradient + emoji bullets). (§0.D, §9)
4. **Pre-flight before declaring done:** audit against the "AI Tells" / forbidden patterns (§9) and the layout hard-rules (§4.7). Failing any = broken work.

## Workflow
- **New build:** Design Read → set the 3 dials (DESIGN_VARIANCE / MOTION_INTENSITY / VISUAL_DENSITY, §1+§7) → pick design system or aesthetic (§2) → build with the directives (§4) → motion (§5) within a11y guardrails (§6) → pre-flight (§9).
- **Redesign / audit (audit-first):** inventory what exists (brand assets, current structure) → Design Read → identify the "AI tells" + layout failures (§9, §4.7) → propose the direction → then change.

## Reference index — read the section you need from `references/playbook.md`
- **§0** Brief inference + Design Read · **§1** The three dials · **§2** Brief→design-system map
- **§3** Default architecture (stack, state, icons, emoji policy, responsiveness, dependency verification)
- **§4** Design engineering directives (typography, color, layout diversification, materiality, UI states, forms, **layout hard-rules §4.7**, images, content density, testimonials, theme lock)
- **§5** Motion skeletons (sticky-stack, horizontal-pan, scroll-reveal) + forbidden animations
- **§6** Performance & a11y guardrails (reduced motion, dark mode, CWV) · **§7** Dial definitions
- **§8** Dark mode protocol · **§9** AI tells (forbidden patterns) — use as the pre-flight checklist

When auditing or building, grep/read the specific section(s) above rather than the whole file.
