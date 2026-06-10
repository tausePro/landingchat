---
trigger: always_on
description: Antes de declarar trabajo completo o proponer commits, ejecutar comandos de verificación frescos y confirmar el output. Evidence over claims.
---

# Verification Before Commit

Adaptado de `obra/superpowers/skills/verification-before-completion`. Aplica SIEMPRE en LandingChat antes de proponer un commit, declarar un trabajo completo, o anunciar que un fix funciona.

## Principio núcleo

**Evidencia antes que afirmaciones, siempre.**

Reclamar que algo está hecho/arreglado/pasando sin verificación fresca es **deshonestidad disfrazada de eficiencia**.

Violar la letra de esta regla es violar su espíritu.

## La ley de hierro

```
NINGUNA AFIRMACIÓN DE COMPLETITUD SIN EVIDENCIA DE VERIFICACIÓN FRESCA
```

Si no he corrido el comando de verificación **en este turno**, no puedo afirmar que pasa.

## La función de gate

Antes de afirmar cualquier estado o expresar satisfacción:

1. **IDENTIFICAR**: ¿Qué comando prueba esta afirmación?
2. **EJECUTAR**: Correr el comando completo (fresco, no recordar de antes)
3. **LEER**: Output completo, exit code, contar fallos
4. **VERIFICAR**: ¿El output confirma la afirmación?
   - Si NO: declarar el estado real con la evidencia
   - Si SÍ: declarar la afirmación CON la evidencia
5. **SOLO ENTONCES**: hacer la afirmación

Saltar cualquier paso es mentir, no verificar.

## Tabla de verificación obligatoria

| Afirmación | Comando requerido | NO suficiente |
|---|---|---|
| "Tests pasan" | `npm run test` (o focal): 0 failures | Run anterior, "debería pasar" |
| "TypeScript clean" | `npx tsc --noEmit`: exit 0 | "El IDE no marca rojo" |
| "Lint clean" | `npm run lint`: 0 errors | "Solo cambié strings" |
| "Build pasa" | `npm run build`: exit 0 | Lint pasando ≠ build pasando |
| "Bug arreglado" | Test que reproducía el bug ahora pasa | "Cambié el código, asumo arreglado" |
| "Test de regresión funciona" | RED-GREEN ciclo verificado: revertir fix → test FALLA → restaurar fix → test pasa | "Escribí el test" sin red-green |
| "Migración aplicada" | Confirmación del usuario o query directa a DB | "Le di el SQL" |
| "Endpoint funciona" | curl o request real con response code esperado | "El código se ve bien" |
| "Smoke prod OK" | Confirmación del usuario tras hacer la acción en prod | Vercel reporta deploy success |

## Red flags — STOP antes de continuar

Si me encuentro escribiendo:

- "Debería funcionar ahora", "probablemente", "parece"
- "Listo", "perfecto", "✅" antes de haber verificado
- A punto de proponer commit/push sin haber corrido tests
- "Confío en que esto funcionó porque la lógica se ve bien"
- "Las verificaciones del slice anterior aún cuentan"
- "Por esta vez salto la verificación"
- Cansado y queriendo cerrar el ticket

Cualquiera de estas = **STOP. Correr verificación. Volver con evidencia.**

## Anti-rationalizations

| Excusa | Realidad |
|---|---|
| "Debería funcionar" | CORRER la verificación |
| "Estoy seguro" | Confianza ≠ evidencia |
| "Solo por esta vez" | No hay excepciones |
| "Lint pasó" | Lint ≠ compilador. tsc ≠ tests. tests ≠ smoke prod |
| "El usuario dice que funciona" | Verificar tú también si tienes acceso al comando |
| "Estoy cansado" | El cansancio no es excusa |
| "Verificación parcial es suficiente" | Parcial no prueba nada |
| "El test pasó una vez" | Para regresión: ciclo red-green completo |

## Patrones específicos LandingChat

### Slice de UI / componente

```
✅ npx tsc --noEmit (clean) + npx vitest run <focal_tests> (X/X passing) → "Verificación local OK"
❌ "El componente compila" sin haber corrido nada
```

### Slice de RPC / migración SQL

```
✅ Migración aplicada en Supabase (confirmado por usuario) + endpoint que la consume devuelve 200 con curl → "RPC en prod"
❌ "El SQL se ve correcto" sin aplicarlo
```

### Slice de webhook / pago

```
✅ Test de firma con payload real → curl con header firmado → 200 + log esperado → "Webhook procesando"
❌ "La validación de firma se ve bien"
```

### Slice multi-tenant

```
✅ Probado en al menos 2 tenants reales (tez + quality-pets) → ambos OK → "Aislamiento OK"
❌ "Lo probé en tez, asumo que en otros funciona"
```

### Antes de merge develop → main + tag

```
✅ Tests focales del slice + tsc clean + smoke prod en al menos 1 tenant + torre de control actualizada → "Listo para tag"
❌ "Tests passing local" sin smoke prod
```

## Cuándo aplica

**SIEMPRE antes de:**

- Cualquier variación de "está listo / arreglado / funcionando / pasa"
- Cualquier expresión de satisfacción sobre el estado del trabajo
- Cualquier afirmación positiva sobre code state
- Proponer commit, push, merge, tag
- Pasar al siguiente slice
- Decirle al usuario "procede"

Aplica a:
- Frases exactas
- Paráfrasis y sinónimos
- Implicaciones de éxito
- CUALQUIER comunicación que sugiera completitud o correctitud

## El bottom line

**No hay atajos para la verificación.**

Correr el comando. Leer el output. **Después** afirmar el resultado.

Esto no es negociable.

## Referencias

- Patrón origen: `obra/superpowers/skills/verification-before-completion`
- `AGENTS.md` § Reglas estables NO NEGOCIABLES
