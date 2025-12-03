# Guía de Contribución - LandingChat

## Flujo de Trabajo con Git

### Estructura de Ramas

- **`main`** - Producción, siempre estable. Solo se actualiza mediante merge desde `develop`.
- **`develop`** - Rama de integración donde se mergean todas las features. Debe estar siempre funcional.
- **`feature/*`** - Features nuevas (ej: `feature/whatsapp-integration`)
- **`fix/*`** - Correcciones de bugs (ej: `fix/customer-filter-bug`)
- **`hotfix/*`** - Fixes urgentes para producción que van directo a `main`

### Workflow Estándar

1. **Crear rama desde `develop`**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/nombre-descriptivo
   ```

2. **Hacer commits descriptivos**
   ```bash
   git add .
   git commit -m "feat: agregar validación de email en registro"
   ```

3. **Push y crear Pull Request**
   ```bash
   git push -u origin feature/nombre-descriptivo
   ```
   - Crear PR en GitHub hacia `develop`
   - Llenar el template del PR
   - Asignar reviewers si aplica

4. **Code Review y Merge**
   - Esperar aprobación
   - Resolver conflictos si existen
   - Mergear a `develop`

5. **Release a Producción**
   - Cuando `develop` está estable y listo para producción
   - Crear PR de `develop` → `main`
   - Mergear y deployar

### Convención de Commits

Seguimos [Conventional Commits](https://www.conventionalcommits.org/):

- `feat: descripción` - Nueva funcionalidad
- `fix: descripción` - Corrección de bug
- `refactor: descripción` - Refactorización sin cambiar funcionalidad
- `docs: descripción` - Cambios en documentación
- `style: descripción` - Cambios de formato (espacios, punto y coma, etc.)
- `test: descripción` - Agregar o modificar tests
- `chore: descripción` - Tareas de mantenimiento (deps, config, etc.)
- `perf: descripción` - Mejoras de performance
- `security: descripción` - Mejoras de seguridad

**Ejemplos:**
```bash
git commit -m "feat: agregar filtro por zona en clientes"
git commit -m "fix: corregir error de hidratación en tabs"
git commit -m "refactor: extraer lógica de slugs a utilidad"
git commit -m "docs: actualizar README con instrucciones de deploy"
```

## Desarrollo Local

### Setup Inicial

1. Clonar el repositorio
   ```bash
   git clone https://github.com/tausePro/landingchat.git
   cd landingchat
   ```

2. Instalar dependencias
   ```bash
   npm install
   ```

3. Configurar variables de entorno
   ```bash
   cp .env.example .env.local
   # Editar .env.local con tus credenciales
   ```

4. Correr el servidor de desarrollo
   ```bash
   npm run dev
   ```

### Antes de Hacer un PR

- [ ] El código compila sin errores: `npm run build`
- [ ] No hay errores de TypeScript
- [ ] No hay errores en consola del navegador
- [ ] Probaste la funcionalidad manualmente
- [ ] El código sigue las convenciones del proyecto

## Estándares de Código

### TypeScript
- Usar tipos explícitos, evitar `any`
- Definir interfaces para objetos complejos
- Usar `const` por defecto, `let` solo cuando sea necesario

### React/Next.js
- Usar Server Components por defecto
- Client Components solo cuando sea necesario (`"use client"`)
- Preferir Server Actions sobre API routes cuando sea posible

### Naming
- Componentes: `PascalCase` (ej: `CustomerList`)
- Funciones/variables: `camelCase` (ej: `getCustomers`)
- Archivos de componentes: `kebab-case.tsx` (ej: `customer-list.tsx`)
- Constantes: `UPPER_SNAKE_CASE` (ej: `MAX_RETRIES`)

## Preguntas

Si tienes dudas sobre el flujo de trabajo o necesitas ayuda, abre un issue o contacta al equipo.
