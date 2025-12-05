# Guía de Debugging - Conexión WhatsApp

## Problema Actual

La instancia de WhatsApp se crea y conecta en Evolution API, pero el dashboard de LandingChat no refleja el estado "conectado".

## Causas Posibles

1. **Webhook no está llegando** - Evolution API no puede alcanzar localhost
2. **Evento mal formateado** - Evolution API envía eventos en formato diferente
3. **Instancia no guardada en DB** - Error al crear registro en base de datos

## Soluciones Implementadas

### 1. Mejorado Mapeo de Eventos

**Archivo:** `src/app/api/webhooks/whatsapp/route.ts`

- Ahora soporta eventos en MAYÚSCULAS (`CONNECTION_UPDATE`)
- Soporta eventos con guiones bajos y guiones
- Normaliza automáticamente el formato

### 2. Extracción de Número de Teléfono

**Archivo:** `src/app/api/webhooks/whatsapp/route.ts`

- Extrae el número de teléfono cuando se conecta
- Intenta múltiples ubicaciones en el payload
- Guarda número completo y últimos 4 dígitos

### 3. Endpoint de Prueba

**Archivo:** `src/app/api/webhooks/whatsapp/test/route.ts`

- Permite simular webhooks manualmente
- Útil cuando Evolution API no puede alcanzar localhost

## Pasos para Debuggear

### Paso 1: Verificar Estado en Base de Datos

Ejecuta en Supabase SQL Editor:

```sql
-- Ver instancias actuales
SELECT 
    id,
    organization_id,
    instance_name,
    instance_type,
    status,
    phone_number_display,
    connected_at,
    created_at
FROM whatsapp_instances
WHERE instance_type = 'corporate'
ORDER BY created_at DESC
LIMIT 5;
```

### Paso 2: Verificar Logs del Servidor

En la terminal donde corre `npm run dev`, busca logs como:

```
[WhatsApp Webhook] Raw payload: ...
[WhatsApp Webhook] Connection update data: ...
[WhatsApp Webhook] Successfully updated instance ...
```

Si NO ves estos logs, el webhook no está llegando.

### Paso 3: Probar Webhook Manualmente

Si estás en localhost y Evolution API no puede alcanzarte, usa el endpoint de prueba:

```bash
curl -X POST http://localhost:3000/api/webhooks/whatsapp/test \
  -H "Content-Type: application/json" \
  -d '{
    "instanceName": "org_6bd69f07-3ff0-4905-95b2-1971ebc241e8",
    "event": "CONNECTION_UPDATE",
    "state": "open"
  }'
```

Reemplaza `instanceName` con el nombre real de tu instancia.

### Paso 4: Actualizar Estado Manualmente (Temporal)

Si necesitas forzar el estado para la demo, ejecuta en Supabase:

```sql
-- Primero, encuentra tu instancia
SELECT id, instance_name, status 
FROM whatsapp_instances 
WHERE instance_name LIKE 'org_%'
ORDER BY created_at DESC 
LIMIT 1;

-- Luego actualiza el estado (reemplaza el ID)
UPDATE whatsapp_instances
SET 
    status = 'connected',
    phone_number = '573234059180',
    phone_number_display = '9180',
    connected_at = NOW(),
    updated_at = NOW()
WHERE id = 'TU_INSTANCE_ID_AQUI';
```

### Paso 5: Verificar Configuración de Evolution API

En Evolution API, verifica que el webhook esté configurado:

1. Ve a la instancia en Evolution API
2. Verifica que el webhook URL sea correcto
3. Verifica que los eventos incluyan `CONNECTION_UPDATE`

## Solución Rápida para Demo

Si necesitas que funcione YA para la demo del martes:

### Opción A: Usar ngrok (Recomendado)

1. Instala ngrok: `brew install ngrok` (macOS)
2. Ejecuta: `ngrok http 3000`
3. Copia la URL HTTPS que te da (ej: `https://abc123.ngrok.io`)
4. Actualiza `NEXT_PUBLIC_APP_URL` en `.env.local`:
   ```
   NEXT_PUBLIC_APP_URL=https://abc123.ngrok.io
   ```
5. Reinicia el servidor: `npm run dev`
6. Desconecta y vuelve a conectar WhatsApp

Ahora Evolution API podrá alcanzar tu webhook.

### Opción B: Actualización Manual

1. Ejecuta el script de debug: `scripts/debug-whatsapp-connection.sql`
2. Identifica el ID de tu instancia
3. Ejecuta el script de fix: `scripts/fix-whatsapp-connection-status.sql`
4. Actualiza manualmente el estado a "connected"
5. Refresca el dashboard

### Opción C: Usar Endpoint de Prueba

1. Identifica el `instance_name` de tu instancia (ej: `org_6bd69f07-3ff0-4905-95b2-1971ebc241e8`)
2. Ejecuta:
   ```bash
   curl -X POST http://localhost:3000/api/webhooks/whatsapp/test \
     -H "Content-Type: application/json" \
     -d '{
       "instanceName": "org_6bd69f07-3ff0-4905-95b2-1971ebc241e8",
       "event": "CONNECTION_UPDATE",
       "state": "open"
     }'
   ```
3. Refresca el dashboard

## Verificación Final

Después de aplicar cualquier solución, verifica:

1. **Dashboard** (`/dashboard/settings/whatsapp`) - Debe mostrar "Conectado"
2. **Admin Panel** (`/admin/whatsapp`) - Debe mostrar la instancia
3. **Base de Datos** - `status` debe ser "connected"

## Logs Útiles

Para ver más detalles, revisa:

- **Logs del servidor Next.js** - Terminal donde corre `npm run dev`
- **Logs de Evolution API** - Panel de Evolution API
- **Network tab** - DevTools del navegador (pestaña Network)

## Contacto

Si el problema persiste, comparte:
1. Logs del servidor Next.js
2. Screenshot del panel de Evolution API
3. Resultado de `scripts/debug-whatsapp-connection.sql`
