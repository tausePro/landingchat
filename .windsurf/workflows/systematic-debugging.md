---
description: Debugging metódico en 4 fases. Atacar root cause, no síntomas. Aplica para bugs hardcore (RLS, webhooks, pagos, FTS, race conditions).
---

# Systematic Debugging

Adaptado de `obra/superpowers/skills/systematic-debugging`. Cuando un bug en LandingChat no es trivial, NO empezar a tocar código a ciegas. Seguir las 4 fases.

## Principio núcleo

**SIEMPRE encontrar root cause antes de proponer fixes.** Fixes de síntoma son fracaso.

Violar la letra de este proceso es violar el espíritu del debugging.

## La ley de hierro

```
NINGÚN FIX SIN INVESTIGACIÓN DE ROOT CAUSE PRIMERO
```

Si no completé la Fase 1, no puedo proponer fixes.

## Cuándo aplicar

**Para CUALQUIER issue técnico:**

- Test failures
- Bugs en producción reportados por tenants
- Comportamiento inesperado en chat / storefront / dashboard
- Performance problems (consultas lentas, dev server colgado)
- Build failures
- Webhooks que no llegan o llegan mal
- RLS que bloquea cuando no debería (o no bloquea cuando debería)

**Especialmente cuando:**

- Hay presión de tiempo (Tez reporta el bug, mañana hay venta) — la presión hace tentador adivinar
- "Solo un fix rápido" parece obvio
- Ya intentaste 1-2 fixes y siguen apareciendo problemas
- No entiendes del todo el issue

**No saltar nunca cuando:**

- El issue parece simple (los bugs simples también tienen root cause)
- Estás apurado (sistemático es más rápido que adivinar)
- El cliente quiere fix YA (sistemático es más rápido)

## Las 4 fases

DEBES completar cada fase antes de pasar a la siguiente.

### Fase 1: Investigación de Root Cause

**ANTES de intentar CUALQUIER fix:**

#### 1.1 Leer mensajes de error con cuidado

- No saltarse errores ni warnings
- Suelen contener la solución exacta
- Leer stack traces completos
- Anotar línea, archivo, error code

#### 1.2 Reproducir consistente

- ¿Puedes triggerearlo confiablemente?
- ¿Cuáles son los pasos exactos?
- ¿Pasa siempre o intermitente?
- Si NO es reproducible → recolectar más data, NO adivinar

#### 1.3 Revisar cambios recientes

```bash
git log --oneline -20
git diff HEAD~5
```

- ¿Qué cambió que pueda causar esto?
- Nuevas dependencias, config changes
- Diferencias de entorno (dev vs prod, vs un tenant específico)

#### 1.4 Recolectar evidencia en sistemas multi-componente

LandingChat tiene MUCHAS capas. **ANTES de proponer fixes, agregar instrumentación:**

```
Para CADA boundary entre componentes:
  - Loggear qué data entra
  - Loggear qué data sale
  - Verificar propagación de env/config
  - Chequear estado en cada capa

Correr una vez para recolectar evidencia mostrando DÓNDE rompe
DESPUÉS analizar evidencia para identificar componente fallante
DESPUÉS investigar ese componente específico
```

**Ejemplo (webhook Wompi):**

```bash
# Capa 1: Vercel recibe el request
echo "=== Request entrante ==="
echo "Headers: $headers"
echo "Body length: ${#body}"

# Capa 2: validación de firma
echo "=== Firma ==="
echo "Signature header: $sig_header"
echo "Computed signature: $computed_sig"
echo "Match: $([ "$sig_header" = "$computed_sig" ] && echo YES || echo NO)"

# Capa 3: parse del payload
echo "=== Payload parseado ==="
echo "Event type: $event_type"
echo "Reference: $reference"

# Capa 4: lookup en orders
echo "=== DB lookup ==="
psql -c "SELECT id, status, organization_id FROM orders WHERE reference = '$reference'"

# Capa 5: actualización
echo "=== Update result ==="
echo "Rows affected: $rows"
```

**Esto revela:** Qué capa falla (webhook llega ✓, firma OK ✓, parse ✓, lookup retorna 0 rows ✗ → bug está en el matching de reference).

#### 1.5 Trace data flow

**Cuando el error está profundo en el call stack:**

- ¿Dónde nace el valor malo?
- ¿Quién llamó a esto con valor malo?
- Seguir hacia arriba hasta encontrar la fuente
- **Fix en la fuente, NO en el síntoma**

