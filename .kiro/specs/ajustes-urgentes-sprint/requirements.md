# Ajustes Urgentes Sprint - Requirements

## Introducción

Sprint de ajustes críticos para resolver problemas bloqueantes en producción y mejorar la experiencia de usuario para clientes activos como Tez y Aliviate.

## Reglas de Desarrollo

**CRÍTICO - Seguir estrictamente:**
Escribeme siempr en español
1. **Desarrollo Incremental**: Solo avanzar de 1 en 1, requiere validación del usuario antes de continuar
2. **Reutilización Obligatoria**: SIEMPRE revisar código existente antes de implementar
   - Buscar patrones similares en el codebase
   - Reutilizar componentes, hooks, utilities existentes
   - NO reinventar funcionalidades ya implementadas
3. **Consulta Obligatoria**: Si no hay claridad sobre implementación existente, PREGUNTAR antes de proceder
4. **Arquitectura Completa**: Considerar en cada tarea:
   - Rutas y estructura de archivos
   - Arquitectura y patrones existentes
   - Tests (unit + property-based cuando aplique)
   - Tipos TypeScript
   - RLS policies si involucra base de datos
   - Error handling y validaciones

## Glossario

- **Dashboard**: Panel de administración de organizaciones
- **Storefront**: Tienda pública de cada organización
- **Chat**: Interfaz de chat de ventas con IA
- **Meta Pixel**: Sistema de tracking de Facebook/Meta
- **WooCommerce**: Plugin de e-commerce de WordPress
- **Funnel**: Embudo de conversión de visitantes a compradores

## Requirements

### Requirement 1 - Eliminación de Productos ✅ COMPLETADO

**User Story:** Como administrador de tienda, quiero eliminar productos de mi catálogo, para mantener mi inventario actualizado.

#### Acceptance Criteria

1. ✅ WHEN un administrador hace clic en eliminar producto THEN el sistema SHALL remover el producto de la base de datos
2. ✅ WHEN un producto es eliminado THEN el sistema SHALL actualizar la vista de productos inmediatamente
3. ✅ WHEN se intenta eliminar un producto con órdenes asociadas THEN el sistema SHALL mostrar confirmación de impacto
4. ✅ WHEN la eliminación es exitosa THEN el sistema SHALL mostrar mensaje de confirmación
5. ✅ WHEN ocurre un error en eliminación THEN el sistema SHALL mostrar mensaje de error específico

#### Implementación Realizada

- **Archivo modificado:** `src/app/dashboard/products/actions.ts`
  - Agregada validación de autenticación y contexto organizacional
  - Verificación de propiedad del producto antes de eliminación
  - Verificación opcional de órdenes asociadas
  - Mensajes de error específicos y detallados

- **Archivo modificado:** `src/app/dashboard/products/components/delete-product-button.tsx`
  - Mejorada confirmación con mensaje más detallado
  - Agregado feedback de éxito y error específico
  - Mejorada experiencia de usuario con estados de carga

- **Test agregado:** `src/__tests__/actions/product-delete.property.test.ts`
  - Tests de autenticación, autorización y validación
  - Property-based testing con fast-check

### Requirement 2 - Importador WooCommerce y Gestión de Imágenes

**User Story:** Como administrador de tienda, quiero importar productos desde WooCommerce con sus imágenes, para migrar mi catálogo existente.

#### Acceptance Criteria

1. WHEN un administrador sube archivo de WooCommerce THEN el sistema SHALL procesar productos e imágenes correctamente
2. WHEN las imágenes son importadas THEN el sistema SHALL almacenar URLs válidas y accesibles
3. WHEN un producto tiene múltiples imágenes THEN el sistema SHALL importar todas las imágenes disponibles
4. WHEN la importación falla THEN el sistema SHALL mostrar errores específicos por producto
5. WHEN la importación es exitosa THEN el sistema SHALL mostrar resumen de productos importados

### Requirement 3 - Meta Pixel en Chat

**User Story:** Como administrador de tienda, quiero que el chat de ventas trackee eventos de Meta, para medir conversiones de mis campañas.

#### Acceptance Criteria

1. WHEN un usuario visita el chat THEN el sistema SHALL cargar Meta Pixel si está configurado
2. WHEN ocurre una interacción en chat THEN el sistema SHALL enviar eventos relevantes a Meta
3. WHEN se inicia checkout desde chat THEN el sistema SHALL trackear evento InitiateCheckout
4. WHEN se completa compra desde chat THEN el sistema SHALL trackear evento Purchase
5. WHEN Meta Pixel no está configurado THEN el sistema SHALL funcionar normalmente sin tracking

### Requirement 4 - Dashboard de Funnel de Conversión

**User Story:** Como administrador de tienda, quiero ver métricas de mi funnel de conversión, para evaluar el rendimiento de mis campañas.

#### Acceptance Criteria

1. WHEN un administrador accede al dashboard THEN el sistema SHALL mostrar métricas de visitantes únicos
2. WHEN se muestran métricas THEN el sistema SHALL incluir tasas de conversión por etapa del funnel
3. WHEN hay datos de Meta Pixel THEN el sistema SHALL mostrar eventos de Facebook integrados
4. WHEN se selecciona un rango de fechas THEN el sistema SHALL actualizar todas las métricas
5. WHEN no hay datos suficientes THEN el sistema SHALL mostrar mensaje informativo

### Requirement 5 - Mejoras Estéticas Storefront

**User Story:** Como cliente de tienda, quiero navegar fácilmente por productos con menús y filtros, para encontrar lo que busco rápidamente.

#### Acceptance Criteria

1. WHEN un cliente visita la tienda THEN el sistema SHALL mostrar menú de navegación visible
2. WHEN hay múltiples categorías THEN el sistema SHALL mostrar filtros de categoría
3. WHEN se aplica un filtro THEN el sistema SHALL actualizar productos mostrados inmediatamente
4. WHEN se busca un producto THEN el sistema SHALL mostrar resultados relevantes
5. WHEN la tienda está en móvil THEN el sistema SHALL mantener usabilidad responsive

### Requirement 6 - Integración Chat-Storefront para Agentes Proactivos

**User Story:** Como administrador de tienda, quiero que el chat se integre con la navegación del storefront, para crear experiencias proactivas basadas en comportamiento.

#### Acceptance Criteria

1. WHEN un usuario navega productos THEN el sistema SHALL compartir contexto con el chat
2. WHEN un usuario permanece tiempo en producto THEN el sistema SHALL permitir intervención proactiva del agente
3. WHEN se detecta abandono de carrito THEN el sistema SHALL habilitar mensaje proactivo
4. WHEN el chat se integra THEN el sistema SHALL mantener Meta Pixel funcionando en ambos contextos
5. WHEN la integración falla THEN el sistema SHALL mantener funcionalidad independiente de chat y storefront