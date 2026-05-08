# Documento de Diseño

## Visión General

Este diseño implementa la gestión de planes y suscripciones para LandingChat, permitiendo al superadmin crear planes, monitorear suscripciones y procesar pagos a través de Wompi. Se sigue el patrón existente de la aplicación usando Server Actions, Zod para validación y el tipo `ActionResult<T>` para respuestas consistentes.

## Arquitectura

```mermaid
graph TB
    subgraph "Panel Admin"
        A[Plans Page] --> B[Plan Form]
        A --> C[Plan List]
        D[Subscriptions Page] --> E[Subscription List]
        F[Dashboard] --> G[MRR Metrics]
    end
    
    subgraph "Server Actions"
        H[plans/actions.ts]
        I[subscriptions/actions.ts]
        J[wompi/actions.ts]
    end
    
    subgraph "API Routes"
        K[/api/webhooks/wompi]
    end
    
    subgraph "Base de Datos"
        L[(plans)]
        M[(subscriptions)]
        N[(payment_transactions)]
    end
    
    subgraph "Servicios Externos"
        O[Wompi API]
    end
    
    A --> H
    D --> I
    H --> L
    I --> M
    J --> O
    K --> M
    K --> N
```

## Componentes e Interfaces

### Estructura de Archivos

```
src/
├── app/
│   ├── admin/
│   │   ├── plans/
│   │   │   ├── page.tsx
│   │   │   ├── actions.ts
│   │   │   └── components/
│   │   │       ├── plan-list.tsx
│   │   │       └── plan-form.tsx
│   │   ├── subscriptions/
│   │   │   ├── page.tsx
│   │   │   ├── actions.ts
│   │   │   └── components/
│   │   │       └── subscription-list.tsx
│   │   └── settings/
│   │       └── wompi/
│   │           ├── page.tsx
│   │           └── actions.ts
│   └── api/
│       └── webhooks/
│           └── wompi/
│               └── route.ts
├── lib/
│   └── wompi/
│       ├── client.ts
│       └── types.ts
└── types/
    ├── plan.ts
    └── subscription.ts
```

### Server Actions

#### plans/actions.ts
```typescript
// Funciones principales
getPlans(): Promise<ActionResult<Plan[]>>
getPlanById(id: string): Promise<ActionResult<Plan>>
createPlan(data: CreatePlanInput): Promise<ActionResult<Plan>>
updatePlan(id: string, data: UpdatePlanInput): Promise<ActionResult<Plan>>
togglePlanStatus(id: string): Promise<ActionResult<Plan>>
```

#### subscriptions/actions.ts
```typescript
// Funciones principales
getSubscriptions(filters?: SubscriptionFilters): Promise<ActionResult<SubscriptionWithOrg[]>>
getSubscriptionMetrics(): Promise<ActionResult<SubscriptionMetrics>>
getOrganizationSubscription(orgId: string): Promise<ActionResult<Subscription>>
updateSubscriptionStatus(id: string, status: SubscriptionStatus): Promise<ActionResult<Subscription>>
```

#### wompi/actions.ts
```typescript
// Funciones principales
saveWompiConfig(config: WompiConfig): Promise<ActionResult<void>>
getWompiConfig(): Promise<ActionResult<WompiConfig>>
createSubscriptionPayment(subscriptionId: string): Promise<ActionResult<PaymentTransaction>>
```

## Modelos de Datos

### Plan
```typescript
interface Plan {
  id: string
  name: string
  slug: string
  description: string | null
  price: number
  currency: 'COP' | 'USD'
  billing_period: 'monthly' | 'yearly'
  max_products: number
  max_agents: number
  max_monthly_conversations: number
  features: Record<string, boolean>
  is_active: boolean
  created_at: string
  updated_at: string
}
```

### Subscription
```typescript
interface Subscription {
  id: string
  organization_id: string
  plan_id: string
  status: 'active' | 'cancelled' | 'past_due' | 'trialing' | 'incomplete'
  current_period_start: string
  current_period_end: string
  cancel_at_period_end: boolean
  provider_subscription_id: string | null
  provider_customer_id: string | null
  created_at: string
  updated_at: string
}
```

### PaymentTransaction
```typescript
interface PaymentTransaction {
  id: string
  subscription_id: string
  amount: number
  currency: string
  status: 'pending' | 'approved' | 'declined' | 'error'
  provider: 'wompi'
  provider_transaction_id: string | null
  provider_response: Record<string, unknown> | null
  created_at: string
}
```

### Esquemas Zod