### Fase 2: Análisis de patrones

**Encontrar el patrón antes de fijar:**

#### 2.1 Encontrar ejemplos que funcionan

- Ubicar código similar que SÍ funciona en el mismo codebase
- ¿Qué hay parecido a lo roto que funciona?

Ejemplo LandingChat:

- ¿Hay otra RPC con `SECURITY DEFINER` que funciona y la mía no? Comparar permisos
- ¿Hay otra route handler que valida firma y funciona? Comparar el código
- ¿Hay otro componente con `useRouter().push()` y el mío no navega? Comparar contexto

#### 2.2 Comparar con referencias

- Si implemento un patrón externo (Algolia, MercadoPago docs, Wompi docs), leer la referencia COMPLETA
- No skim — leer cada línea
- Entender el patrón antes de aplicarlo

#### 2.3 Identificar diferencias

- ¿Qué difiere entre lo roto y lo que funciona?
- Listar TODAS las diferencias, por pequeñas que sean
- No asumir "eso no puede importar"

#### 2.4 Entender dependencias

- ¿Qué otros componentes necesita esto?
- ¿Qué settings, config, env?
- ¿Qué assumptions hace?

### Fase 3: Hipótesis y testing

**Método científico:**

#### 3.1 Formular UNA hipótesis

> Creo que X es el root cause porque Y.

- Escribirla.
- Específica, no vaga.

Ejemplo malo: "creo que es problema de RLS".
Ejemplo bueno: "creo que `get_my_org_id()` devuelve NULL en este request porque el JWT no tiene `org_id` en `app_metadata`. Lo verifico con `auth.jwt() ->> 'app_metadata'` desde el SQL editor".

#### 3.2 Test mínimo

- El cambio MÁS PEQUEÑO posible que prueba la hipótesis
- Una variable a la vez
- NO arreglar varias cosas a la vez

#### 3.3 Verificar antes de continuar

- ¿Funcionó? Sí → Fase 4
- ¿No funcionó? Formular NUEVA hipótesis
- NO acumular fixes encima

#### 3.4 Cuando no sabes

> No entiendo X.

- No pretender saber.
- Pedir ayuda al usuario.
- Investigar más.

### Fase 4: Implementación

**Fijar el root cause, no el síntoma:**

#### 4.1 Crear test fallante

- Reproducción más simple posible
- Test automatizado si se puede
- Script one-off si no hay framework
- DEBE existir antes del fix
- Para tests de regresión: ciclo RED-GREEN obligatorio

#### 4.2 Implementar UN fix

- Atacar el root cause identificado
- UN cambio a la vez
- NO "ya que estoy aquí, refactoreo esto otro"
- NO bundling

#### 4.3 Verificar fix

- ¿El test pasa ahora?
- ¿No rompió otros tests?
- ¿El issue real se resolvió en el contexto donde se reportó?

#### 4.4 Si el fix no funciona

- STOP
- Contar: ¿cuántos fixes intentaste?
- Si < 3: Volver a Fase 1, re-analizar con info nueva
- **Si ≥ 3: STOP y cuestionar la arquitectura (4.5)**
- NO intentar Fix #4 sin discutir

#### 4.5 Si 3+ fixes fallaron: cuestionar arquitectura

**Patrón que indica problema arquitectónico:**

- Cada fix revela nuevo shared state / coupling / problem en otro lugar
- Los fixes requieren "refactor masivo" para implementarse
- Cada fix crea síntomas nuevos

**STOP y cuestionar fundamentals:**

- ¿Este patrón es fundamentalmente sólido?
- ¿Estamos atascados por inercia?
- ¿Refactor de arquitectura vs continuar fijando síntomas?

**Discutir con el usuario antes de más fixes.** Esto NO es hipótesis fallida — es arquitectura equivocada.

## Red flags — STOP y volver a Fase 1

Si me cacho pensando:

- "Quick fix por ahora, investigo después"
- "Solo intentar cambiar X y ver si funciona"
- "Agregar varios cambios y correr tests"
- "Skip el test, lo verifico manual"
- "Probablemente es X, lo arreglo"
- "No entiendo del todo pero esto puede que funcione"
- "El patrón dice X pero lo adapto distinto"
- "Aquí están los problemas: [lista de fixes sin investigación]"
- Proponiendo soluciones antes de tracear data flow
- **"Un intento más" (cuando ya hay 2+ fallidos)**
- **Cada fix revela problema en otro lugar**

