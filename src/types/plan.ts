/**
 * Tipos y schemas Zod para Planes de Suscripción
 * Feature: plan-subscription-management
 */

import { z } from 'zod'

// Enums
export const CurrencyEnum = z.enum(['COP', 'USD'])
export type Currency = z.infer<typeof CurrencyEnum>

export const BillingPeriodEnum = z.enum(['monthly', 'yearly'])
export type BillingPeriod = z.infer<typeof BillingPeriodEnum>

// Features schema (flexible key-value para features del plan)
export const PlanFeaturesSchema = z.record(z.string(), z.boolean()).default({})
export type PlanFeatures = z.infer<typeof PlanFeaturesSchema>

// Validador para límites: positivo o -1 (ilimitado)
const limitSchema = z.number().int().refine(
  (n) => n === -1 || n > 0,
  { message: 'Debe ser un número positivo o -1 (ilimitado)' }
)

// Schema principal de Plan
export const PlanSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'El nombre es requerido').max(100, 'El nombre no puede exceder 100 caracteres'),
  slug: z.string().min(1, 'El slug es requerido').max(50, 'El slug no puede exceder 50 caracteres')
    .regex(/^[a-z0-9-]+$/, 'El slug solo puede contener letras minúsculas, números y guiones'),
  description: z.string().nullable(),
  price: z.number().min(0, 'El precio debe ser mayor o igual a 0'),
  currency: CurrencyEnum,
  billing_period: BillingPeriodEnum,
  max_products: limitSchema,
  max_agents: limitSchema,
  max_monthly_conversations: limitSchema,
  features: PlanFeaturesSchema,
  is_active: z.boolean(),
  // Campos de precio anual
  yearly_price: z.number().nullable().optional(),
  yearly_discount_months: z.number().int().min(0).nullable().optional(),
  // Vínculo con founding tiers
  founding_tier_slug: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
})

export type Plan = z.infer<typeof PlanSchema>

// Schema para crear un plan (sin id ni timestamps)
export const CreatePlanInputSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(100),
  slug: z.string().min(1, 'El slug es requerido').max(50)
    .regex(/^[a-z0-9-]+$/, 'El slug solo puede contener letras minúsculas, números y guiones'),
  description: z.string().nullable().optional(),
  price: z.number().min(0, 'El precio debe ser mayor o igual a 0'),
  currency: CurrencyEnum.default('COP'),
  billing_period: BillingPeriodEnum.default('monthly'),
  max_products: limitSchema.default(100),
  max_agents: limitSchema.default(1),
  max_monthly_conversations: limitSchema.default(500),
  features: PlanFeaturesSchema.optional(),
  is_active: z.boolean().default(true),
  yearly_price: z.number().nullable().optional(),
  yearly_discount_months: z.number().int().min(0).nullable().optional(),
  founding_tier_slug: z.string().nullable().optional(),
})

export type CreatePlanInput = z.infer<typeof CreatePlanInputSchema>

// Schema para actualizar un plan (todos los campos opcionales excepto id)
export const UpdatePlanInputSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(50)
    .regex(/^[a-z0-9-]+$/, 'El slug solo puede contener letras minúsculas, números y guiones')
    .optional(),
  description: z.string().nullable().optional(),
  price: z.number().min(0).optional(),
  currency: CurrencyEnum.optional(),
  billing_period: BillingPeriodEnum.optional(),
  max_products: limitSchema.optional(),
  max_agents: limitSchema.optional(),
  max_monthly_conversations: limitSchema.optional(),
  features: PlanFeaturesSchema.optional(),
  is_active: z.boolean().optional(),
  yearly_price: z.number().nullable().optional(),
  yearly_discount_months: z.number().int().min(0).nullable().optional(),
  founding_tier_slug: z.string().nullable().optional(),
})

export type UpdatePlanInput = z.infer<typeof UpdatePlanInputSchema>

// Schema para validar precio positivo (para property testing)
export const PositivePriceSchema = z.number().positive('El precio debe ser mayor a 0')

// Función helper para serializar plan a formato de base de datos
export function serializePlanForDb(plan: CreatePlanInput): Record<string, unknown> {
  return {
    name: plan.name,
    slug: plan.slug,
    description: plan.description ?? null,
    price: plan.price,
    currency: plan.currency ?? 'COP',
    billing_period: plan.billing_period ?? 'monthly',
    max_products: plan.max_products ?? 100,
    max_agents: plan.max_agents ?? 1,
    max_monthly_conversations: plan.max_monthly_conversations ?? 500,
    features: plan.features ?? {},
    is_active: plan.is_active ?? true,
    yearly_price: plan.yearly_price ?? null,
    yearly_discount_months: plan.yearly_discount_months ?? null,
    founding_tier_slug: plan.founding_tier_slug ?? null,
  }
}

// Función helper para deserializar plan desde base de datos
export function deserializePlanFromDb(dbRow: Record<string, unknown>): Plan {
  // La DB puede tener 'interval' o 'billing_period'
  const billingPeriod = (dbRow.billing_period || dbRow.interval || 'monthly') as string
  
  return PlanSchema.parse({
    id: dbRow.id,
    name: dbRow.name,
    slug: dbRow.slug || generateSlugFromName(dbRow.name as string),
    description: dbRow.description,
    price: Number(dbRow.price || 0),
    currency: dbRow.currency || 'COP',
    billing_period: billingPeriod === 'yearly' ? 'yearly' : 'monthly',
    max_products: dbRow.max_products ?? 100,
    max_agents: dbRow.max_agents ?? 1,
    max_monthly_conversations: dbRow.max_monthly_conversations ?? 500,
    features: dbRow.features ?? {},
    is_active: dbRow.is_active ?? dbRow.is_public ?? true,
    yearly_price: dbRow.yearly_price ? Number(dbRow.yearly_price) : null,
    yearly_discount_months: dbRow.yearly_discount_months ?? null,
    founding_tier_slug: dbRow.founding_tier_slug ?? null,
    created_at: dbRow.created_at || new Date().toISOString(),
    updated_at: dbRow.updated_at || new Date().toISOString(),
  })
}

// Helper para generar slug desde nombre
function generateSlugFromName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}
