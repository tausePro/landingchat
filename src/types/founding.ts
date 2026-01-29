/**
 * Types for the Founding Members / Early Adopters Program
 */

import { z } from "zod"

// =============================================================================
// ENUMS
// =============================================================================

export const FoundingSlotStatusEnum = z.enum([
    "reserved",   // Reservado durante checkout
    "active",     // Pago completado, activo
    "expired",    // Reserva expiró sin pago
    "cancelled",  // Canceló suscripción (pierde beneficio)
    "paused"      // Pausa temporal (gracia)
])
export type FoundingSlotStatus = z.infer<typeof FoundingSlotStatusEnum>

export const FoundingActivityTypeEnum = z.enum([
    "slot_claimed",     // Alguien tomó un cupo
    "price_increased",  // El precio subió
    "slots_running_low", // Quedan pocos cupos
    "tier_sold_out"     // Un tier se agotó
])
export type FoundingActivityType = z.infer<typeof FoundingActivityTypeEnum>

// =============================================================================
// SCHEMAS
// =============================================================================

// Founding Program (configuración global)
export const FoundingProgramSchema = z.object({
    id: z.string().uuid(),
    is_active: z.boolean(),
    total_slots: z.number().int().positive(),
    starts_at: z.string().nullable(),
    ends_at: z.string().nullable(),
    price_frozen_until: z.string().nullable(), // null = forever
    free_months: z.number().int().min(0).default(2),
    price_increase_enabled: z.boolean().default(true),
    price_increase_interval_days: z.number().int().positive().default(7),
    price_increase_percentage: z.number().min(0).max(100).default(5),
    hero_title: z.string(),
    hero_subtitle: z.string(),
    hero_description: z.string(),
    cta_button_text: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
})
export type FoundingProgram = z.infer<typeof FoundingProgramSchema>

// Founding Tier (nivel/plan)
export const FoundingTierSchema = z.object({
    id: z.string().uuid(),
    program_id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
    total_slots: z.number().int().positive(),
    founding_price: z.number(),
    regular_price: z.number(),
    currency: z.string().default("COP"),
    price_increase_amount: z.number().nullable(),
    max_products: z.number().int(),
    max_agents: z.number().int(),
    max_monthly_conversations: z.number().int(),
    features: z.record(z.string(), z.boolean()).default({}),
    is_popular: z.boolean().default(false),
    badge_text: z.string().nullable(),
    display_order: z.number().int().default(0),
    is_active: z.boolean().default(true),
    created_at: z.string(),
    updated_at: z.string(),
})
export type FoundingTier = z.infer<typeof FoundingTierSchema>

// Founding Tier with computed fields
export const FoundingTierWithStatsSchema = FoundingTierSchema.extend({
    slots_remaining: z.number().int(),
    slots_claimed: z.number().int(),
    current_price: z.number(), // Precio actual con incrementos
})
export type FoundingTierWithStats = z.infer<typeof FoundingTierWithStatsSchema>

// Founding Slot (registro de early adopter)
export const FoundingSlotSchema = z.object({
    id: z.string().uuid(),
    program_id: z.string().uuid(),
    tier_id: z.string().uuid(),
    organization_id: z.string().uuid().nullable(),
    slot_number: z.number().int().positive(),
    locked_price: z.number(),
    locked_currency: z.string().default("COP"),
    status: FoundingSlotStatusEnum,
    source: z.string().nullable(),
    referral_code: z.string().nullable(),
    utm_source: z.string().nullable(),
    utm_medium: z.string().nullable(),
    utm_campaign: z.string().nullable(),
    reserved_at: z.string(),
    activated_at: z.string().nullable(),
    expires_at: z.string().nullable(),
    cancelled_at: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
})
export type FoundingSlot = z.infer<typeof FoundingSlotSchema>

// Founding Slot with relations
export const FoundingSlotWithRelationsSchema = FoundingSlotSchema.extend({
    tier: FoundingTierSchema.optional(),
    organization: z.object({
        id: z.string().uuid(),
        name: z.string(),
        subdomain: z.string(),
    }).optional(),
})
export type FoundingSlotWithRelations = z.infer<typeof FoundingSlotWithRelationsSchema>

// Activity Feed
export const FoundingActivitySchema = z.object({
    id: z.string().uuid(),
    program_id: z.string().uuid(),
    activity_type: FoundingActivityTypeEnum,
    display_name: z.string().nullable(),
    tier_name: z.string().nullable(),
    message: z.string().nullable(),
    created_at: z.string(),
})
export type FoundingActivity = z.infer<typeof FoundingActivitySchema>

// Price History
export const FoundingPriceHistorySchema = z.object({
    id: z.string().uuid(),
    tier_id: z.string().uuid(),
    price: z.number(),
    currency: z.string().default("COP"),
    reason: z.string().nullable(),
    effective_from: z.string(),
    effective_until: z.string().nullable(),
    created_at: z.string(),
})
export type FoundingPriceHistory = z.infer<typeof FoundingPriceHistorySchema>

// =============================================================================
// INPUT SCHEMAS (para crear/actualizar)
// =============================================================================

