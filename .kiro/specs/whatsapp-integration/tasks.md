# Plan de Implementación - Integración WhatsApp con Evolution API

- [ ] 1. Configurar infraestructura de base de datos y tipos
  - [ ] 1.1 Crear migración SQL para tabla whatsapp_instances
    - Crear tabla con campos: id, organization_id, instance_name, instance_type, status, phone_number, etc.
    - Agregar columnas channel y whatsapp_chat_id a tabla chats
    - Agregar índices y políticas RLS
    - _Requirements: 2.1, 3.2, 3.3_
  - [ ] 1.2 Crear tipos y schemas Zod en `src/types/whatsapp.ts`
    - Definir WhatsAppInstanceSchema, EvolutionWebhookSchema, WhatsAppMessageSchema
    - Exportar tipos TypeScript inferidos
    - _Requirements: 3.1, 4.1_
  - [ ] 1.3 Agregar campo max_whatsapp_conversations a tabla plans
    - Migración para agregar límite de conversaciones WhatsApp por plan
    - _Requirements: 7.1, 7.4_

- [ ] 2. Checkpoint - Verificar migración y tipos

- [ ] 3. Implementar cliente Evolution API
  - [ ] 3.1 Crear cliente base en `src/lib/evolution/client.ts`
    - Implementar createInstance, deleteInstance, getInstance
    - Implementar getQRCode, getConnectionStatus, logout
    - Manejar autenticación con API Key
    - _Requirements: 2.2, 2.3_
  - [ ] 3.2 Implementar métodos de mensajería en `src/lib/evolution/client.ts`
    - Implementar sendTextMessage, sendMediaMessage, sendButtonMessage
    - Manejar reintentos con backoff exponencial
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - [ ] 3.3 Crear tipos Evolution en `src/lib/evolution/types.ts`
    - Definir interfaces para requests y responses de Evolution API
    - _Requirements: 3.1_

- [ ] 4. Checkpoint - Verificar cliente Evolution

- [ ] 5. Implementar configuración admin de Evolution API
  - [ ] 5.1 Crear server actions en `src/app/admin/settings/evolution/actions.ts`
    - Implementar getEvolutionConfig, saveEvolutionConfig, testConnection
    - Encriptar API Key antes de guardar
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [ ] 5.2 Crear página `src/app/admin/settings/evolution/page.tsx`
    - Formulario para URL y API Key
    - Botón para probar conexión
    - _Requirements: 1.1_
  - [ ] 5.3 Crear página de gestión de instancias `src/app/admin/whatsapp/page.tsx`
    - Lista de todas las instancias con estado
    - Filtros por organización y estado
    - Acciones de desconectar/eliminar
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [ ] 6. Checkpoint - Verificar configuración admin

- [ ] 7. Implementar conexión WhatsApp en dashboard
  - [ ] 7.1 Crear server actions en `src/app/dashboard/settings/whatsapp/actions.ts`
    - Implementar getWhatsAppStatus, connectWhatsApp, disconnectWhatsApp
    - Implementar getQRCode, updateNotificationSettings
    - Verificar límites del plan antes de conectar
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - [ ] 7.2 Crear componente `src/app/dashboard/settings/whatsapp/components/corporate-card.tsx`
    - Mostrar estado de conexión (conectado/desconectado)
    - Botón conectar/desconectar
    - Mostrar número conectado y métricas
    - _Requirements: 2.1, 2.3_
  - [ ] 7.3 Crear componente `src/app/dashboard/settings/whatsapp/components/qr-modal.tsx`
    - Modal con código QR
    - Polling de estado cada 3 segundos
    - Cierre automático al conectar
    - _Requirements: 2.2, 2.3_
  - [ ] 7.4 Crear componente `src/app/dashboard/settings/whatsapp/components/personal-card.tsx`
    - Configuración de WhatsApp personal para notificaciones
    - Toggles para tipos de notificación
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - [ ] 7.5 Crear página `src/app/dashboard/settings/whatsapp/page.tsx`
    - Integrar corporate-card, personal-card
    - Mostrar uso vs límite del plan
    - _Requirements: 2.1, 7.2_

- [ ] 8. Checkpoint - Verificar conexión WhatsApp

- [ ] 9. Implementar webhook handler
  - [ ] 9.1 Crear webhook handler `src/app/api/webhooks/whatsapp/route.ts`
    - Validar firma del webhook
    - Parsear eventos: messages.upsert, connection.update, qrcode.updated
    - Identificar organización por instance_name
    - _Requirements: 3.1, 3.5_
  - [ ] 9.2 Implementar procesamiento de mensajes entrantes
    - Buscar/crear cliente por número de teléfono
    - Buscar/crear conversación (chat)
    - Guardar mensaje en base de datos
    - Verificar límite de conversaciones
    - _Requirements: 3.2, 3.3, 3.4, 7.1_
  - [ ] 9.3 Implementar actualización de estado de conexión
    - Actualizar status de instancia en DB
    - Notificar al frontend via polling
    - _Requirements: 2.3, 2.4_
  - [ ]* 9.4 Write property test for webhook signature validation
    - **Property 5: Validación de webhook**
    - **Validates: Requirements 3.5, 5.4**

- [ ] 10. Checkpoint - Verificar webhook handler

- [ ] 11. Integrar con agente IA existente
  - [ ] 11.1 Modificar `src/lib/ai/agent.ts` para soportar canal WhatsApp
    - Agregar parámetro de canal al procesar mensaje
    - Formatear respuestas según canal (texto plano para WA)
    - _Requirements: 3.4, 4.1_
  - [ ] 11.2 Crear servicio de mensajería unificada `src/lib/messaging/unified.ts`
    - Función processIncomingMessage(channel, message)
    - Función sendResponse(conversationId, response)
    - Función identifyCustomer(phone, email)
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [ ]* 11.3 Write property test for customer identification
    - **Property 1: Identificación de cliente por teléfono**
    - **Validates: Requirements 3.2, 3.3, 5.1**

- [ ] 12. Checkpoint - Verificar integración con agente

- [ ] 13. Implementar notificaciones al propietario
  - [ ] 13.1 Crear servicio de notificaciones `src/lib/notifications/whatsapp.ts`
    - Función sendSaleNotification(orgId, order)
    - Función sendLowStockNotification(orgId, product)
    - Función sendNewConversationNotification(orgId, customer)
    - _Requirements: 6.2, 6.3, 6.4_
  - [ ] 13.2 Integrar notificaciones en flujo de órdenes
    - Trigger al cambiar payment_status a 'paid'
    - Verificar configuración de notificaciones antes de enviar
    - _Requirements: 6.2, 6.5_
  - [ ]* 13.3 Write property test for notification delivery
    - **Property 4: Persistencia de mensajes**
    - **Validates: Requirements 3.4, 4.5**

- [ ] 14. Checkpoint - Verificar notificaciones

- [ ] 15. Implementar control de límites
  - [ ] 15.1 Crear utilidades de límites `src/lib/utils/whatsapp-limits.ts`
    - Función checkConversationLimit(orgId)
    - Función incrementConversationCount(orgId)
    - Función resetMonthlyCounters() - para cron job
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  - [ ] 15.2 Agregar indicador de uso en dashboard
    - Mostrar conversaciones usadas vs límite
    - Alerta cuando uso > 80%
    - _Requirements: 7.2_
  - [ ]* 15.3 Write property test for conversation limits
    - **Property 2: Límite de conversaciones por plan**
    - **Validates: Requirements 7.1, 7.4**

- [ ] 16. Final Checkpoint - Verificar implementación completa
