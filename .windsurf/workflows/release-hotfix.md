---
description: Cómo hacer un hotfix release v1.x.y en LandingChat
---

# Release Hotfix

Ejecutar cuando hay un bug crítico en producción que necesita salir YA, sin esperar al ciclo regular.

## Pre-flight

1. Confirmar el bug está reproducido y entendido. Si NO está claro el root cause, **NO** continuar con hotfix — preferir investigación con el equipo.
2. Verificar la rama actual: el hotfix sale desde `main` (si `main` es la rama de prod) o desde la última rama estable.
   ```bash
   git status
   git fetch origin
   git checkout main
   git pull origin main
   ```
3. Crear rama hotfix:
   ```bash
   git checkout -b hotfix/v1.x.y-descripcion-corta
   ```

## Implementación

4. Aplicar **el cambio mínimo posible** para fijar el bug. Bug fixing discipline:
   - Atacar root cause, no síntomas
   - Single-line change si es suficiente
   - Sin refactor colateral
5. Agregar test de regresión que falle antes del fix y pase después.
6. Verificar local:
   ```bash
   npm run lint
   npm run test
   npm run build
   ```
7. Validar el escenario reproducido manualmente (browser, curl, etc.) si aplica.

## Release

8. Bump de versión en `package.json` (patch: `1.11.51` → `1.11.52`):
   ```bash
   npm version patch --no-git-tag-version
   ```
9. Commit con prefijo `fix:` o `security:`:
   ```bash
   git add -A
   git commit -m "fix: <descripción corta del bug y fix>"
   ```
10. Push y abrir PR a `main`:
    ```bash
    git push -u origin hotfix/v1.x.y-descripcion-corta
    ```
11. Tras merge, taggear:
    ```bash
    git checkout main && git pull
    git tag v1.x.y
    git push origin v1.x.y
    ```

## Post-deploy

12. Verificar en producción que el bug ya no se reproduce.
13. Anotar en `docs-private/TORRE_DE_CONTROL_EJECUCION.md` el hotfix y la fecha.
14. Si el bug afectó a clientes (Tez, Quality Pets, Casa Inmobiliaria), avisar por el canal correspondiente.

## Si algo sale mal

- **Build falla en CI**: revisar logs, no forzar merge.
- **Bug persiste post-deploy**: rollback inmediato (revertir commit en `main` o redeploy de versión anterior en Vercel).
- **Cliente reporta nuevos bugs**: registrar en `docs-private/PUNCHLIST_HARDENING_PLATAFORMA_2026-04.md` y priorizar.
