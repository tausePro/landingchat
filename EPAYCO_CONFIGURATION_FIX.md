# Corrección de Configuración ePayco

## Problema Identificado
El error "P_ENCRYPTION_KEY no está configurada" se debía a que la implementación de ePayco no estaba manejando correctamente todos los campos requeridos por la API de ePayco.

## Cambios Realizados

### 1. Actualización del Formulario de Configuración
- ✅ Agregado campo `P_ENCRYPTION_KEY` al formulario
- ✅ Mejoradas las instrucciones para usuarios de ePayco
- ✅ Agregados placeholders y validaciones apropiadas
- ✅ Manejo correcto de campos existentes vs nuevos

### 2. Actualización de Tipos TypeScript
- ✅ Agregado `encryption_key_encrypted` al schema de configuración
- ✅ Actualizada validación para requerir ambos campos para ePayco:
  - `P_CUST_ID_CLIENTE` (integrity_secret)
  - `P_ENCRYPTION_KEY` (encryption_key)

### 3. Migración de Base de Datos
- ✅ Creada migración `20241213_add_encryption_key_to_payment_configs.sql`
- ✅ Agregada columna `encryption_key_encrypted` a la tabla `payment_gateway_configs`

### 4. Actualización de Server Actions
- ✅ Modificado `savePaymentConfig` para manejar `encryption_key`
- ✅ Actualizado `testConnection` para pasar la llave de encriptación
- ✅ Mejorado manejo de credenciales encriptadas

### 5. Actualización del Gateway ePayco
- ✅ Agregada propiedad `encryptionKey` a la clase `EpaycoGateway`
- ✅ Corregida validación de webhooks para usar `P_ENCRYPTION_KEY` en lugar de `P_KEY`
- ✅ Actualizada interfaz `GatewayConfig` para incluir `encryptionKey`

### 6. Corrección del Webhook Handler
- ✅ Actualizado webhook de ePayco para usar las credenciales correctas:
  - `P_CUST_ID_CLIENTE` (de integrity_secret_encrypted)
  - `P_ENCRYPTION_KEY` (de encryption_key_encrypted)
- ✅ Mejorado logging para debugging de firmas
- ✅ Corregida fórmula de validación de firma según documentación de ePayco

### 7. Factory de Pagos
- ✅ Actualizado `createPaymentGateway` para manejar `encryptionKey`
- ✅ Mejorado desencriptado automático de credenciales

## Campos Requeridos para ePayco

Ahora el sistema requiere correctamente estos 4 campos para ePayco:

1. **PUBLIC_KEY** - Llave pública de ePayco
2. **P_KEY** - Llave privada de ePayco  
3. **P_CUST_ID_CLIENTE** - ID de cliente único
4. **P_ENCRYPTION_KEY** - Llave de encriptación para webhooks

## Validación de Webhooks

La validación de webhooks ahora usa la fórmula correcta de ePayco:
```
SHA256(P_CUST_ID_CLIENTE + P_ENCRYPTION_KEY + x_ref_payco + x_transaction_id + x_amount + x_currency_code)
```

## Testing

- ✅ Creado script de prueba `scripts/test-epayco-config.js`
- ✅ Verificada lógica de generación y validación de firmas
- ✅ Confirmado funcionamiento correcto

## Próximos Pasos

1. Los usuarios pueden ahora configurar ePayco completamente desde el dashboard
2. Los webhooks de ePayco funcionarán correctamente con la validación de firma
3. El sistema puede procesar pagos de ePayco sin errores de configuración

## Instrucciones para Usuarios

Para configurar ePayco, los usuarios necesitan:

1. Ir a su panel de ePayco → Configuración → Llaves secretas
2. Copiar los 4 valores requeridos:
   - PUBLIC_KEY
   - P_KEY  
   - P_CUST_ID_CLIENTE
   - P_ENCRYPTION_KEY
3. Pegarlos en el formulario de configuración de pagos
4. Probar la conexión antes de activar

El error "P_ENCRYPTION_KEY no está configurada" ya no debería aparecer.