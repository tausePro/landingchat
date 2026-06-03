---
trigger: glob
globs:
  - "**/*.ts"
  - "**/*.tsx"
description: Disciplina TypeScript estricta para LandingChat
---

# TypeScript Strict (al editar .ts/.tsx)

LandingChat usa TypeScript estricto. Las reglas estables están en `AGENTS.md`; esta rule las refuerza al editar TS/TSX.

## Reglas

1. **Sin `any`**. Si el archivo que tocas contiene `any`, corrige en el slice si está en el bloque/flujo que estás modificando. NO conviertas un fix en un refactor transversal.
2. **Validación**: usa Zod para inputs externos (forms, route handlers, webhooks). No confíes en `unknown` sin validar.
3. **Server Actions**: deben devolver `ActionResult<T>`:
   ```ts
   export async function myAction(input: MyInput): Promise<ActionResult<MyOutput>> {
     try {
       const validated = MySchema.parse(input)
       // ...
       return { success: true, data: result }
     } catch (error) {
       return { success: false, error: 'Mensaje amigable' }
     }
   }
   ```
4. **Tipos compartidos**: viven en `src/types/`. NO redefinir un tipo si ya existe.
5. **`unknown` antes que `any`**: si necesitas un escape hatch, prefiere `unknown` y hace narrowing.
6. **Inferencia**: deja que TS infiera cuando el tipo es obvio; anota explícitamente solo en superficies públicas (exports, return types de funciones complejas).

## Antes de mergear

- `npm run lint` debe pasar
- `npx tsc --noEmit` no debe agregar nuevos errores (baseline preserved)
- Tests: `npm run test`

## Anti-patterns

- ❌ `as any` para silenciar errores
- ❌ `// @ts-ignore` sin comentario justificando + ticket
- ❌ Tipos `Record<string, any>` cuando se conoce la forma
- ❌ Funciones sin return type cuando son exportadas y la inferencia depende del cuerpo entero

## Referencias

- `AGENTS.md` § TypeScript
- `docs/AGENTS_GUIDE.md` § Convenciones de Código
