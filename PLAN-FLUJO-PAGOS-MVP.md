# Plan: Flujo de Pagos End-to-End MVP

## 📊 Estado Actual

### ✅ Lo que YA tenemos:
1. **Carrito de compras** (Zustand) - Funcional
2. **Cart Drawer** - UI completa
3. **Checkout Modal** - UI básica con 3 pasos
4. **Action `createOrder`** - Crea orden en DB
5. **Webhooks ePayco/Wompi** - Reciben notificaciones
6. **Gateway configs** - Almacenados en DB

### ❌ Lo que FALTA:
1. **Integración real con Wompi/ePayco** - No se genera link de pago
2. **Redirección a pasarela** - No se envía al usuario a pagar
3. **Confirmación de pago** - Webhook no actualiza orden correctamente
4. **Página de confirmación** - No existe `/order/[id]/success`
5. **Notificaciones** - No se envían al completar pago
6. **Manejo de errores** - No hay página de error de pago

---

## 🎯 Objetivo MVP

**Flujo completo funcional:**
```
Cliente agrega productos al carrito
    ↓
Hace checkout (ingresa datos)
    ↓
Selecciona método de pago (Wompi/ePayco)
    ↓
Se crea orden en DB (status: pending)
    ↓
Se genera link de pago con gateway
    ↓
Cliente es redirigido a pasarela
    ↓
Cliente paga
    ↓
Webhook recibe confirmación
    ↓
Orden se actualiza (status: confirmed)
    ↓
Cliente es redirigido a página de éxito
    ↓
Notificación enviada al propietario (WhatsApp)
```

---

## 📋 Tareas Secuenciales

### FASE 1: Integración con Gateways (DÍA 1-2)

#### 1.1 Crear servicio de inicialización de pago
**Archivo:** `src/lib/payments/payment-service.ts`
```typescript
// Función que:
// - Recibe orden
// - Obtiene config del gateway de la org
// - Genera link de pago con Wompi o ePayco
// - Retorna URL de redirección
```

#### 1.2 Actualizar `createOrder` action
**Archivo:** `src/app/chat/actions.ts`
```typescript
// Después de crear orden:
// 1. Si paymentMethod !== 'manual'
// 2. Llamar payment-service para generar link
// 3. Retornar { success, order, paymentUrl }
```

#### 1.3 Actualizar CheckoutModal
**Archivo:** `src/app/chat/components/checkout-modal.tsx`
```typescript
// Al confirmar orden:
// 1. Si hay paymentUrl → window.location.href = paymentUrl
// 2. Si es manual → mostrar success local
```

#### 1.4 Crear página de confirmación
**Archivo:** `src/app/store/[slug]/order/[orderId]/page.tsx`
```typescript
// Página que muestra:
// - Detalles de la orden
// - Estado del pago
// - Información de envío
// - Botón para volver a la tienda
```

---

### FASE 2: Webhooks y Confirmación (DÍA 2-3)

#### 2.1 Mejorar webhook de ePayco
**Archivo:** `src/app/api/webhooks/payments/epayco/route.ts`
```typescript
// Cuando pago es aprobado:
// 1. Actualizar orden a "confirmed"
// 2. Crear transacción en store_transactions
// 3. Enviar notificación al propietario
// 4. Enviar email/WhatsApp al cliente (opcional)
```

#### 2.2 Mejorar webhook de Wompi
**Archivo:** `src/app/api/webhooks/payments/wompi/route.ts`
```typescript
// Mismo flujo que ePayco
```

#### 2.3 Agregar tabla de transacciones (si no existe)
**Verificar:** `migrations/` o crear nueva migración
```sql
-- Tabla store_transactions debe tener:
-- - order_id (FK a orders)
-- - provider (wompi/epayco)
-- - status
-- - amount
-- - provider_transaction_id
```

---

### FASE 3: Páginas de Resultado (DÍA 3)

#### 3.1 Página de éxito
**Archivo:** `src/app/store/[slug]/order/[orderId]/success/page.tsx`
```typescript
// Muestra:
// - ✅ Pago exitoso
// - Número de orden
// - Resumen de compra
// - Información de envío
// - Botón volver a tienda
```