```typescript
// src/types/plan.ts
export const PlanSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50),
  description: z.string().nullable(),
  price: z.number().positive(),
  currency: z.enum(['COP', 'USD']),
  billing_period: z.enum(['monthly', 'yearly']),
  max_products: z.number().int().positive(),
  max_agents: z.number().int().positive(),
  max_monthly_conversations: z.number().int().positive(),
  features: z.record(z.boolean()),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const CreatePlanInputSchema = PlanSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
})

// src/types/subscription.ts
export const SubscriptionSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  plan_id: z.string().uuid(),
  status: z.enum(['active', 'cancelled', 'past_due', 'trialing', 'incomplete']),
  current_period_start: z.string(),
  current_period_end: z.string(),
  cancel_at_period_end: z.boolean(),
  provider_subscription_id: z.string().nullable(),
  provider_customer_id: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
}).refine(
  (data) => new Date(data.current_period_start) < new Date(data.current_period_end),
  { message: "La fecha de inicio debe ser anterior a la fecha de fin" }
)
```



## Propiedades de Correctitud

*Una propiedad es una característica o comportamiento que debe mantenerse verdadero en todas las ejecuciones válidas de un sistema—esencialmente, una declaración formal sobre lo que el sistema debe hacer. Las propiedades sirven como puente entre especificaciones legibles por humanos y garantías de correctitud verificables por máquinas.*

### Property 1: Validación de schema de Plan
*Para cualquier* objeto Plan válido, la validación con PlanSchema debe pasar y retornar el mismo objeto con tipos correctos.
**Validates: Requirements 1.1, 1.5, 2.2**

### Property 2: Round-trip de serialización de Plan
*Para cualquier* Plan válido, serializar a formato de base de datos y deserializar debe producir un objeto equivalente al original.
**Validates: Requirements 5.4, 5.5**

### Property 3: Precio positivo y moneda válida
*Para cualquier* input de creación de plan, si el precio es menor o igual a cero o la moneda no es 'COP' o 'USD', la validación debe fallar.
**Validates: Requirements 5.1**

### Property 4: Coherencia de fechas de período
*Para cualquier* suscripción, si current_period_start >= current_period_end, la validación debe fallar.
**Validates: Requirements 5.3**

### Property 5: Filtro de suscripciones por estado
*Para cualquier* filtro de estado aplicado, todos los resultados retornados deben tener exactamente ese estado.
**Validates: Requirements 2.4**

### Property 6: Cálculo de porcentaje de uso
*Para cualquier* uso y límite donde límite > 0, el porcentaje calculado debe ser (uso / límite) * 100 y estar entre 0 y infinito.
**Validates: Requirements 4.2, 4.3**

### Property 7: Bloqueo por exceso de límite
*Para cualquier* recurso donde uso > límite, la función de verificación debe retornar false (bloqueado).
**Validates: Requirements 4.4**

### Property 8: Desactivación de plan
*Para cualquier* plan activo, después de desactivar, is_active debe ser false.
**Validates: Requirements 1.4**

### Property 9: Actualización de timestamp
*Para cualquier* suscripción actualizada, updated_at debe ser mayor o igual al valor anterior.
**Validates: Requirements 2.3**

### Property 10: Formato de transacción Wompi
*Para cualquier* transacción válida, el formato serializado debe contener los campos requeridos por la API de Wompi: amount_in_cents, currency, reference.
**Validates: Requirements 3.5**

## Manejo de Errores

### Errores de Validación
- Datos inválidos retornan `ActionResult` con `success: false` y mensaje descriptivo
- Los schemas Zod proveen mensajes de error específicos por campo

### Errores de Base de Datos
- Errores de conexión se capturan y retornan mensaje genérico al usuario
- Violaciones de unicidad (nombre de plan duplicado) retornan error específico

### Errores de Wompi
- Timeouts de API se manejan con retry (máximo 3 intentos)
- Respuestas de error se registran en payment_transactions
- Webhooks inválidos se rechazan con 400

## Estrategia de Testing

### Testing Unitario
- Validación de schemas Zod con casos válidos e inválidos
- Funciones de cálculo (porcentaje de uso, MRR)
- Formateo de datos para Wompi

### Property-Based Testing
Se usará **fast-check** como librería de property-based testing.

Cada property test debe:
1. Ejecutar mínimo 100 iteraciones
2. Incluir comentario referenciando la propiedad del diseño: `**Feature: plan-subscription-management, Property {N}: {descripción}**`
3. Usar generadores que produzcan datos válidos dentro del dominio

### Tests de Integración
- Flujo completo de creación de plan
- Flujo de webhook de Wompi
- Verificación de límites de organización
