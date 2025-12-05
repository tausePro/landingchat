# Guía de Restauración Completa

## Estado Actual ✅

### Base de Datos
- ✅ 29 tablas recreadas
- ✅ 7 usuarios con organizaciones restaurados
- ✅ Políticas RLS públicas configuradas
- ✅ Storefront público funcionando (`localhost:3000?store=qp`)

### Usuarios Restaurados
- `hola@tause.co` - Superadmin
- `grupoqualitypet@gmail.com` - Quality Pets (slug: `qp`)
- 5 usuarios adicionales con sus organizaciones

## Columnas de Products Restauradas

### Script Anterior (`fix-missing-product-columns.sql`)
Restauró 8 columnas básicas:
1. `slug` - URL-friendly identifier
2. `sale_price` - Precio de oferta
3. `badge_id` - Badge asignado
4. `is_subscription` - Flag de suscripción
5. `subscription_config` - Config de suscripción (JSONB)
6. `is_configurable` - Flag de producto configurable
7. `configurable_options` - Opciones configurables (JSONB)
8. `preview_template` - Template de preview

### Script Nuevo (`restore-all-product-columns.sql`)
Agrega 10 columnas adicionales que el código espera:

**Opciones de Producto:**
9. `options` (JSONB) - Opciones como talla, color, etc.

**Envío Gratis:**
10. `free_shipping_enabled` (BOOLEAN)
11. `free_shipping_min_amount` (DECIMAL)
12. `free_shipping_conditions` (TEXT)

**SEO:**
13. `meta_title` (TEXT, max 70 chars)
14. `meta_description` (TEXT, max 160 chars)
15. `keywords` (TEXT[])

**Marketing:**
16. `tags` (TEXT[])
17. `is_featured` (BOOLEAN)
18. `max_quantity_per_customer` (INTEGER)

## Total de Columnas en Products

Después de ejecutar `restore-all-product-columns.sql`:
- **Columnas base:** 10 (id, organization_id, name, description, price, image_url, stock, sku, created_at, is_active)
- **Columnas arrays:** 4 (categories, images, variants, options)
- **Columnas avanzadas:** 18 (las listadas arriba)
- **TOTAL:** ~32 columnas

## Pasos para Completar la Restauración

### 1. Ejecutar Script de Columnas Faltantes
```sql
-- Copiar y pegar en Supabase SQL Editor:
scripts/restore-all-product-columns.sql
```

Este script:
- ✅ Agrega todas las columnas faltantes
- ✅ Crea índices para performance
- ✅ Agrega comentarios explicativos
- ✅ Verifica el resultado

### 2. Verificar Resultado
El script mostrará:
- Lista completa de columnas con sus tipos
- Total de columnas (debe ser ~32)

### 3. Crear Productos de Prueba
Una vez restauradas las columnas, puedes:
- Ir a `localhost:3000/dashboard/products`
- Crear productos para Quality Pets
- Probar todas las funcionalidades:
  - Productos simples
  - Productos con suscripción
  - Productos configurables
  - Productos con envío gratis
  - Productos destacados

## Funcionalidades Disponibles

### Productos Simples
- Nombre, descripción, precio
- Imágenes múltiples
- Stock, SKU
- Categorías

### Productos con Descuento
- `sale_price` - Precio de oferta
- Se muestra tachando el precio regular

### Productos con Suscripción
- `is_subscription: true`
- `subscription_config`:
  ```json
  {
    "enabled": true,
    "price": 29.99,
    "interval": "month",
    "interval_count": 1,
    "trial_days": 7
  }
  ```

### Productos Configurables
- `is_configurable: true`
- `configurable_options`:
  ```json
  [
    {
      "name": "Color",
      "type": "select",
      "required": true,
      "choices": ["Rojo", "Azul", "Verde"]
    },
    {
      "name": "Texto personalizado",
      "type": "text",
      "required": false,
      "max_length": 50
    }
  ]
  ```

### Productos con Envío Gratis
- `free_shipping_enabled: true`
- `free_shipping_min_amount: 50000` (opcional)
- `free_shipping_conditions: "Solo Bogotá"` (opcional)

### Productos Destacados
- `is_featured: true`
- Aparecen primero en el storefront

### SEO Optimizado
- `meta_title` - Título para Google (max 70 chars)
- `meta_description` - Descripción para Google (max 160 chars)
- `keywords` - Array de palabras clave

### Marketing
- `tags` - Para organización interna
- `badge_id` - Badge visual (Nuevo, Oferta, etc)
- `max_quantity_per_customer` - Límite de compra

## Próximos Pasos para Demo del Martes

1. ✅ Ejecutar `restore-all-product-columns.sql`
2. ✅ Verificar que todas las columnas están
3. 📝 Crear 5-10 productos para Quality Pets
4. 📝 Configurar el storefront (logo, colores, template)
5. 📝 Probar el chat con el agente AI
6. 📝 Hacer una compra de prueba completa

## Archivos Importantes

- `scripts/restore-all-product-columns.sql` - Script a ejecutar
- `scripts/execute-all-migrations.sql` - Ya ejecutado (restauró estructura base)
- `scripts/fix-public-rls-policies.sql` - Ya ejecutado (acceso público)
- `src/types/product.ts` - Define todas las columnas esperadas
- `src/app/dashboard/products/actions.ts` - CRUD de productos

## Notas Importantes

⚠️ **NO ejecutar** `migrations/20241124_schema.sql` nunca más - contiene DROP CASCADE
✅ **Siempre usar** scripts en `scripts/` que usan `IF NOT EXISTS`
✅ **Backup manual** antes de cambios grandes (exportar datos a CSV)
