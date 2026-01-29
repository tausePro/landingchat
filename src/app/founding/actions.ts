"use server"

import { createServiceClient } from "@/lib/supabase/server"
import {
    type ActionResult,
    success,
    failure,
    type FoundingLandingData,
    calculateCurrentPrice,
    anonymizeNameForFeed,
} from "@/types"

/**
 * Obtiene los datos públicos del programa founding para la landing
 */
export async function getFoundingLandingData(): Promise<ActionResult<FoundingLandingData | null>> {
    try {
        const supabase = createServiceClient()

        // Obtener programa activo
        const { data: program, error: programError } = await supabase
            .from("founding_program")
            .select("*")
            .eq("is_active", true)
            .limit(1)
            .single()

        if (programError || !program) {
            // Programa no activo o no existe
            return success(null)
        }

        // Obtener tiers activos
        const { data: tiers, error: tiersError } = await supabase
            .from("founding_tiers")
            .select("*")
            .eq("program_id", program.id)
            .eq("is_active", true)
            .order("display_order", { ascending: true })

        if (tiersError) {
            console.error("[getFoundingLandingData] Error fetching tiers:", tiersError)
            return failure("Error al cargar los planes")
        }

        // Obtener conteo de slots por tier
        const { data: slotCounts } = await supabase
            .from("founding_slots")
            .select("tier_id")
            .eq("program_id", program.id)
            .in("status", ["reserved", "active"])

        const claimedByTier: Record<string, number> = {}
        let totalClaimed = 0
        if (slotCounts) {
            slotCounts.forEach((slot) => {
                claimedByTier[slot.tier_id] = (claimedByTier[slot.tier_id] || 0) + 1
                totalClaimed++
            })
        }

        // Obtener activity feed reciente
        const { data: activities } = await supabase
            .from("founding_activity_feed")
            .select("*")
            .eq("program_id", program.id)
            .order("created_at", { ascending: false })
            .limit(5)

        // Construir respuesta
        const landingData: FoundingLandingData = {
            program: {
                is_active: program.is_active,
                total_slots: program.total_slots,
                slots_remaining: program.total_slots - totalClaimed,
                starts_at: program.starts_at,
                ends_at: program.ends_at,
                free_months: program.free_months,
                hero_title: program.hero_title,
                hero_subtitle: program.hero_subtitle,
                hero_description: program.hero_description,
                cta_button_text: program.cta_button_text,
            },
            tiers: (tiers || []).map((tier) => {
                const claimed = claimedByTier[tier.id] || 0
                const currentPrice = calculateCurrentPrice(tier, program)

                return {
                    id: tier.id,
                    name: tier.name,
                    slug: tier.slug,
                    description: tier.description,
                    total_slots: tier.total_slots,
                    slots_remaining: tier.total_slots - claimed,
                    founding_price: tier.founding_price,
                    current_price: currentPrice,
                    regular_price: tier.regular_price,
                    currency: tier.currency,
                    max_products: tier.max_products,
                    max_agents: tier.max_agents,
                    max_monthly_conversations: tier.max_monthly_conversations,
                    features: tier.features || {},
                    is_popular: tier.is_popular,
                    badge_text: tier.badge_text,
                }
            }),
            activity_feed: (activities || []).map((activity) => ({
                id: activity.id,
                activity_type: activity.activity_type,
                display_name: activity.display_name,
                tier_name: activity.tier_name,
                message: activity.message,
                created_at: activity.created_at,
            })),
        }

        return success(landingData)
    } catch (error) {
        console.error("[getFoundingLandingData] Error:", error)
        return failure("Error inesperado")
    }
}

/**
 * Reserva un slot de founding member (antes del pago)
 * Retorna datos para el checkout
 */