#### 3.2 Página de error
**Archivo:** `src/app/store/[slug]/order/[orderId]/error/page.tsx`
```typescript
// Muestra:
// - ❌ Pago fallido
// - Razón del error
// - Botón reintentar
// - Botón volver a tienda
```

#### 3.3 Página de pendiente
**Archivo:** `src/app/store/[slug]/order/[orderId]/pending/page.tsx`
```typescript
// Muestra:
// - ⏳ Pago pendiente
// - Instrucciones (ej: para PSE)
// - Botón verificar estado
```

---

### FASE 4: Notificaciones (DÍA 3-4)

#### 4.1 Notificación al propietario
**Ya existe:** `src/lib/notifications/whatsapp.ts`
```typescript
// Llamar sendSaleNotification() desde webhook
// cuando pago es aprobado
```

#### 4.2 Notificación al cliente (opcional para MVP)
```typescript
// Enviar email con:
// - Confirmación de orden
// - Número de guía
// - Link para rastrear
```

---

### FASE 5: Testing E2E (DÍA 4-5)

#### 5.1 Test manual completo
```
1. Crear producto en dashboard
2. Ir a storefront
3. Agregar al carrito
4. Hacer checkout
5. Pagar con Wompi (modo test)
6. Verificar webhook recibido
7. Verificar orden actualizada
8. Verificar notificación enviada
9. Ver página de confirmación
```

#### 5.2 Test con ePayco
```
Mismo flujo pero con ePayco
```

#### 5.3 Test de errores
```
1. Pago rechazado
2. Pago cancelado
3. Timeout
4. Webhook fallido
```

---

## 🔧 Detalles Técnicos

### Wompi Integration
```typescript
// POST a Wompi API para crear transacción
// https://production.wompi.co/v1/transactions

{
  "acceptance_token": "...",
  "amount_in_cents": 50000,
  "currency": "COP",
  "customer_email": "cliente@ejemplo.com",
  "reference": "ORDER_123",
  "redirect_url": "https://mitienda.com/order/123/success"
}

// Response incluye:
{
  "data": {
    "id": "transaction_id",
    "payment_link_url": "https://checkout.wompi.co/l/..."
  }
}
```

### ePayco Integration
```typescript
// Similar a Wompi pero con diferentes campos
// Documentación: https://docs.epayco.co
```

---

## 🚨 Consideraciones Importantes

1. **Seguridad:**
   - Validar firma de webhooks
   - No confiar en datos del cliente
   - Usar service role para webhooks

2. **Idempotencia:**
   - Webhooks pueden llegar múltiples veces
   - Verificar si orden ya fue procesada
   - Usar transaction_id como unique

3. **Manejo de Errores:**
   - Loggear todos los errores
   - Guardar en webhook_logs
   - Notificar al admin si falla

4. **Testing:**
   - Usar modo sandbox/test
   - No usar tarjetas reales
   - Verificar todos los estados

---

## 📊 Prioridad de Implementación

**CRÍTICO (Día 1-2):**
- ✅ Integración con Wompi (más usado en Colombia)
- ✅ Webhook de confirmación
- ✅ Página de éxito

**IMPORTANTE (Día 3):**
- ✅ Integración con ePayco
- ✅ Notificación al propietario
- ✅ Manejo de errores

**NICE TO HAVE (Día 4-5):**
- ⭐ Notificación al cliente
- ⭐ Página de tracking
- ⭐ Tests automatizados

---

## ✅ Checklist de Completitud

- [ ] Cliente puede agregar productos al carrito
- [ ] Cliente puede hacer checkout
- [ ] Se genera link de pago con Wompi
- [ ] Cliente es redirigido a Wompi
- [ ] Cliente puede pagar
- [ ] Webhook recibe confirmación
- [ ] Orden se actualiza a "confirmed"
- [ ] Cliente ve página de éxito
- [ ] Propietario recibe notificación WhatsApp
- [ ] Se puede repetir con ePayco
- [ ] Manejo de errores funciona
- [ ] Test end-to-end completo

---

**Siguiente paso:** Empezar con Fase 1.1 - Crear payment-service.ts

¿Aprobado para empezar a programar?
