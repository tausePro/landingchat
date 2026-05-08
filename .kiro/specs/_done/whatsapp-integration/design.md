# Diseño Técnico - Integración WhatsApp con Evolution API

## Overview

Integración de WhatsApp como canal de comunicación usando Evolution API (wa.tause.pro) con Baileys. Permite a las organizaciones conectar su WhatsApp corporativo para ventas conversacionales y recibir notificaciones en su WhatsApp personal.

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CANALES DE ENTRADA                               │
├─────────────────┬───────────────────┬───────────────────────────────────┤
│    Web Chat     │  WhatsApp Corp.   │  WhatsApp Personal (notif.)       │
│   (existente)   │   (nuevo)         │   (nuevo)                         │
└────────┬────────┴─────────┬─────────┴───────────────────────────────────┘
         │                  │
         │                  │ Webhooks
         │                  ▼
         │    ┌─────────────────────────────────────┐
         │    │         Evolution API               │
         │    │        wa.tause.pro                 │
         │    │  ┌──────────┐  ┌──────────┐        │
         │    │  │Instance 1│  │Instance N│        │
         │    │  │(Tienda A)│  │(Tienda N)│        │
         │    │  └──────────┘  └──────────┘        │
         │    └──────────────────┬──────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         LandingChat API                                  │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │              /api/webhooks/whatsapp                              │   │
│  │  - Valida firma                                                  │   │
│  │  - Identifica organización                                       │   │
│  │  - Normaliza mensaje                                             │   │
│  └──────────────────────────────┬──────────────────────────────────┘   │
│                                 │                                       │
│  ┌──────────────────────────────▼──────────────────────────────────┐   │
│  │              Capa de Mensajería Unificada                        │   │
│  │  - Identifica/crea cliente                                       │   │
│  │  - Gestiona conversación cross-channel                           │   │
│  │  - Mantiene contexto                                             │   │
│  └──────────────────────────────┬──────────────────────────────────┘   │
│                                 │                                       │
│  ┌──────────────────────────────▼──────────────────────────────────┐   │
│  │                    Agente IA (Claude)                            │   │
│  │  - Mismo agente para todos los canales                           │   │
│  │  - Contexto de productos, órdenes, cliente                       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Modelo de Datos

### Tabla: whatsapp_instances
```sql
CREATE TABLE whatsapp_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  instance_name TEXT NOT NULL UNIQUE, -- "org_{org_id}"
  instance_type TEXT NOT NULL CHECK (instance_type IN ('corporate', 'personal')),
  status TEXT DEFAULT 'disconnected' CHECK (status IN ('disconnected', 'connecting', 'connected', 'banned')),
  phone_number TEXT, -- Número conectado (hasheado para privacidad)
  phone_number_display TEXT, -- Últimos 4 dígitos para mostrar
  qr_code TEXT, -- QR temporal para conexión
  qr_expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ,
  disconnected_at TIMESTAMPTZ,
  -- Configuración
  notifications_enabled BOOLEAN DEFAULT true,
  notify_on_sale BOOLEAN DEFAULT true,
  notify_on_low_stock BOOLEAN DEFAULT false,
  notify_on_new_conversation BOOLEAN DEFAULT false,
  -- Métricas
  conversations_this_month INTEGER DEFAULT 0,
  messages_sent_this_month INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Tabla: channels (extensión de chats existente)
```sql
-- Agregar columna a tabla chats existente
ALTER TABLE chats ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'web' 
  CHECK (channel IN ('web', 'whatsapp'));
ALTER TABLE chats ADD COLUMN IF NOT EXISTS whatsapp_chat_id TEXT; -- ID del chat en WhatsApp
```

### Tabla: system_settings (agregar config Evolution)
```sql
-- Usar tabla existente system_settings para:
-- key: 'evolution_api_config'
-- value: { url, apiKey, webhookSecret }
```

## Componentes

### 1. Cliente Evolution API

**Ubicación:** `src/lib/evolution/client.ts`

```typescript
interface EvolutionClient {
  // Gestión de instancias
  createInstance(name: string, webhookUrl: string): Promise<Instance>
  deleteInstance(name: string): Promise<void>
  getInstance(name: string): Promise<Instance>
  getQRCode(name: string): Promise<{ qrcode: string; expiresAt: Date }>
  
  // Mensajería
  sendTextMessage(instance: string, to: string, text: string): Promise<void>
  sendMediaMessage(instance: string, to: string, media: Media): Promise<void>
  sendButtonMessage(instance: string, to: string, text: string, buttons: Button[]): Promise<void>
  
  // Estado
  getConnectionStatus(name: string): Promise<'connected' | 'disconnected' | 'connecting'>
  logout(name: string): Promise<void>
}
```

### 2. Configuración Admin

**Ruta:** `/admin/settings/evolution`

**Componentes:**
- `EvolutionConfigForm` - Formulario URL + API Key
- `ConnectionTester` - Botón para probar conexión
- `InstancesList` - Lista de todas las instancias

### 3. Configuración Dashboard (Organización)

**Ruta:** `/dashboard/settings/whatsapp`

**Componentes:**
- `WhatsAppCorporateCard` - Estado y conexión de WA corporativo
- `WhatsAppPersonalCard` - Configuración de notificaciones
- `QRCodeModal` - Modal con QR para escanear
- `ConnectionStatus` - Indicador de estado en tiempo real

### 4. Webhook Handler

**Ruta:** `/api/webhooks/whatsapp`

```typescript
// Eventos que maneja:
// - messages.upsert: Mensaje nuevo recibido
// - connection.update: Cambio de estado de conexión
// - qrcode.updated: Nuevo QR generado
```

### 5. Servicio de Mensajería Unificada

**Ubicación:** `src/lib/messaging/unified.ts`

```typescript
interface UnifiedMessaging {
  // Procesar mensaje entrante de cualquier canal
  processIncomingMessage(channel: Channel, message: RawMessage): Promise<void>
  
