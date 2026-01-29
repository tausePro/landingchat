"use server"

import { createServiceClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import {
    type ActionResult,
    success,
    failure,
    type FoundingProgram,
    type FoundingTier,
    type FoundingSlot,
    type FoundingSlotWithRelations,
    type FoundingActivity,
    type UpdateFoundingProgramInput,
    type CreateFoundingTierInput,
    type UpdateFoundingTierInput,
    type FoundingMetrics,
    UpdateFoundingProgramInputSchema,
    CreateFoundingTierInputSchema,
    UpdateFoundingTierInputSchema,
    calculateCurrentPrice,
    anonymizeNameForFeed,
} from "@/types"

// =============================================================================
// PROGRAM ACTIONS
// =============================================================================

/**
 * Obtiene el programa de founding (solo hay uno)
 */
export async function getFoundingProgram(): Promise<ActionResult<FoundingProgram | null>> {
    try {
        const supabase = createServiceClient()

        const { data, error } = await supabase
            .from("founding_program")
            .select("*")
            .limit(1)
            .single()

        if (error) {
            if (error.code === "PGRST116") {
                return success(null)
            }
            console.error("[getFoundingProgram] Error:", error)
            return failure("Error al obtener el programa")
        }

        return success(data as FoundingProgram)
    } catch (error) {
        console.error("[getFoundingProgram] Error:", error)
        return failure("Error inesperado")
    }
}

/**
 * Actualiza la configuración del programa
 */
export async function updateFoundingProgram(
    programId: string,
    input: UpdateFoundingProgramInput
): Promise<ActionResult<FoundingProgram>> {
    try {
        const validation = UpdateFoundingProgramInputSchema.safeParse(input)
        if (!validation.success) {
            return failure("Datos inválidos: " + validation.error.message)
        }

        const supabase = createServiceClient()

        const { data, error } = await supabase
            .from("founding_program")
            .update({
                ...validation.data,
                updated_at: new Date().toISOString(),
            })
            .eq("id", programId)
            .select()
            .single()

        if (error) {
            console.error("[updateFoundingProgram] Error:", error)
            return failure("Error al actualizar el programa")
        }

        revalidatePath("/admin/founding")
        revalidatePath("/founding") // Landing pública
        return success(data as FoundingProgram)
    } catch (error) {
        console.error("[updateFoundingProgram] Error:", error)
        return failure("Error inesperado")
    }
}

/**
 * Activa o desactiva el programa
 */
export async function toggleFoundingProgram(
    programId: string,
    isActive: boolean
): Promise<ActionResult<FoundingProgram>> {
    return updateFoundingProgram(programId, {
        is_active: isActive,
        starts_at: isActive ? new Date().toISOString() : null,
    })
}

// =============================================================================
// TIER ACTIONS
// =============================================================================

/**
 * Obtiene todos los tiers de un programa
 */
export async function getFoundingTiers(
    programId: string
): Promise<ActionResult<FoundingTier[]>> {
    try {
        const supabase = createServiceClient()

        const { data, error } = await supabase
            .from("founding_tiers")
            .select("*")
            .eq("program_id", programId)
            .order("display_order", { ascending: true })

        if (error) {
            console.error("[getFoundingTiers] Error:", error)
            return failure("Error al obtener los tiers")
        }

        return success((data || []) as FoundingTier[])
    } catch (error) {
        console.error("[getFoundingTiers] Error:", error)
        return failure("Error inesperado")
    }
}

/**
 * Obtiene tiers con estadísticas (cupos restantes, precio actual)
 */
export async function getFoundingTiersWithStats(
    programId: string
): Promise<ActionResult<Array<FoundingTier & { slots_remaining: number; slots_claimed: number; current_price: number }>>> {
    try {
        const supabase = createServiceClient()

        // Obtener programa
        const { data: program } = await supabase
            .from("founding_program")
            .select("*")
            .eq("id", programId)
            .single()

        if (!program) {
            return failure("Programa no encontrado")
        }

        // Obtener tiers
        const { data: tiers, error } = await supabase
            .from("founding_tiers")
            .select("*")
            .eq("program_id", programId)
            .order("display_order", { ascending: true })

        if (error) {
            console.error("[getFoundingTiersWithStats] Error:", error)
            return failure("Error al obtener los tiers")
        }

        // Obtener conteo de slots por tier
        const { data: slotCounts } = await supabase
            .from("founding_slots")
            .select("tier_id")
            .eq("program_id", programId)
            .in("status", ["reserved", "active"])

        const claimedByTier: Record<string, number> = {}
        if (slotCounts) {
            slotCounts.forEach((slot) => {
                claimedByTier[slot.tier_id] = (claimedByTier[slot.tier_id] || 0) + 1
            })
        }

        // Calcular estadísticas
        const tiersWithStats = (tiers || []).map((tier) => {
            const claimed = claimedByTier[tier.id] || 0
            const remaining = tier.total_slots - claimed
            const currentPrice = calculateCurrentPrice(tier as FoundingTier, program as FoundingProgram)

            return {
                ...tier,
                slots_claimed: claimed,
                slots_remaining: remaining,
                current_price: currentPrice,
            }
        })

        return success(tiersWithStats as Array<FoundingTier & { slots_remaining: number; slots_claimed: number; current_price: number }>)
    } catch (error) {
        console.error("[getFoundingTiersWithStats] Error:", error)
        return failure("Error inesperado")
    }
}

/**
 * Crea un nuevo tier
 */
export async function createFoundingTier(
    input: CreateFoundingTierInput
): Promise<ActionResult<FoundingTier>> {
    try {
        const validation = CreateFoundingTierInputSchema.safeParse(input)
        if (!validation.success) {
            return failure("Datos inválidos: " + validation.error.message)
        }

        const supabase = createServiceClient()

        const { data, error } = await supabase
            .from("founding_tiers")
            .insert(validation.data)
            .select()
            .single()

        if (error) {
            console.error("[createFoundingTier] Error:", error)
            return failure("Error al crear el tier")
        }

        revalidatePath("/admin/founding")
        return success(data as FoundingTier)
    } catch (error) {
        console.error("[createFoundingTier] Error:", error)
        return failure("Error inesperado")
    }
}

/**
 * Actualiza un tier
 */
export async function updateFoundingTier(
    tierId: string,
    input: UpdateFoundingTierInput
): Promise<ActionResult<FoundingTier>> {
    try {
        const validation = UpdateFoundingTierInputSchema.safeParse(input)
        if (!validation.success) {
            return failure("Datos inválidos: " + validation.error.message)
        }

        const supabase = createServiceClient()

        // Si cambia el precio, registrar en historial
        if (input.founding_price !== undefined) {
            const { data: currentTier } = await supabase
                .from("founding_tiers")
                .select("founding_price, currency")
                .eq("id", tierId)
                .single()

            if (currentTier && currentTier.founding_price !== input.founding_price) {
                await supabase.from("founding_price_history").insert({
                    tier_id: tierId,
                    price: input.founding_price,
                    currency: input.currency || currentTier.currency,
                    reason: "manual_adjustment",
                })
            }
        }

        const { data, error } = await supabase
            .from("founding_tiers")
            .update({
                ...validation.data,
                updated_at: new Date().toISOString(),
            })
            .eq("id", tierId)
            .select()
            .single()

        if (error) {
            console.error("[updateFoundingTier] Error:", error)
            return failure("Error al actualizar el tier")
        }

        revalidatePath("/admin/founding")
        return success(data as FoundingTier)
    } catch (error) {
        console.error("[updateFoundingTier] Error:", error)
        return failure("Error inesperado")
    }
}

/**
 * Elimina un tier (solo si no tiene slots)
 */
export async function deleteFoundingTier(
    tierId: string
): Promise<ActionResult<void>> {
    try {
        const supabase = createServiceClient()

        // Verificar que no tenga slots
        const { count } = await supabase
            .from("founding_slots")
            .select("*", { count: "exact", head: true })
            .eq("tier_id", tierId)

        if (count && count > 0) {
            return failure("No se puede eliminar un tier que ya tiene slots asignados")
        }

        const { error } = await supabase
            .from("founding_tiers")
            .delete()
            .eq("id", tierId)

        if (error) {
            console.error("[deleteFoundingTier] Error:", error)
            return failure("Error al eliminar el tier")
        }

        revalidatePath("/admin/founding")
        return success(undefined)
    } catch (error) {
        console.error("[deleteFoundingTier] Error:", error)
        return failure("Error inesperado")
    }
}

// =============================================================================
// SLOT ACTIONS
// =============================================================================

/**
 * Obtiene todos los slots con relaciones
 */
export async function getFoundingSlots(
    programId: string,
    filters?: { status?: string; tier_id?: string }
): Promise<ActionResult<FoundingSlotWithRelations[]>> {
    try {
        const supabase = createServiceClient()

        let query = supabase
            .from("founding_slots")
            .select(`
                *,
                tier:founding_tiers(id, name, slug, founding_price),
                organization:organizations(id, name, subdomain)
            `)
            .eq("program_id", programId)
            .order("slot_number", { ascending: true })

        if (filters?.status) {
            query = query.eq("status", filters.status)
        }
        if (filters?.tier_id) {
            query = query.eq("tier_id", filters.tier_id)
        }

        const { data, error } = await query

        if (error) {
            console.error("[getFoundingSlots] Error:", error)
            return failure("Error al obtener los slots")
        }

        return success((data || []) as FoundingSlotWithRelations[])
    } catch (error) {
        console.error("[getFoundingSlots] Error:", error)
        return failure("Error inesperado")
    }
}

/**
 * Actualiza el estado de un slot (admin)
 */
export async function updateFoundingSlotStatus(
    slotId: string,
    status: string
): Promise<ActionResult<FoundingSlot>> {
    try {
        const supabase = createServiceClient()

        const updateData: Record<string, unknown> = {
            status,
            updated_at: new Date().toISOString(),
        }

        if (status === "active") {
            updateData.activated_at = new Date().toISOString()
        } else if (status === "cancelled") {
            updateData.cancelled_at = new Date().toISOString()
        }

        const { data, error } = await supabase
            .from("founding_slots")
            .update(updateData)
            .eq("id", slotId)
            .select()
            .single()

        if (error) {
            console.error("[updateFoundingSlotStatus] Error:", error)
            return failure("Error al actualizar el slot")
        }

        revalidatePath("/admin/founding")
        return success(data as FoundingSlot)
    } catch (error) {
        console.error("[updateFoundingSlotStatus] Error:", error)
        return failure("Error inesperado")
    }
}

// =============================================================================
// ACTIVITY FEED ACTIONS
// =============================================================================

/**
 * Obtiene el feed de actividad reciente
 */
export async function getFoundingActivityFeed(
    programId: string,
    limit: number = 10
): Promise<ActionResult<FoundingActivity[]>> {
    try {
        const supabase = createServiceClient()

        const { data, error } = await supabase
            .from("founding_activity_feed")
            .select("*")
            .eq("program_id", programId)
            .order("created_at", { ascending: false })
            .limit(limit)

        if (error) {
            console.error("[getFoundingActivityFeed] Error:", error)
            return failure("Error al obtener el feed")
        }

        return success((data || []) as FoundingActivity[])
    } catch (error) {
        console.error("[getFoundingActivityFeed] Error:", error)
        return failure("Error inesperado")
    }
}

/**
 * Agrega una actividad al feed
 */
export async function addFoundingActivity(
    programId: string,
    activityType: string,
    displayName: string | null,
    tierName: string | null,
    message: string
): Promise<ActionResult<FoundingActivity>> {
    try {
        const supabase = createServiceClient()

        const { data, error } = await supabase
            .from("founding_activity_feed")
            .insert({
                program_id: programId,
                activity_type: activityType,
                display_name: displayName ? anonymizeNameForFeed(displayName) : null,
                tier_name: tierName,
                message,
            })
            .select()
            .single()

        if (error) {
            console.error("[addFoundingActivity] Error:", error)
            return failure("Error al agregar actividad")
        }

        return success(data as FoundingActivity)
    } catch (error) {
        console.error("[addFoundingActivity] Error:", error)
        return failure("Error inesperado")
    }
}

// =============================================================================
// METRICS
// =============================================================================

/**
 * Obtiene métricas del programa founding
 */
export async function getFoundingMetrics(
    programId: string
): Promise<ActionResult<FoundingMetrics>> {
    try {
        const supabase = createServiceClient()

        // Obtener programa
        const { data: program } = await supabase
            .from("founding_program")
            .select("total_slots")
            .eq("id", programId)
            .single()

        if (!program) {
            return failure("Programa no encontrado")
        }

        // Obtener todos los slots
        const { data: slots } = await supabase
            .from("founding_slots")
            .select(`
                id,
                tier_id,
                status,
                locked_price,
                tier:founding_tiers(id, name, founding_price, total_slots)
            `)
            .eq("program_id", programId)

        // Calcular métricas
        const slotsByStatus: Record<string, number> = {
            reserved: 0,
            active: 0,
            expired: 0,
            cancelled: 0,
            paused: 0,
        }

        const slotsByTier: Record<string, { tier_id: string; tier_name: string; total: number; claimed: number }> = {}
        let revenueCurrent = 0

        if (slots) {
            slots.forEach((slot) => {
                slotsByStatus[slot.status] = (slotsByStatus[slot.status] || 0) + 1

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const tier = slot.tier as any
                if (tier) {
                    if (!slotsByTier[tier.id]) {
                        slotsByTier[tier.id] = {
                            tier_id: tier.id,
                            tier_name: tier.name,
                            total: tier.total_slots,
                            claimed: 0,
                        }
                    }
                    if (slot.status === "active" || slot.status === "reserved") {
                        slotsByTier[tier.id].claimed++
                    }
                }

                if (slot.status === "active") {
                    revenueCurrent += slot.locked_price * 10 // Pago anual = 10 meses
                }
            })
        }

        // Calcular revenue potencial
        const { data: tiers } = await supabase
            .from("founding_tiers")
            .select("total_slots, founding_price")
            .eq("program_id", programId)

        let revenuePotential = 0
        if (tiers) {
            tiers.forEach((tier) => {
                revenuePotential += tier.total_slots * tier.founding_price * 10
            })
        }

        const slotsClaimed = slotsByStatus.active + slotsByStatus.reserved
        const slotsRemaining = program.total_slots - slotsClaimed

        // Tasa de conversión
        const totalReservedEver = slotsByStatus.active + slotsByStatus.expired + slotsByStatus.cancelled
        const conversionRate = totalReservedEver > 0
            ? (slotsByStatus.active / totalReservedEver) * 100
            : 0

        return success({
            total_slots: program.total_slots,
            slots_claimed: slotsClaimed,
            slots_remaining: slotsRemaining,
            slots_by_status: slotsByStatus as Record<string, number>,
            slots_by_tier: Object.values(slotsByTier).map((t) => ({
                ...t,
                remaining: t.total - t.claimed,
            })),
            revenue_potential: revenuePotential,
            revenue_current: revenueCurrent,
            conversion_rate: Math.round(conversionRate * 100) / 100,
        })
    } catch (error) {
        console.error("[getFoundingMetrics] Error:", error)
        return failure("Error inesperado")
    }
}

// =============================================================================
// PRICE INCREASE (para cron job)
// =============================================================================

/**
 * Aplica incremento de precio semanal a todos los tiers
 * (llamar desde cron job)
 */
export async function applyWeeklyPriceIncrease(): Promise<ActionResult<void>> {
    try {
        const supabase = createServiceClient()

        // Obtener programa activo
        const { data: program } = await supabase
            .from("founding_program")
            .select("*")
            .eq("is_active", true)
            .single()

        if (!program || !program.price_increase_enabled) {
            return success(undefined)
        }

        // Obtener todos los tiers
        const { data: tiers } = await supabase
            .from("founding_tiers")
            .select("*")
            .eq("program_id", program.id)
            .eq("is_active", true)

        if (!tiers || tiers.length === 0) {
            return success(undefined)
        }

        // Aplicar incremento a cada tier
        for (const tier of tiers) {
            let newPrice: number

            if (tier.price_increase_amount) {
                newPrice = tier.founding_price + tier.price_increase_amount
            } else {
                newPrice = tier.founding_price * (1 + program.price_increase_percentage / 100)
            }

            // No superar precio regular
            newPrice = Math.min(newPrice, tier.regular_price)

            // Actualizar tier
            await supabase
                .from("founding_tiers")
                .update({
                    founding_price: newPrice,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", tier.id)

            // Registrar en historial
            await supabase.from("founding_price_history").insert({
                tier_id: tier.id,
                price: newPrice,
                currency: tier.currency,
                reason: "weekly_increase",
            })
        }

        // Agregar al feed de actividad
        await addFoundingActivity(
            program.id,
            "price_increased",
            null,
            null,
            "¡Los precios acaban de subir! No te quedes sin tu cupo."
        )

        revalidatePath("/admin/founding")
        revalidatePath("/founding")
        return success(undefined)
    } catch (error) {
        console.error("[applyWeeklyPriceIncrease] Error:", error)
        return failure("Error al aplicar incremento")
    }
}
