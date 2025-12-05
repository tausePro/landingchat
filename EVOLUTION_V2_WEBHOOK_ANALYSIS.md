# Análisis: Evolution API v2.3.6 - Formato de Webhooks

## Problema Actual
La instancia se conecta en Evolution API pero el dashboard no refleja el estado "conectado".

## Investigación Evolution API v2.3.6

### Formato de Webhooks en v2.x

Según la documentación de Evolution API v2.x, los webhooks se envían con esta estructura:

```json
{
  "event": "CONNECTION_UPDATE",
  "instance": "instance_name",
  "data": {
    "state": "open"
  }
}
```

O también pueden venir como:

```json
{
  "event": "connection.update",
  "instance": "instance_name", 
  "data": {
    "state": "open"
  }
}
```

### Eventos Soportados en v2.3.6

1. **CONNECTION_UPDATE** / **connection.update**
   - `state`: "open" | "close" | "connecting"
   
2. **MESSAGES_UPSERT** / **messages.upsert**
   - Mensajes entrantes
   
3. **QRCODE_UPDATED** / **qrcode.updated**
   - Actualización de QR

### Configuración de Webhook en v2.x

Al crear la instancia, el webhook se configura así:

```json
{
  "instanceName": "org_xxx",
  "token": "org_id",
  "qrcode": true,
  "integration": "WHATSAPP-BAILEYS",
  "webhook": {
    "url": "https://landingchat.co/api/webhooks/whatsapp",
    "byEvents": true,
    "base64": false,
    "events": [
      "MESSAGES_UPSERT",
      "CONNECTION_UPDATE", 
      "QRCODE_UPDATED"
    ]
  }
}
```

## Análisis del Código Actual

### ✅ Lo que está bien:

1. **Normalización de eventos**: El código ya maneja múltiples formatos
   ```typescript
   const eventLower = event.toLowerCase().replace(/_/g, "-")
   const eventMap: Record<string, string> = {
       "connection-update": "connection.update",
       "qrcode-updated": "qrcode.updated",
       "messages-upsert": "messages.upsert",
   }
   ```

2. **Extracción de estado**: Intenta múltiples ubicaciones
   ```typescript
   if (typeof data.state === "string") {
       state = data.state
   } else if (typeof data.status === "string") {
       state = data.status
   }
   ```

3. **Mapeo de estados**: Correcto
   ```typescript
   const statusMap: Record<string, string> = {
       open: "connected",
       close: "disconnected",
       closed: "disconnected",
       connecting: "connecting",
   }
   ```

### ❌ Posibles Problemas:

1. **URL del webhook en producción**
   - ¿Está configurado `NEXT_PUBLIC_APP_URL=https://landingchat.co` en producción?
   - Si no, el webhook se crea con URL incorrecta

2. **Logs no visibles**
   - En producción no vemos los console.log
   - Necesitamos verificar si los webhooks están llegando

3. **Validación de firma**
   - Si hay `webhookSecret` configurado pero Evolution no lo envía, falla

## Plan de Acción

### 1. Verificar configuración en producción
```sql
-- Ver configuración de Evolution API
SELECT 
    key,
    value->>'url' as evolution_url,
    value->>'apiKey' as has_api_key,
    value->>'webhookSecret' as has_webhook_secret
FROM system_settings
WHERE key = 'evolution_api_config';
```

### 2. Verificar instancia en DB
```sql
-- Ver estado actual de la instancia
SELECT 
    id,
    instance_name,
    status,
    phone_number_display,
    connected_at,
    created_at,
    updated_at
FROM whatsapp_instances
WHERE instance_type = 'corporate'
ORDER BY created_at DESC
LIMIT 1;
```

### 3. Verificar en Evolution API
- Ir a `wa.tause.pro`
- Buscar la instancia `org_6bd69f07-3ff0-4905-95b2-1971ebc241e8`
- Verificar:
  - Estado de conexión
  - URL del webhook configurado
  - Eventos habilitados

### 4. Probar webhook manualmente
```bash
curl -X POST https://landingchat.co/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "event": "CONNECTION_UPDATE",
    "instance": "org_6bd69f07-3ff0-4905-95b2-1971ebc241e8",
    "data": {
      "state": "open"
    }
  }'
```

## Soluciones Posibles

### Opción 1: Verificar variable de entorno
Si `NEXT_PUBLIC_APP_URL` no está configurada en producción, el webhook se crea con URL incorrecta.

### Opción 2: Deshabilitar validación de firma temporalmente
Si Evolution no envía firma pero tenemos `webhookSecret` configurado, el webhook es rechazado.

### Opción 3: Agregar logging persistente
Usar un servicio de logging (Sentry, LogRocket) para ver qué está pasando en producción.

### Opción 4: Endpoint de health check
Crear endpoint que verifique:
- Estado en Evolution API
- Estado en nuestra DB
- Sincronizar si hay diferencia
