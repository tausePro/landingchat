# Diseño Técnico - Pasarelas de Pago para Organizaciones

## Arquitectura General

```
┌─────────────────────────────────────────────────────────────────┐
│                        Storefront                                │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │   Cart      │───▶│  Checkout   │───▶│  Payment Widget     │  │
│  └─────────────┘    └─────────────┘    └──────────┬──────────┘  │
└──────────────────────────────────────────────────┼──────────────┘
                                                   │
                    ┌──────────────────────────────┼──────────────┐
                    │           API Layer          │              │
                    │  ┌─────────────────────────┐ │              │
                    │  │ /api/store/[slug]/pay   │◀┘              │
                    │  └───────────┬─────────────┘               │
                    │              │                              │
                    │  ┌───────────▼─────────────┐               │
                    │  │  Payment Gateway Client  │               │
                    │  │  (Wompi / ePayco)        │               │
                    │  └───────────┬─────────────┘               │
                    └──────────────┼──────────────────────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │     External Gateway        │
                    │  (Wompi API / ePayco API)   │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │   Webhook Handler           │
                    │ /api/webhooks/payments/[org]│
                    └─────────────────────────────┘
```

## Modelo de Datos

### Tabla: payment_gateway_configs
```sql
CREATE TABLE payment_gateway_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('wompi', 'epayco')),
  is_active BOOLEAN DEFAULT false,
  is_test_mode BOOLEAN DEFAULT true,
  -- Credenciales encriptadas
  public_key_encrypted TEXT,
  private_key_encrypted TEXT,
  -- Configuración adicional
  webhook_secret_encrypted TEXT,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, provider)
);
```

### Tabla: store_transactions
```sql
CREATE TABLE store_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  order_id UUID REFERENCES orders(id),
  customer_id UUID REFERENCES customers(id),
  -- Datos de transacción
  amount INTEGER NOT NULL, -- En centavos
  currency TEXT DEFAULT 'COP',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'voided', 'error')),
  -- Datos del proveedor
  provider TEXT NOT NULL,
  provider_transaction_id TEXT,
  provider_reference TEXT,
  provider_response JSONB,
  -- Método de pago
  payment_method TEXT, -- 'card', 'pse', 'nequi', etc.
  payment_method_details JSONB,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
```

## Componentes

### 1. Configuración de Pasarela (Dashboard)

**Ruta:** `/dashboard/settings/payments`

**Componentes:**
- `PaymentGatewayConfig` - Formulario de configuración
- `GatewayProviderSelector` - Selector de proveedor (Wompi/ePayco)
- `CredentialsForm` - Formulario de credenciales
- `ConnectionTester` - Botón para probar conexión

**Server Actions:**
```typescript
// src/app/dashboard/settings/payments/actions.ts
export async function getPaymentConfig(): Promise<ActionResult<PaymentGatewayConfig | null>>
export async function savePaymentConfig(data: PaymentConfigInput): Promise<ActionResult<PaymentGatewayConfig>>
export async function testConnection(provider: string): Promise<ActionResult<{ success: boolean }>>
export async function toggleGateway(isActive: boolean): Promise<ActionResult<void>>
```

### 2. Checkout en Storefront

**Ruta:** `/store/[slug]/checkout`

**Componentes:**
- `CheckoutPage` - Página principal de checkout
- `PaymentMethodSelector` - Selector de método de pago
- `CardPaymentForm` - Formulario de tarjeta (tokenizado)
- `PSEPaymentForm` - Formulario de PSE
- `PaymentStatus` - Estado de la transacción

**API Routes:**
```typescript
// src/app/api/store/[slug]/checkout/route.ts
POST - Crear intención de pago
GET - Obtener estado de transacción

// src/app/api/store/[slug]/checkout/tokenize/route.ts
POST - Tokenizar tarjeta (proxy a Wompi/ePayco)
```

### 3. Clientes de Pasarela

**Ubicación:** `src/lib/payments/`

```typescript
// src/lib/payments/types.ts
interface PaymentGateway {
  createTransaction(data: TransactionInput): Promise<TransactionResult>
  getTransaction(id: string): Promise<Transaction>
  tokenizeCard(data: CardData): Promise<TokenResult>
  getBanks(): Promise<Bank[]> // Para PSE
}

// src/lib/payments/wompi.ts
export class WompiGateway implements PaymentGateway { ... }

// src/lib/payments/epayco.ts
export class EpaycoGateway implements PaymentGateway { ... }

// src/lib/payments/factory.ts
export function createPaymentGateway(config: PaymentGatewayConfig): PaymentGateway
```

### 4. Webhook Handler

**Ruta:** `/api/webhooks/payments/[provider]`

```typescript
// src/app/api/webhooks/payments/[provider]/route.ts
export async function POST(request: Request, { params }: { params: { provider: string } }) {
  // 1. Validar firma del webhook
  // 2. Parsear evento
  // 3. Buscar transacción por provider_reference
  // 4. Actualizar estado de transacción
  // 5. Actualizar estado de orden
  // 6. Enviar notificación al cliente (opcional)
}
```

### 5. Historial de Transacciones

**Ruta:** `/dashboard/transactions`

**Componentes:**
- `TransactionList` - Lista con filtros
- `TransactionDetails` - Modal de detalles
- `TransactionFilters` - Filtros por fecha/estado
- `ExportButton` - Exportar a CSV

## Tipos TypeScript

```typescript
// src/types/payment.ts
export const PaymentGatewayConfigSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  provider: z.enum(['wompi', 'epayco']),
  is_active: z.boolean(),
  is_test_mode: z.boolean(),
  public_key: z.string().optional(),
  config: z.record(z.unknown()).optional(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const StoreTransactionSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  order_id: z.string().uuid().optional(),
  customer_id: z.string().uuid().optional(),
  amount: z.number().int().positive(),
  currency: z.string().default('COP'),
  status: z.enum(['pending', 'approved', 'declined', 'voided', 'error']),
  provider: z.string(),
  provider_transaction_id: z.string().optional(),
  payment_method: z.string().optional(),
  created_at: z.string(),
  completed_at: z.string().optional(),
})
```

## Seguridad

### Encriptación de Credenciales
- Usar AES-256-GCM para encriptar llaves privadas
- La llave de encriptación se almacena en variable de entorno
- Las llaves públicas pueden almacenarse sin encriptar

### Validación de Webhooks
- **Wompi:** Validar header `X-Event-Checksum` con SHA256
- **ePayco:** Validar firma con x_signature

### Tokenización
- Las tarjetas se tokenizan directamente con el proveedor
- Nunca almacenamos números de tarjeta completos
- Solo guardamos últimos 4 dígitos para referencia

## Flujo de Pago

```
1. Cliente agrega productos al carrito
2. Cliente va a checkout
3. Sistema verifica que la tienda tiene pasarela activa
4. Cliente selecciona método de pago
5. Si es tarjeta:
   a. Se tokeniza la tarjeta con el proveedor
   b. Se crea transacción con el token
6. Si es PSE:
   a. Se obtiene lista de bancos
   b. Cliente selecciona banco
   c. Se crea transacción y redirige al banco
7. Se crea registro en store_transactions (status: pending)
8. Se actualiza orden (payment_status: processing)
9. Webhook recibe resultado
10. Se actualiza store_transactions y orden
11. Se notifica al cliente
```