  // Enviar respuesta por el canal apropiado
  sendResponse(conversationId: string, response: AgentResponse): Promise<void>
  
  // Identificar cliente cross-channel
  identifyCustomer(phone?: string, email?: string): Promise<Customer | null>
  
  // Obtener contexto unificado para el agente
  getConversationContext(customerId: string): Promise<ConversationContext>
}
```

## Flujos

### Flujo 1: Conexión de WhatsApp Corporativo

```
1. Usuario click "Conectar WhatsApp"
2. Frontend → POST /api/whatsapp/connect
3. Backend → Evolution API: createInstance("org_{id}")
4. Backend → Evolution API: getQRCode("org_{id}")
5. Backend guarda instancia en DB (status: connecting)
6. Frontend muestra QR en modal
7. Frontend hace polling cada 3s: GET /api/whatsapp/status
8. Usuario escanea QR con WhatsApp
9. Evolution → Webhook: connection.update (connected)
10. Backend actualiza status y phone_number
11. Frontend detecta cambio y cierra modal
```

### Flujo 2: Mensaje Entrante WhatsApp

```
1. Cliente envía mensaje por WhatsApp
2. Evolution → POST /api/webhooks/whatsapp
   Body: { instance, event: "messages.upsert", data: { ... } }
3. Validar firma del webhook
4. Identificar organización por instance_name
5. Buscar/crear cliente por número de teléfono
6. Buscar/crear conversación (chat)
7. Guardar mensaje en DB
8. Verificar límite de conversaciones del plan
9. Enviar a agente IA para procesar
10. Agente genera respuesta
11. Enviar respuesta via Evolution API
12. Guardar respuesta en DB
```

### Flujo 3: Notificación de Venta

```
1. Se completa una orden (payment_status: paid)
2. Trigger/Hook detecta cambio
3. Buscar instancia personal de la organización
4. Si existe y notificaciones activas:
   - Formatear mensaje: "🎉 Nueva venta! $150.000 - Juan Pérez"
   - Enviar via Evolution API al número personal
5. Registrar notificación enviada
```

## Tipos TypeScript

```typescript
// src/types/whatsapp.ts

export const WhatsAppInstanceSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  instance_name: z.string(),
  instance_type: z.enum(['corporate', 'personal']),
  status: z.enum(['disconnected', 'connecting', 'connected', 'banned']),
  phone_number: z.string().nullable(),
  phone_number_display: z.string().nullable(),
  conversations_this_month: z.number().default(0),
  notifications_enabled: z.boolean().default(true),
  notify_on_sale: z.boolean().default(true),
  created_at: z.string(),
  updated_at: z.string(),
})

export const EvolutionWebhookSchema = z.object({
  instance: z.string(),
  event: z.enum(['messages.upsert', 'connection.update', 'qrcode.updated']),
  data: z.record(z.unknown()),
})

export const WhatsAppMessageSchema = z.object({
  id: z.string(),
  from: z.string(), // Número del remitente
  to: z.string(), // Número del destinatario
  body: z.string(),
  timestamp: z.number(),
  type: z.enum(['text', 'image', 'document', 'audio', 'video']),
  media_url: z.string().optional(),
})
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Identificación de cliente por teléfono
*For any* mensaje de WhatsApp con número de teléfono, si existe un cliente con ese número, el sistema debe asociar el mensaje a ese cliente existente.
**Validates: Requirements 3.2, 3.3, 5.1**

### Property 2: Límite de conversaciones por plan
*For any* organización que alcanza su límite de conversaciones, los nuevos mensajes entrantes deben ser rechazados o encolados.
**Validates: Requirements 7.1, 7.4**

### Property 3: Unicidad de instancia por organización
*For any* organización, solo puede existir una instancia de WhatsApp corporativo activa a la vez.
**Validates: Requirements 2.2, 2.3**

### Property 4: Persistencia de mensajes
*For any* mensaje enviado o recibido por WhatsApp, debe existir un registro correspondiente en la base de datos.
**Validates: Requirements 3.4, 4.5**

### Property 5: Validación de webhook
*For any* webhook recibido sin firma válida, el sistema debe rechazar el request con error 401.
**Validates: Requirements 3.5, 5.4**

## Error Handling

| Escenario | Acción |
|-----------|--------|
| Evolution API no disponible | Mostrar mensaje "Servicio temporalmente no disponible" |
| QR expirado | Generar nuevo QR automáticamente |
| Sesión desconectada | Notificar usuario, permitir reconexión |
| Límite de conversaciones alcanzado | Responder con mensaje automático al cliente |
| Mensaje no enviado | Reintentar 3 veces con backoff exponencial |

## Testing Strategy

### Unit Tests
- Validación de schemas de mensajes
- Formateo de números de teléfono
- Cálculo de límites de conversaciones

### Property-Based Tests
- Usar fast-check para generar mensajes aleatorios
- Verificar que todos los mensajes se persisten correctamente
- Verificar límites de plan con diferentes configuraciones

### Integration Tests
- Mock de Evolution API para probar flujos completos
- Verificar webhook handling con payloads reales
