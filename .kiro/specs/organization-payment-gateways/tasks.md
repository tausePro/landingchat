# Plan de Implementación - Pasarelas de Pago para Organizaciones

- [x] 1. Configurar infraestructura de base de datos y tipos
  - [x] 1.1 Crear migración SQL para tablas payment_gateway_configs y store_transactions
    - Crear tabla `payment_gateway_configs` con campos para credenciales encriptadas
    - Crear tabla `store_transactions` para historial de pagos
    - Agregar índices y políticas RLS
    - _Requirements: 1.5, 5.1_
  - [x] 1.2 Crear tipos y schemas Zod en `src/types/payment.ts`
    - Definir PaymentGatewayConfigSchema, StoreTransactionSchema
    - Definir CreateTransactionInputSchema
    - Exportar tipos TypeScript inferidos
    - _Requirements: 5.1, 5.4_
  - [x] 1.3 Crear utilidades de encriptación en `src/lib/utils/encryption.ts`
    - Función encrypt(text, key) usando AES-256-GCM
    - Función decrypt(encrypted, key)
    - _Requirements: 1.5, 5.1_

- [x] 2. Checkpoint - Verificar migración y tipos

- [x] 3. Implementar clientes de pasarelas de pago
  - [x] 3.1 Crear interfaz base en `src/lib/payments/types.ts`
    - Definir PaymentGateway interface
    - Definir TransactionInput, TransactionResult, TokenResult
    - _Requirements: 2.2, 2.3_
  - [x] 3.2 Crear cliente Wompi en `src/lib/payments/wompi-gateway.ts`
    - Implementar createTransaction, getTransaction, tokenizeCard, getBanks
    - Manejar modo test vs producción
    - _Requirements: 2.2, 2.3, 2.4_
  - [x] 3.3 Crear cliente ePayco en `src/lib/payments/epayco-gateway.ts`
    - Implementar createTransaction, getTransaction, tokenizeCard, getBanks
    - Manejar modo test vs producción
    - _Requirements: 2.2, 2.3, 2.4_
  - [x] 3.4 Crear factory en `src/lib/payments/factory.ts`
    - Función createPaymentGateway(config) que retorna el cliente correcto
    - _Requirements: 1.2_

- [x] 4. Checkpoint - Verificar clientes de pago

- [x] 5. Implementar configuración de pasarela en dashboard
  - [x] 5.1 Crear server actions en `src/app/dashboard/settings/payments/actions.ts`
    - Implementar getPaymentConfig, savePaymentConfig, testConnection, toggleGateway
    - Encriptar credenciales antes de guardar
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6_
  - [x] 5.2 Crear componente `src/app/dashboard/settings/payments/components/gateway-config-form.tsx`
    - Selector de proveedor (Wompi/ePayco)
    - Campos para llaves públicas y privadas
    - Toggle modo test/producción
    - _Requirements: 1.2, 1.3_
  - [x] 5.3 Crear componente `src/app/dashboard/settings/payments/components/connection-tester.tsx`
    - Botón para probar conexión
    - Mostrar resultado de la prueba
    - _Requirements: 1.4_
  - [x] 5.4 Crear página `src/app/dashboard/settings/payments/page.tsx`
    - Integrar formulario y tester
    - Mostrar estado actual de la configuración
    - _Requirements: 1.1_

- [x] 6. Checkpoint - Verificar configuración de pasarela

- [ ] 7. Implementar checkout en storefront
  - [ ] 7.1 Crear API route `src/app/api/store/[slug]/checkout/route.ts`
    - POST: Crear intención de pago
    - GET: Obtener estado de transacción
    - _Requirements: 2.1, 2.4_
  - [ ] 7.2 Crear API route `src/app/api/store/[slug]/checkout/banks/route.ts`
    - GET: Obtener lista de bancos para PSE
    - _Requirements: 2.3_
  - [ ] 7.3 Crear componente `src/components/store/checkout/payment-method-selector.tsx`
    - Opciones: Tarjeta, PSE, Nequi (según proveedor)
    - _Requirements: 2.2, 2.3_
  - [ ] 7.4 Crear componente `src/components/store/checkout/card-payment-form.tsx`
    - Formulario de tarjeta con tokenización
    - Validación de campos
    - _Requirements: 2.2, 5.4_
  - [ ] 7.5 Crear componente `src/components/store/checkout/pse-payment-form.tsx`
    - Selector de banco
    - Tipo de persona (natural/jurídica)
    - _Requirements: 2.3_
  - [ ] 7.6 Crear componente `src/components/store/checkout/payment-status.tsx`
    - Mostrar estado de transacción en tiempo real
    - Polling o WebSocket para actualizaciones
    - _Requirements: 2.4, 2.5_
  - [ ] 7.7 Crear página `src/app/store/[slug]/checkout/page.tsx`
    - Integrar todos los componentes de checkout
    - Flujo completo de pago
    - _Requirements: 2.1, 2.6_

- [ ] 8. Checkpoint - Verificar checkout

- [x] 9. Implementar webhooks de pago
  - [x] 9.1 Crear webhook handler `src/app/api/webhooks/payments/wompi/route.ts`
    - Validar firma X-Event-Checksum
    - Actualizar transacción y orden
    - _Requirements: 4.1, 4.3, 4.4, 4.5_
  - [x] 9.2 Crear webhook handler `src/app/api/webhooks/payments/epayco/route.ts`
    - Validar firma x_signature
    - Actualizar transacción y orden
    - _Requirements: 4.2, 4.3, 4.4, 4.5_
  - [x] 9.3 Validación de firmas integrada en cada webhook handler
    - Funciones para validar firmas de cada proveedor
    - _Requirements: 4.3, 5.2_

- [x] 10. Checkpoint - Verificar webhooks

- [ ] 11. Implementar historial de transacciones
  - [ ] 11.1 Crear server actions en `src/app/dashboard/transactions/actions.ts`
    - Implementar getTransactions con filtros
    - Implementar getTransactionById
    - Implementar exportTransactionsCSV
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [ ] 11.2 Crear componente `src/app/dashboard/transactions/components/transaction-list.tsx`
    - Tabla con columnas: fecha, monto, método, estado, cliente
    - Paginación
    - _Requirements: 3.1, 3.2, 3.3_
  - [ ] 11.3 Crear componente `src/app/dashboard/transactions/components/transaction-filters.tsx`
    - Filtros por fecha, estado, método de pago
    - _Requirements: 3.1_
  - [ ] 11.4 Crear componente `src/app/dashboard/transactions/components/transaction-details.tsx`
    - Modal con detalles completos de la transacción
    - _Requirements: 3.2_
  - [ ] 11.5 Crear página `src/app/dashboard/transactions/page.tsx`
    - Integrar lista, filtros y exportación
    - _Requirements: 3.1, 3.4_

- [ ] 12. Final Checkpoint - Verificar implementación completa
