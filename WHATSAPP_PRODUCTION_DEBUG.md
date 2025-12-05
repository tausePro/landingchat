# Diagnóstico WhatsApp en Producción (landingchat.co)

## Cambios Implementados

### 1. Sistema de Logging Persistente
- **Migración**: `migrations/20241205_webhook_logs.sql`
- **Tabla**: `webhook_logs` - Registra todos los webhooks recibidos
- **Retención**: 7 días automáticamente

### 2. Endpoint de Sincronización
- **URL**: `POST /api/admin/whatsapp/sync`
- **Función**: Compara estado en Evolution API vs DB y sincroniza
- **Uso**:
```bash
curl -X POST https://landingchat.co/api/admin/whatsapp/sync \
  -H "Content-Type: application/json" \
  -d '{"instanceName": "org_6bd69f07-3ff0-4905-95b2-1971ebc241e8"}'
```

### 3. Panel de Logs de Webhooks
- **URL**: `/admin/webhook-logs`
- **Función**: Ver todos los webhooks recibidos en tiempo real
- **Acceso**: Solo superadmins

### 4. Mejoras en Webhook Handler
- Validación de firma opcional (solo si Evolution la envía)
- Logging completo de payloads y headers
- Registro de resultados de procesamiento

## Pasos para Diagnosticar

### Paso 1: Ejecutar Migración
```sql
-- En Supabase SQL Editor
-- Copiar y ejecutar: migrations/20241205_webhook_logs.sql
```

### Paso 2: Verificar Configuración
```sql
-- Ver configuración de Evolution API
SELECT 
    key,
    value->>'url' as evolution_url,
    (value->>'apiKey' IS NOT NULL) as has_api_key,
    (value->>'webhookSecret' IS NOT NULL) as has_webhook_secret
FROM system_settings
WHERE key = 'evolution_api_config';
```

### Paso 3: Verificar Estado Actual
```sql
-- Ver instancia en DB
SELECT 
    id,
    instance_name,
    status,
    phone_number_display,
    connected_at,
    updated_at
FROM whatsapp_instances
WHERE instance_name = 'org_6bd69f07-3ff0-4905-95b2-1971ebc241e8';
```

### Paso 4: Sincronizar con Evolution API
```bash
# Ejecutar endpoint de sincronización
curl -X POST https://landingchat.co/api/admin/whatsapp/sync \
  -H "Content-Type: application/json" \
  -d '{"instanceName": "org_6bd69f07-3ff0-4905-95b2-1971ebc241e8"}'
```

Esto te dirá:
- Estado en Evolution API
- Estado en nuestra DB
- Si están sincronizados
- Si no, actualiza automáticamente

### Paso 5: Ver Logs de Webhooks
1. Ir a: https://landingchat.co/admin/webhook-logs
2. Filtrar por errores
3. Ver payloads completos
4. Identificar si los webhooks están llegando

### Paso 6: Verificar en Evolution API
1. Ir a: https://wa.tause.pro
2. Buscar instancia: `org_6bd69f07-3ff0-4905-95b2-1971ebc241e8`
3. Verificar:
   - Estado de conexión (debe ser "open")
   - Webhook URL (debe ser `https://landingchat.co/api/webhooks/whatsapp`)
   - Eventos habilitados (CONNECTION_UPDATE, MESSAGES_UPSERT, QRCODE_UPDATED)

## Posibles Problemas y Soluciones

### Problema 1: Webhooks no llegan
**Síntoma**: No hay registros en `webhook_logs` para la instancia

**Causas posibles**:
- URL del webhook incorrecta en Evolution
- Evolution no puede alcanzar landingchat.co
- Firewall bloqueando requests

**Solución**:
1. Verificar URL en Evolution API
2. Usar endpoint de sincronización manual
3. Reconfigurar webhook en Evolution

### Problema 2: Webhooks llegan pero fallan
**Síntoma**: Hay registros en `webhook_logs` con `processing_result = 'error'`

**Causas posibles**:
- Formato de payload incorrecto
- Validación de firma fallando
- Error en procesamiento

**Solución**:
1. Ver `error_message` en los logs
2. Ver payload completo
3. Ajustar código según formato real

### Problema 3: Estado desincronizado
**Síntoma**: Evolution dice "open" pero DB dice "connecting"

**Causas posibles**:
- Webhook de CONNECTION_UPDATE no llegó
- Webhook llegó pero falló al procesar
- Instancia se conectó antes de configurar webhook

**Solución**:
1. Usar endpoint de sincronización
2. Verificar logs de webhooks
3. Reconectar instancia si es necesario

## Comandos Útiles

### Ver últimos webhooks recibidos
```sql
SELECT 
    event_type,
    instance_name,
    processing_result,
    error_message,
    created_at
FROM webhook_logs
WHERE webhook_type = 'whatsapp'
ORDER BY created_at DESC
LIMIT 10;
```

### Ver webhooks con error
```sql
SELECT 
    event_type,
    instance_name,
    error_message,
    payload,
    created_at
FROM webhook_logs
WHERE webhook_type = 'whatsapp'
AND processing_result = 'error'
ORDER BY created_at DESC;
```

### Limpiar logs antiguos
```sql
SELECT cleanup_old_webhook_logs();
```

## Próximos Pasos

1. **Ejecutar migración** para crear tabla de logs
2. **Desplegar cambios** a producción
3. **Reconectar WhatsApp** para generar eventos
4. **Ver logs** en `/admin/webhook-logs`
5. **Usar sincronización** si es necesario

## Notas Importantes

- Los logs se guardan automáticamente en cada webhook recibido
- La validación de firma es opcional (solo si Evolution la envía)
- El endpoint de sincronización puede usarse en cualquier momento
- Los logs se limpian automáticamente después de 7 días