**TODOS estos = STOP. Volver a Fase 1.**

## Señales del usuario de que lo estoy haciendo mal

Vigilar redirecciones:

- "¿Eso no está pasando?" → asumiste sin verificar
- "¿Eso nos va a mostrar...?" → debiste agregar evidencia
- "Deja de adivinar" → estás proponiendo fixes sin entender
- "Ultrathink esto" / "Razona más" → cuestiona fundamentals, no síntomas
- "¿Estamos atascados?" (frustrado) → tu approach no funciona

**Cuando veas estas:** STOP. Volver a Fase 1.

## Anti-rationalizations

| Excusa | Realidad |
|---|---|
| "El issue es simple, no necesita proceso" | Issues simples también tienen root causes. El proceso es rápido para bugs simples. |
| "Emergencia, no hay tiempo de proceso" | Sistemático es MÁS rápido que thrashing |
| "Solo intento esto primero, después investigo" | El primer fix marca el patrón. Hacerlo bien desde el inicio. |
| "Test después de confirmar fix" | Fixes sin test no aguantan. Test primero prueba. |
| "Múltiples fixes ahorran tiempo" | No puedes aislar qué funcionó. Genera nuevos bugs. |
| "Referencia muy larga, adapto el patrón" | Comprensión parcial garantiza bugs. Leer completo. |
| "Veo el problema, lo arreglo" | Ver síntomas ≠ entender root cause |
| "Un intento más" (tras 2+ fallidos) | 3+ fallidos = problema arquitectónico. Cuestionar patrón. |

## Quick reference

| Fase | Actividades | Criterio de éxito |
|---|---|---|
| **1. Root cause** | Leer errors, reproducir, revisar cambios, recolectar evidencia | Entender QUÉ y POR QUÉ |
| **2. Pattern** | Encontrar ejemplos OK, comparar | Identificar diferencias |
| **3. Hypothesis** | Formular teoría, test mínimo | Confirmada o nueva hipótesis |
| **4. Implementation** | Test fallante, fix, verificar | Bug resuelto, tests pasan |

## Cuando el proceso revela "no hay root cause"

Si la investigación sistemática revela que el issue es realmente ambiental, dependiente de timing, o externo:

1. Has completado el proceso
2. Documentar qué investigaste
3. Implementar manejo apropiado (retry, timeout, mensaje de error)
4. Agregar logging/monitoring para investigación futura

**Pero:** 95% de los "no hay root cause" son investigación incompleta.

## Patrones específicos LandingChat

### Bug de RLS multi-tenant

Fase 1.4: instrumentar `get_my_org_id()` y verificar JWT.

```sql
-- En el SQL editor de Supabase, suplantando al usuario:
SELECT
  current_setting('request.jwt.claims', true)::jsonb AS jwt_claims,
  get_my_org_id() AS computed_org_id;
```

### Bug de webhook (Wompi/Mercado Pago/Evolution)

Fase 1.4: loggear cada capa (request → firma → parse → DB lookup → update).

```ts
console.log('[webhook]', {
  step: 'signature_validation',
  match: computed === received,
  computed_first_8: computed.slice(0, 8),
  received_first_8: received.slice(0, 8),
})
```

### Bug de FTS / search

Fase 2.1: comparar con `search_products` que SÍ funciona vs el query que devuelve 0 rows.

```sql
SELECT
  id, name,
  similarity(f_unaccent(lower(name)), f_unaccent(lower('serim'))) AS sim,
  f_unaccent(lower(name)) AS normalized
FROM products
WHERE organization_id = '7781cb03-...'
ORDER BY sim DESC
LIMIT 10;
```

### Bug de Turbopack / dev server

Fase 1.3: revisar `next.config.ts`, `tsconfig.json`, `package.json` cambios. Limpiar cache: `rm -rf .next && npm run dev`.

## Técnicas de soporte

- **Tracing backward por call stack**: ¿de dónde nació el valor malo?
- **Defense in depth**: tras encontrar root cause, agregar validación en múltiples capas (defensa en profundidad).
- **Condition-based waiting**: reemplazar timeouts arbitrarios con polling de condición.

## Skills relacionadas

- `verification-before-commit.md` — verificar el fix antes de cantar victoria
- `brainstorm-slice.md` — si el bug es tan grande que requiere re-diseño

## Referencias

- Patrón origen: `obra/superpowers/skills/systematic-debugging`
- `AGENTS.md` § Reglas estables