export async function reserveFoundingSlot(
    tierId: string,
    source?: string,
    utmParams?: { utm_source?: string; utm_medium?: string; utm_campaign?: string }
): Promise<ActionResult<{
    slot_id: string
    slot_number: number
    tier_name: string
    locked_price: number
    annual_price: number
    currency: string
    expires_at: string
}>> {
    try {
        const supabase = createServiceClient()

        // Obtener programa y tier
        const { data: tier } = await supabase
            .from("founding_tiers")
            .select(`
                *,
                program:founding_program(*)
            `)
            .eq("id", tierId)
            .eq("is_active", true)
            .single()

        if (!tier || !tier.program) {
            return failure("Plan no disponible")
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const program = tier.program as any
        if (!program.is_active) {
            return failure("El programa de founding no está activo")
        }

        // Verificar cupos disponibles en este tier
        const { count: claimedCount } = await supabase
            .from("founding_slots")
            .select("*", { count: "exact", head: true })
            .eq("tier_id", tierId)
            .in("status", ["reserved", "active"])

        if ((claimedCount || 0) >= tier.total_slots) {
            return failure("No quedan cupos disponibles en este plan")
        }

        // Verificar cupos totales del programa
        const { count: totalClaimedCount } = await supabase
            .from("founding_slots")
            .select("*", { count: "exact", head: true })
            .eq("program_id", program.id)
            .in("status", ["reserved", "active"])

        if ((totalClaimedCount || 0) >= program.total_slots) {
            return failure("Se agotaron todos los cupos del programa")
        }

        // Calcular precio actual
        const currentPrice = calculateCurrentPrice(tier, program)

        // Calcular siguiente número de slot
        const { data: maxSlot } = await supabase
            .from("founding_slots")
            .select("slot_number")
            .eq("program_id", program.id)
            .order("slot_number", { ascending: false })
            .limit(1)
            .single()

        const slotNumber = (maxSlot?.slot_number || 0) + 1

        // Crear reserva (expira en 30 minutos)
        const expiresAt = new Date()
        expiresAt.setMinutes(expiresAt.getMinutes() + 30)

        const { data: slot, error: insertError } = await supabase
            .from("founding_slots")
            .insert({
                program_id: program.id,
                tier_id: tierId,
                slot_number: slotNumber,
                locked_price: currentPrice,
                locked_currency: tier.currency,
                status: "reserved",
                source: source || "landing",
                utm_source: utmParams?.utm_source,
                utm_medium: utmParams?.utm_medium,
                utm_campaign: utmParams?.utm_campaign,
                expires_at: expiresAt.toISOString(),
            })
            .select()
            .single()

        if (insertError) {
            console.error("[reserveFoundingSlot] Insert error:", insertError)
            return failure("Error al reservar cupo")
        }

        // Calcular precio anual (pagan 10 meses)
        const monthsPaid = 12 - program.free_months
        const annualPrice = currentPrice * monthsPaid

        return success({
            slot_id: slot.id,
            slot_number: slotNumber,
            tier_name: tier.name,
            locked_price: currentPrice,
            annual_price: annualPrice,
            currency: tier.currency,
            expires_at: expiresAt.toISOString(),
        })
    } catch (error) {
        console.error("[reserveFoundingSlot] Error:", error)
        return failure("Error inesperado")
    }
}

/**
 * Activa un slot después de pago exitoso
 */
export async function activateFoundingSlot(
    slotId: string,
    organizationId: string,
    orgName?: string
): Promise<ActionResult<void>> {
    try {
        const supabase = createServiceClient()

        // Obtener slot con tier y programa
        const { data: slot } = await supabase
            .from("founding_slots")
            .select(`
                *,
                tier:founding_tiers(name)
            `)
            .eq("id", slotId)
            .single()

        if (!slot) {
            return failure("Slot no encontrado")
        }

        if (slot.status !== "reserved") {
            return failure("El slot no está en estado reservado")
        }

        // Verificar que no haya expirado
        if (slot.expires_at && new Date(slot.expires_at) < new Date()) {
            // Marcar como expirado
            await supabase
                .from("founding_slots")
                .update({ status: "expired" })
                .eq("id", slotId)

            return failure("La reserva ha expirado")
        }

        // Activar slot
        const { error: updateError } = await supabase
            .from("founding_slots")
            .update({
                organization_id: organizationId,
                status: "active",
                activated_at: new Date().toISOString(),
                expires_at: null,
            })
            .eq("id", slotId)

        if (updateError) {
            console.error("[activateFoundingSlot] Update error:", updateError)
            return failure("Error al activar slot")
        }

        // Agregar al activity feed
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tierName = (slot.tier as any)?.name || "Founding"
        const displayName = orgName ? anonymizeNameForFeed(orgName) : `Empresa #${slot.slot_number}`

        await supabase.from("founding_activity_feed").insert({
            program_id: slot.program_id,
            activity_type: "slot_claimed",
            display_name: displayName,
            tier_name: tierName,
            message: `${displayName} acaba de asegurar su cupo como Founding Member`,
        })

        return success(undefined)
    } catch (error) {
        console.error("[activateFoundingSlot] Error:", error)
        return failure("Error inesperado")
    }
}

/**
 * Verifica si hay cupos disponibles (para mostrar/ocultar CTA)
 */
export async function checkFoundingAvailability(): Promise<ActionResult<{
    is_available: boolean
    slots_remaining: number
    message?: string
}>> {
    try {
        const supabase = createServiceClient()

        // Obtener programa activo
        const { data: program } = await supabase
            .from("founding_program")
            .select("id, is_active, total_slots, ends_at")
            .eq("is_active", true)
            .limit(1)
            .single()

        if (!program) {
            return success({
                is_available: false,
                slots_remaining: 0,
                message: "El programa de founding no está activo",
            })
        }

        // Verificar fecha de fin
        if (program.ends_at && new Date(program.ends_at) < new Date()) {
            return success({
                is_available: false,
                slots_remaining: 0,
                message: "El programa de founding ha finalizado",
            })
        }

        // Contar slots disponibles
        const { count: claimedCount } = await supabase
            .from("founding_slots")
            .select("*", { count: "exact", head: true })
            .eq("program_id", program.id)
            .in("status", ["reserved", "active"])

        const slotsRemaining = program.total_slots - (claimedCount || 0)

        return success({
            is_available: slotsRemaining > 0,
            slots_remaining: slotsRemaining,
            message: slotsRemaining <= 10 ? `¡Solo quedan ${slotsRemaining} cupos!` : undefined,
        })
    } catch (error) {
        console.error("[checkFoundingAvailability] Error:", error)
        return failure("Error al verificar disponibilidad")
    }
}
