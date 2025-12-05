# Fix: Actualizar URL del Webhook en Evolution API

## Problema Identificado

Evolution API está enviando webhooks a:
```
https://landingchat.co/api/webhooks/whatsapp
```

Pero el servidor redirige a:
```
https://www.landingchat.co/api/webhooks/whatsapp
```

Los webhooks POST no siguen redirects, por lo que se pierden.

## Solución

### Opción 1: Actualizar manualmente en Evolution API

1. Ve a: https://wa.tause.pro
2. Busca la instancia: `org_6bd69f07-3ff0-4905-95b2-1971ebc241e8`
3. Ve a la configuración de Webhook
4. Cambia la URL de:
   ```
   https://landingchat.co/api/webhooks/whatsapp
   ```
   A:
   ```
   https://www.landingchat.co/api/webhooks/whatsapp
   ```
5. Guarda los cambios

### Opción 2: Reconectar WhatsApp

1. Desconecta el WhatsApp actual desde el dashboard
2. Vuelve a conectar
3. El código actualizado ahora usará automáticamente `www.landingchat.co`

### Opción 3: Actualizar via API de Evolution

```bash
# Obtener la configuración actual
curl -X GET "https://wa.tause.pro/instance/fetchInstances?instanceName=org_6bd69f07-3ff0-4905-95b2-1971ebc241e8" \
  -H "apikey: TU_API_KEY"

# Actualizar webhook (requiere recrear la instancia)
# Nota: Esto desconectará WhatsApp temporalmente
```

## Verificación

Después de actualizar, verifica que los webhooks lleguen:

```bash
# Probar webhook directamente
curl -X POST https://www.landingchat.co/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "event": "CONNECTION_UPDATE",
    "instance": "org_6bd69f07-3ff0-4905-95b2-1971ebc241e8",
    "data": {
      "state": "open"
    }
  }'
```

Debería retornar:
```json
{"received":true,"status":"success"}
```

Luego verifica en la base de datos:
```sql
SELECT * FROM webhook_logs 
WHERE instance_name = 'org_6bd69f07-3ff0-4905-95b2-1971ebc241e8'
ORDER BY created_at DESC 
LIMIT 5;
```

## Prevención Futura

El código ya fue actualizado para usar automáticamente `www.landingchat.co` cuando sea necesario.

Todas las nuevas conexiones usarán la URL correcta.
