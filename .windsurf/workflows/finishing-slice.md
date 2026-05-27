---
description: Cerrar un slice de LandingChat con verificación, merge feat → develop → main + tag, smoke prod y torre de control
---

# Finishing a Slice

Adaptado de `obra/superpowers/skills/finishing-a-development-branch`. Cierra un slice de feature/refactor en LandingChat de forma consistente. Para hotfixes urgentes, usar `/release-hotfix` en su lugar.

## Cuándo aplicar

- Acabaste un slice de feature en una rama `feat/<topic>` o `refactor/<topic>` y quieres cerrarlo
- Trabajo verificado localmente (tsc clean + tests focales passing)
- El usuario hizo smoke local y aprobó el comportamiento

**No aplicar para:**

- Hotfixes urgentes — usar `/release-hotfix`
- Trabajo que aún no pasó verificación local — primero correr `verification-before-commit`
- Slices que aún no están aprobados por el usuario — primero `/brainstorm-slice` o conversación de refinamiento

## Pre-flight

### Paso 0: Verificar tests + tsc + lint

**ANTES de presentar opciones**, verificar que el slice está sano:

```bash
# tsc clean
npx tsc --noEmit --pretty false

# Tests focales del slice
npx vitest run <archivos_focales_del_slice>

# Lint en archivos tocados (no full repo)
npx eslint <archivos_tocados>
```

**Si algo falla:** STOP. Reportar al usuario:

```
Verificación falla:
- tsc: <count> errores
- tests: <X/Y> passing
- lint: <count> errores

No puedo continuar con merge hasta resolver.
```

**Si todo pasa:** continuar al Paso 1.

### Paso 1: Detectar entorno

```bash
git branch --show-current     # rama actual
git status --short            # cambios pendientes
git log --oneline -5          # commits recientes
```

Verificar:

- ¿Estoy en una rama `feat/`, `refactor/`, `fix/`?
- ¿Hay cambios sin commitear?
- ¿La rama está pushed a origin?

## Paso 2: Determinar el flujo de release

LandingChat usa Git Flow simplificado:

| Tipo de slice | Rama origen | Destino | Tag |
|---|---|---|---|
| Feature normal (UX, refactor moderado, nueva feature) | `feat/<topic>` | `develop` → `main` | `v1.x.0` minor |
| Refactor o feature grande con riesgo | `feat/<topic>` o `refactor/<topic>` | `develop` (esperar más slices) → `main` | `v1.x.0` minor cuando se acumulen |
| Hotfix urgente | `hotfix/v1.x.y-...` | `main` directo | `v1.x.y` patch |
| Slice incompleto | feature branch | NO mergear, queda abierto | — |

### Paso 3: Presentar opciones al usuario

Tras la verificación, presentar exactamente estas 4 opciones:

```
Slice listo localmente. Verificación: tsc clean + X/X tests passing.

¿Qué hacemos?

1. Merge feat → develop → main + tag (ciclo completo)
2. Merge feat → develop, dejar main para acumular más slices
3. Push del feat branch + abrir PR (review humano antes del merge)
4. Mantener como está (el usuario lo cerrará después)

¿Opción?
```

**No agregar explicación adicional** — opciones concisas.

Si el slice tiene PR template aplicable o requiere review por security/payments, sugerir Opción 3 explícitamente.

## Paso 4: Ejecutar la opción

### Opción 1: Ciclo completo feat → develop → main + tag

**Pre-requisitos:**

- Slice probado en al menos 1 tenant real (Tez si toca storefront, Quality Pets si toca chat, etc.)
- Migraciones SQL aplicadas en Supabase prod (confirmado por usuario)
- `package.json` version bump apropiado:

```bash
# Decidir bump según convención semver
npm version minor --no-git-tag-version   # nueva feature
# o
npm version patch --no-git-tag-version   # bug fix
```

**Ejecutar (en orden estricto):**

```bash
# 1. Push del feat branch (backup)
git push -u origin feat/<topic>

# 2. Merge a develop con --no-ff
git checkout develop
git pull origin develop
git merge --no-ff feat/<topic> -m "merge: <topic> (v1.x.y) into develop

<resumen 2-3 líneas>"

# 3. Push develop
git push origin develop

# 4. Merge develop a main con --no-ff
git checkout main
git pull origin main
git merge --no-ff develop -m "merge: <topic> (v1.x.y) into main

<resumen ejecutivo del slice>"

# 5. Tag anotado
git tag -a v1.x.y -m "<topic> - one-liner driver

<resumen + verificación + pendientes operativos>"

# 6. Push main + tag
git push origin main
git push origin v1.x.y
```

**Tras el push:**

1. Verificar que Vercel arranque el deploy automático.
2. Esperar a que el deploy llegue a "Ready".
3. Smoke prod en al menos 1 tenant real (el usuario hace el smoke; reportar URL específica).
4. Si smoke OK: actualizar `docs-private/TORRE_DE_CONTROL_EJECUCION.md` con el slice cerrado, fecha y tag.
5. Si smoke falla: NO retroceder commits — abrir hotfix branch y arreglar adelante.

### Opción 2: Solo merge a develop

