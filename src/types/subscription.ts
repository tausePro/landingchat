/**
 * Tipos y schemas Zod para Suscripciones y Transacciones de Pago
 * Feature: plan-subscription-management
 */

import { z } from 'zod'

// Enums de estado de suscripción
export const SubscriptionStatusEnum = z.enum([
  'active',      // Suscripción activa y al día
  'cancelled',   // Cancelada por el usuario
  'past_due',    // Pago vencido
  'trialing',    // En período de prueba
  'incomplete',  // Pago inicial pendiente
])
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusEnum>

// Enums de estado de transacción
export const PaymentStatusEnum = z.enum([
  'pending',   // Esperando procesamiento
  'approved',  // Pago aprobado
  'declined',  // Pago rechazado
  'error',     // Error en el procesamiento
  'voided',    // Transacción anulada
])
export type PaymentStatus = z.infer<typeof PaymentStatusEnum>

// Schema principal de Suscripción
export const SubscriptionSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  plan_id: z.string().uuid(),
  status: SubscriptionStatusEnum,
  current_period_start: z.string(),
  current_period_end: z.string(),
  cancel_at_period_end: z.boolean(),
  provider_subscription_id: z.string().nullable(),
  provider_customer_id: z.string().nullable(),
  // Campos cacheados del plan (para acceso rápido)
  max_products: z.number().int().optional(),
  max_agents: z.number().int().optional(),
  max_monthly_conversations: z.number().int().optional(),
  price: z.number().optional(),
  currency: z.string().optional(),
  commission_rate: z.number().optional(),
  features: z.record(z.string(), z.boolean()).optional(),
  created_at: z.string(),
  updated_at: z.string(),
}).refine(
  (data) => new Date(data.current_period_start) < new Date(data.current_period_end),
  { 
    message: 'La fecha de inicio debe ser anterior a la fecha de fin',
    path: ['current_period_end'],
  }
)

export type Subscription = z.infer<typeof SubscriptionSchema>

// Schema base de suscripción sin refinement (para extensión)
const SubscriptionBaseSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  plan_id: z.string().uuid(),
  status: SubscriptionStatusEnum,
  current_period_start: z.string(),
  current_period_end: z.string(),
  cancel_at_period_end: z.boolean(),
  provider_subscription_id: z.string().nullable(),
  provider_customer_id: z.string().nullable(),
  max_products: z.number().int().optional(),
  max_agents: z.number().int().optional(),
  max_monthly_conversations: z.number().int().optional(),
  price: z.number().optional(),
  currency: z.string().optional(),
  commission_rate: z.number().optional(),
  features: z.record(z.string(), z.boolean()).optional(),
  created_at: z.string(),
  updated_at: z.string(),
})

// Schema para suscripción con datos de organización (para listados)
export const SubscriptionWithOrgSchema = SubscriptionBaseSchema.extend({
  organization: z.object({
    id: z.string().uuid(),
    name: z.string(),
    subdomain: z.string(),
  }).optional(),
  plan: z.object({
    id: z.string().uuid(),
    name: z.string(),
    price: z.number(),
  }).optional(),
})

export type SubscriptionWithOrg = z.infer<typeof SubscriptionWithOrgSchema>

// Schema para crear suscripción
export const CreateSubscriptionInputSchema = z.object({
  organization_id: z.string().uuid(),
  plan_id: z.string().uuid(),
  status: SubscriptionStatusEnum.default('incomplete'),
  current_period_start: z.string().optional(),
  current_period_end: z.string().optional(),
})

export type CreateSubscriptionInput = z.infer<typeof CreateSubscriptionInputSchema>

// Schema para actualizar suscripción
export const UpdateSubscriptionInputSchema = z.object({
  status: SubscriptionStatusEnum.optional(),
  plan_id: z.string().uuid().optional(),
  cancel_at_period_end: z.boolean().optional(),
  current_period_start: z.string().optional(),
  current_period_end: z.string().optional(),
  provider_subscription_id: z.string().nullable().optional(),
  provider_customer_id: z.string().nullable().optional(),
})

export type UpdateSubscriptionInput = z.infer<typeof UpdateSubscriptionInputSchema>

// Schema de Transacción de Pago
export const PaymentTransactionSchema = z.object({
  id: z.string().uuid(),
  subscription_id: z.string().uuid().nullable(),
  amount: z.number().positive(),
  currency: z.string(),
  status: PaymentStatusEnum,
  provider: z.literal('wompi'),
  provider_transaction_id: z.string().nullable(),
  provider_response: z.record(z.string(), z.unknown()).nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  created_at: z.string(),
  updated_at: z.string(),
})

export type PaymentTransaction = z.infer<typeof PaymentTransactionSchema>

// Schema para crear transacción
export const CreatePaymentTransactionInputSchema = z.object({
  subscription_id: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().default('COP'),
  status: PaymentStatusEnum.default('pending'),
  provider: z.literal('wompi').default('wompi'),
  provider_transaction_id: z.string().nullable().optional(),
  provider_response: z.record(z.string(), z.unknown()).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type CreatePaymentTransactionInput = z.infer<typeof CreatePaymentTransactionInputSchema>

// Schema para métricas de suscripciones
export const SubscriptionMetricsSchema = z.object({
  total_subscriptions: z.number().int(),
  active_subscriptions: z.number().int(),
  mrr: z.number(), // Monthly Recurring Revenue
  mrr_currency: z.string(),
  subscriptions_by_plan: z.array(z.object({
    plan_id: z.string(),
    plan_name: z.string(),
    count: z.number().int(),
  })),
  subscriptions_by_status: z.array(z.object({
    status: SubscriptionStatusEnum,
    count: z.number().int(),
  })),
})

export type SubscriptionMetrics = z.infer<typeof SubscriptionMetricsSchema>

// Schema para filtros de suscripciones (todos opcionales con defaults)
export const SubscriptionFiltersSchema = z.object({
  status: SubscriptionStatusEnum.optional(),
  plan_id: z.string().uuid().optional(),
  search: z.string().optional(),
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().positive().max(100).optional().default(10),
}).partial()

export type SubscriptionFilters = z.infer<typeof SubscriptionFiltersSchema>

// Funciones helper

/**
 * Valida que las fechas de período sean coherentes
 */
export function validatePeriodDates(start: string, end: string): boolean {
  return new Date(start) < new Date(end)
}

/**
 * Calcula el porcentaje de uso de un recurso
 */
export function calculateUsagePercentage(usage: number, limit: number): number {
  if (limit <= 0) return 0
  return (usage / limit) * 100
}

/**
 * Verifica si un recurso está dentro del límite
 */
export function checkResourceLimit(usage: number, limit: number): boolean {
  return usage <= limit
}

/**
 * Determina si se debe mostrar alerta de uso alto (>80%)
 */
export function shouldShowUsageAlert(usage: number, limit: number): boolean {
  const percentage = calculateUsagePercentage(usage, limit)
  return percentage >= 80
}
