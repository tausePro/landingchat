"use server"

import { createServiceClient } from "@/lib/supabase/server"
import {
    type ActionResult,
    success,
    failure,
    anonymizeNameForFeed,
} from "@/types"

interface PaymentVerificationResult {
    status: string
    status_message: string
    slot_number?: number
    tier_name?: string
}

/**
 * Verifica el estado de un pago de Wompi y activa el slot si fue aprobado
 */
export async function verifyFoundingPayment(
    transactionId: string,
    slotId?: string
): Promise<ActionResult<PaymentVerificationResult>> {
    try {
        const supabase = createServiceClient()

        // Obtener configuración de Wompi
        const { data: wompiConfig } = await supabase
            .from("system_settings")
            .select("value")
            .eq("key", "platform_wompi_config")
            .single()

        if (!wompiConfig?.value) {
            return failure("Configuración de pagos no encontrada")
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const config = wompiConfig.value as any
        const isSandbox = config.is_sandbox
        const baseUrl = isSandbox
            ? "https://sandbox.wompi.co/v1"
            : "https://production.wompi.co/v1"

        // Consultar transacción en Wompi
        const response = await fetch(`${baseUrl}/transactions/${transactionId}`, {
            headers: {
                "Authorization": `Bearer ${isSandbox ? config.sandbox_private_key : config.production_private_key}`,
            },
        })

        if (!response.ok) {
            console.error("[verifyFoundingPayment] Wompi API error:", response.status)
            return failure("Error al verificar la transacción")
        }

        const txData = await response.json()
        const tx = txData.data

        console.log("[verifyFoundingPayment] Transaction status:", tx.status, "Reference:", tx.reference)

        // Obtener slot por referencia
        let slot
        if (slotId) {
            const { data } = await supabase
                .from("founding_slots")
                .select(`
                    *,
                    tier:founding_tiers(id, name, slug, max_products, max_agents, max_monthly_conversations, features),
                    program:founding_program(id, free_months),
                    organization:organizations(id, name)
                `)
                .eq("id", slotId)
                .single()
            slot = data
        }

        // Si no encontramos por ID, buscar por referencia
        if (!slot && tx.reference) {
            // La referencia tiene formato: founding_{slotId}_{timestamp}
            const refParts = tx.reference.split("_")
            if (refParts.length >= 2 && refParts[0] === "founding") {
                const extractedSlotId = refParts[1]
                const { data } = await supabase
                    .from("founding_slots")
                    .select(`
                        *,
                        tier:founding_tiers(id, name, slug, max_products, max_agents, max_monthly_conversations, features),
                        program:founding_program(id, free_months),
                        organization:organizations(id, name)
                    `)
                    .eq("id", extractedSlotId)
                    .single()
                slot = data
            }
        }

        if (!slot) {
            return failure("Slot no encontrado")
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tier = slot.tier as any
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const program = slot.program as any
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const organization = slot.organization as any

        // Procesar según estado de la transacción
        if (tx.status === "APPROVED") {
            // Solo activar si no está ya activo
            if (slot.status !== "active") {
                // 1. Activar el slot
                await supabase
                    .from("founding_slots")
                    .update({
                        status: "active",
                        activated_at: new Date().toISOString(),
                        expires_at: null,
                    })
                    .eq("id", slot.id)

                // 2. Buscar el plan regular correspondiente al founding tier (por slug)
                const tierSlug = tier?.slug || tier?.name?.toLowerCase() || "starter"
                const { data: matchingPlan } = await supabase
                    .from("plans")
                    .select("id")
                    .eq("founding_tier_slug", tierSlug)
                    .eq("is_active", true)
                    .limit(1)
                    .single()

                // 3. Crear suscripción con precio congelado vinculada al plan correcto
                const now = new Date()
                const periodEnd = new Date(now)
                periodEnd.setFullYear(periodEnd.getFullYear() + 1) // 1 año

                const { data: newSub } = await supabase
                    .from("subscriptions")
                    .upsert({
                        organization_id: slot.organization_id,
                        plan_id: matchingPlan?.id || null,
                        status: "active",
                        current_period_start: now.toISOString(),
                        current_period_end: periodEnd.toISOString(),
                        cancel_at_period_end: false,
                        currency: slot.locked_currency || "COP",
                        price: slot.locked_price, // Precio congelado del founding
                        max_products: tier?.max_products || 100,
                        max_agents: tier?.max_agents || 1,
                        max_monthly_conversations: tier?.max_monthly_conversations || 500,
                        features: tier?.features || {},
                    }, {
                        onConflict: "organization_id",
                    })
                    .select("id")
                    .single()

                // 4. Registrar transacción vinculada a la suscripción
                await supabase
                    .from("payment_transactions")
                    .insert({
                        subscription_id: newSub?.id || null,
                        organization_id: slot.organization_id,
                        amount: tx.amount_in_cents / 100,
                        currency: tx.currency,
                        status: "approved",
                        provider: "wompi",
                        provider_transaction_id: tx.id,
                        provider_reference: tx.reference,
                        provider_response: tx,
                        payment_method: tx.payment_method_type,
                        completed_at: new Date().toISOString(),
                    })

                // 5. Agregar al activity feed
                const displayName = organization?.name
                    ? anonymizeNameForFeed(organization.name)
                    : `Empresa #${slot.slot_number}`

                await supabase.from("founding_activity_feed").insert({
                    program_id: program?.id || slot.program_id,
                    activity_type: "slot_claimed",
                    display_name: displayName,
                    tier_name: tier?.name || "Founding",
                    message: `${displayName} acaba de asegurar su cupo como Founding Member`,
                })

                console.log(`[verifyFoundingPayment] Activated slot #${slot.slot_number} for org ${slot.organization_id}, plan_id: ${matchingPlan?.id}`)
            }

            return success({
                status: "APPROVED",
                status_message: "Pago aprobado",
                slot_number: slot.slot_number,
                tier_name: tier?.name || "Founding",
            })
        } else if (tx.status === "PENDING") {
            return success({
                status: "PENDING",
                status_message: "Pago pendiente de confirmación",
                slot_number: slot.slot_number,
                tier_name: tier?.name,
            })
        } else {
            // DECLINED, VOIDED, ERROR
            return success({
                status: tx.status,
                status_message: tx.status_message || "El pago no pudo ser procesado",
            })
        }
    } catch (error) {
        console.error("[verifyFoundingPayment] Error:", error)
        return failure("Error al verificar el pago")
    }
}