// Update Program
export const UpdateFoundingProgramInputSchema = z.object({
    is_active: z.boolean().optional(),
    total_slots: z.number().int().positive().optional(),
    starts_at: z.string().nullable().optional(),
    ends_at: z.string().nullable().optional(),
    price_frozen_until: z.string().nullable().optional(),
    free_months: z.number().int().min(0).optional(),
    price_increase_enabled: z.boolean().optional(),
    price_increase_interval_days: z.number().int().positive().optional(),
    price_increase_percentage: z.number().min(0).max(100).optional(),
    hero_title: z.string().optional(),
    hero_subtitle: z.string().optional(),
    hero_description: z.string().optional(),
    cta_button_text: z.string().optional(),
})
export type UpdateFoundingProgramInput = z.infer<typeof UpdateFoundingProgramInputSchema>

// Create Tier
export const CreateFoundingTierInputSchema = z.object({
    program_id: z.string().uuid(),
    name: z.string().min(1),
    slug: z.string().min(1),
    description: z.string().nullable().optional(),
    total_slots: z.number().int().positive(),
    founding_price: z.number().positive(),
    regular_price: z.number().positive(),
    currency: z.string().default("COP"),
    price_increase_amount: z.number().nullable().optional(),
    max_products: z.number().int(),
    max_agents: z.number().int(),
    max_monthly_conversations: z.number().int(),
    features: z.record(z.string(), z.boolean()).optional(),
    is_popular: z.boolean().optional(),
    badge_text: z.string().nullable().optional(),
    display_order: z.number().int().optional(),
})
export type CreateFoundingTierInput = z.infer<typeof CreateFoundingTierInputSchema>

// Update Tier
export const UpdateFoundingTierInputSchema = CreateFoundingTierInputSchema.partial().omit({
    program_id: true,
})
export type UpdateFoundingTierInput = z.infer<typeof UpdateFoundingTierInputSchema>

// Reserve Slot
export const ReserveFoundingSlotInputSchema = z.object({
    tier_id: z.string().uuid(),
    source: z.string().optional(),
    referral_code: z.string().optional(),
    utm_source: z.string().optional(),
    utm_medium: z.string().optional(),
    utm_campaign: z.string().optional(),
})
export type ReserveFoundingSlotInput = z.infer<typeof ReserveFoundingSlotInputSchema>

// =============================================================================
// RESPONSE TYPES
// =============================================================================

// Datos públicos para la landing (sin info sensible)
export interface FoundingLandingData {
    program: {
        is_active: boolean
        total_slots: number
        slots_remaining: number
        starts_at: string | null
        ends_at: string | null
        free_months: number
        hero_title: string
        hero_subtitle: string
        hero_description: string
        cta_button_text: string
    }
    tiers: Array<{
        id: string
        name: string
        slug: string
        description: string | null
        total_slots: number
        slots_remaining: number
        founding_price: number
        current_price: number // Con incrementos aplicados
        regular_price: number
        currency: string
        max_products: number
        max_agents: number
        max_monthly_conversations: number
        features: Record<string, boolean>
        is_popular: boolean
        badge_text: string | null
    }>
    activity_feed: Array<{
        id: string
        activity_type: FoundingActivityType
        display_name: string | null
        tier_name: string | null
        message: string | null
        created_at: string
    }>
}

// Métricas para admin
export interface FoundingMetrics {
    total_slots: number
    slots_claimed: number
    slots_remaining: number
    slots_by_status: Record<FoundingSlotStatus, number>
    slots_by_tier: Array<{
        tier_id: string
        tier_name: string
        total: number
        claimed: number
        remaining: number
    }>
    revenue_potential: number // Si todos los slots se llenan
    revenue_current: number // De los slots activos
    conversion_rate: number // reserved -> active
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calcula el precio actual de un tier considerando incrementos semanales
 */
export function calculateCurrentPrice(
    tier: FoundingTier,
    program: FoundingProgram
): number {
    if (!program.price_increase_enabled || !program.starts_at) {
        return tier.founding_price
    }

    const startDate = new Date(program.starts_at)
    const now = new Date()
    const daysPassed = Math.max(0, Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)))
    const intervalsPassed = Math.floor(daysPassed / program.price_increase_interval_days)

    let priceIncrease: number
    if (tier.price_increase_amount !== null) {
        // Usar incremento fijo del tier
        priceIncrease = tier.price_increase_amount * intervalsPassed
    } else {
        // Usar porcentaje del programa
        priceIncrease = tier.founding_price * (program.price_increase_percentage / 100) * intervalsPassed
    }

    const currentPrice = tier.founding_price + priceIncrease

    // No superar el precio regular
    return Math.min(currentPrice, tier.regular_price)
}

/**
 * Calcula el precio anual (pagan 10 meses, obtienen 12)
 */
export function calculateAnnualPrice(
    monthlyPrice: number,
    freeMonths: number = 2
): { totalPrice: number; monthsPaid: number; monthsTotal: number; savings: number } {
    const monthsPaid = 12 - freeMonths
    const monthsTotal = 12
    const totalPrice = monthlyPrice * monthsPaid
    const savings = monthlyPrice * freeMonths

    return {
        totalPrice,
        monthsPaid,
        monthsTotal,
        savings,
    }
}

/**
 * Formatea el precio en COP
 */
export function formatFoundingPrice(price: number, currency: string = "COP"): string {
    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(price)
}

/**
 * Genera un nombre anonimizado para el activity feed
 */
export function anonymizeNameForFeed(fullName: string): string {
    const parts = fullName.trim().split(" ")
    if (parts.length === 0) return "Usuario"

    const firstName = parts[0]
    const lastInitial = parts.length > 1 ? parts[parts.length - 1][0] + "." : ""

    return `${firstName} ${lastInitial}`.trim()
}