```bash
git push -u origin feat/<topic>
git checkout develop
git pull origin develop
git merge --no-ff feat/<topic> -m "merge: <topic> into develop (acumulando)

<resumen>"
git push origin develop
```

**No taggear.** El tag sale cuando se merge develop a main con N slices acumulados.

Reportar al usuario:

> Mergeado a develop. main está N commits behind. ¿Acumulamos más o promovemos a main ahora?

### Opción 3: Push + PR para review

```bash
git push -u origin feat/<topic>

gh pr create --base develop --title "<topic>" --body "$(cat <<'EOF'
## Summary

<2-3 bullets de qué cambió>

## Verificación local

- tsc --noEmit: ✅ exit 0
- Tests focales: ✅ X/X passing
- Smoke local: ✅ confirmado por usuario

## Pendientes operativos

- [ ] Aplicar migraciones (si aplica)
- [ ] Smoke prod
- [ ] Actualizar torre de control

## Test Plan

<pasos de verificación post-merge>
EOF
)"
```

NO mergear. El usuario revisa el PR y mergea cuando esté listo.

### Opción 4: Mantener como está

Reportar al usuario:

> Slice queda en `feat/<topic>` (push: <yes/no>). Worktree preservado en <path>. Cuando lo cierres, podemos retomar con `/finishing-slice`.

## Paso 5: Cleanup post-merge (solo Opciones 1 y 2)

```bash
# Volver a la rama de trabajo siguiente
git checkout develop   # o main si es ciclo completo

# Opcional: borrar la rama local del feat
git branch -d feat/<topic>

# La rama remota se puede dejar (GitHub la marca como mergeada) o borrar:
git push origin --delete feat/<topic>
```

**No borrar la rama remota si:** la PR todavía está abierta o el usuario va a iterar en feedback.

## Paso 6: Actualizar Torre de Control

Tras smoke prod OK, agregar entrada en `docs-private/TORRE_DE_CONTROL_EJECUCION.md`:

```markdown
### Slice v1.x.y — <topic>

- **Fecha cierre:** YYYY-MM-DD
- **Tag:** v1.x.y
- **Driver:** <dolor / tenant que lo pidió>
- **Resumen:** <1-2 líneas>
- **Verificación local:** tsc clean + X/X tests
- **Smoke prod:** OK en <tenants probados>
- **Pendientes operativos resueltos:** <lista>
- **Pendientes operativos en cola:** <lista o "ninguno">
```

## Quick reference

| Opción | Push feat | Merge develop | Merge main | Tag | Smoke prod |
|---|---|---|---|---|---|
| 1. Ciclo completo | ✅ | ✅ | ✅ | ✅ | Requerido tras |
| 2. Solo develop | ✅ | ✅ | — | — | Opcional |
| 3. PR para review | ✅ | — | — | — | Tras merge del PR |
| 4. Mantener | Opcional | — | — | — | — |

## Errores comunes

**Saltar verificación de tests**

- Problema: mergear código roto, romper main, romper smoke prod
- Fix: SIEMPRE correr tsc + tests focales antes del Paso 3

**Merge sin --no-ff**

- Problema: pierdes el commit de merge que documenta el slice
- Fix: SIEMPRE `git merge --no-ff` con mensaje sustantivo

**Olvidar el tag tras Opción 1**

- Problema: deploy a prod sin versionado, hace difícil rollback
- Fix: el tag es parte de la opción 1, no es opcional

**Mergear a main sin smoke develop**

- Problema: si develop está mergeado solo, esperamos al user smoke en preview de develop antes de promover a main
- Fix: en Opción 1, hacer las 2 capas; en Opción 2, esperar smoke develop antes de avanzar

**Empujar main sin pull primero**

- Problema: si alguien más mergeo (tausebot, otro dev), tu push falla o crea historia divergente
- Fix: SIEMPRE `git pull origin main` antes del merge final

**Borrar feat branch antes de smoke prod**

- Problema: si el smoke falla, ya no tienes la rama para iterar
- Fix: borrar la rama solo tras smoke prod OK (o mantenerla)

## Red flags — STOP

**Nunca:**

- Mergear con tests fallando
- Mergear a main sin haber pasado por develop
- Force-push a main o develop sin acuerdo explícito
- Saltarse el tag en Opción 1
- Saltarse la actualización de Torre de Control
- Cerrar un slice sin smoke prod cuando toca producción real

**Siempre:**

- Verificar tests + tsc + lint antes de presentar opciones
- Detectar el entorno (rama, dirty state) antes de presentar el menú
- Presentar exactamente las 4 opciones
- Push del feat branch antes del merge (backup)
- Merge con --no-ff y commit message sustantivo
- Tag anotado (no lightweight) en Opción 1
- Smoke prod tras Opción 1 antes de declarar el slice cerrado
- Actualizar `docs-private/TORRE_DE_CONTROL_EJECUCION.md`

## Referencias

- Patrón origen: `obra/superpowers/skills/finishing-a-development-branch`
- `release-hotfix.md` — hotfix flow (NO usar este para hotfixes)
- `verification-before-commit.md` — gate previo
- `AGENTS.md` § Commits y release
