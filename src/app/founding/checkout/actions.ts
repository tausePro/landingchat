"use server"

import { createServiceClient } from "@/lib/supabase/server"
import crypto from "crypto"
import {
    type ActionResult,
    success,
    failure,
    calculateAnnualPrice,
} from "@/types"

export interface FoundingSlotCheckoutData {
    id: string
    slot_number: number
    organization_id: string
    tier_id: string
    tier_name: string
    locked_price: number
    locked_currency: string
    annual_price: number
    free_months: number
    expires_at: string
    status: string
}

export interface WompiWidgetData {
    publicKey: string
    amountInCents: number
    currency: string
    reference: string
    redirectUrl: string
    integritySignature: string
    customerEmail?: string
    isTestMode: boolean
    checkoutUrl?: string
}

/**
 * Obtiene los datos de un slot para el checkout
 */
export async function getFoundingSlotForCheckout(
    slotId: string
): Promise<ActionResult<FoundingSlotCheckoutData>> {
    try {
        const supabase = createServiceClient()

        const { data: slot, error } = await supabase
            .from("founding_slots")
            .select(`
                *,
                tier:founding_tiers(id, name, currency),
                program:founding_program(free_months)
            `)
            .eq("id", slotId)
            .single()

        if (error || !slot) {
            return failure("Slot no encontrado")
        }

        if (slot.status !== "reserved") {
            return failure("Este slot ya fue procesado o expiró")
        }

        // Verificar que no haya expirado
        if (slot.expires_at && new Date(slot.expires_at) < new Date()) {
            // Marcar como expirado
            await supabase
                .from("founding_slots")
                .update({ status: "expired" })
                .eq("id", slotId)

            return failure("La reserva ha expirado. Por favor, selecciona un nuevo plan.")
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tier = slot.tier as any
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const program = slot.program as any

        const annualInfo = calculateAnnualPrice(slot.locked_price, program?.free_months || 2)

        return success({
            id: slot.id,
            slot_number: slot.slot_number,
            organization_id: slot.organization_id,
            tier_id: slot.tier_id,
            tier_name: tier?.name || "Founding",
            locked_price: slot.locked_price,
            locked_currency: slot.locked_currency || "COP",
            annual_price: annualInfo.totalPrice,
            free_months: program?.free_months || 2,
            expires_at: slot.expires_at,
            status: slot.status,
        })
    } catch (error) {
        console.error("[getFoundingSlotForCheckout] Error:", error)
        return failure("Error al obtener datos del slot")
    }
}

/**
 * Genera datos para el widget de Wompi para pago founding
 */
export async function generateFoundingPaymentData(
    slotId: string,
    customerEmail: string
): Promise<ActionResult<{ widgetData: WompiWidgetData }>> {
    try {
        const supabase = createServiceClient()

        // Obtener slot con tier y programa
        const { data: slot } = await supabase
            .from("founding_slots")
            .select(`
                *,
                tier:founding_tiers(id, name, currency),
                program:founding_program(id, free_months)
            `)
            .eq("id", slotId)
            .single()

        if (!slot) {
            return failure("Slot no encontrado")
        }

        if (slot.status !== "reserved") {
            return failure("Este slot ya fue procesado")
        }

        // Verificar expiración
        if (slot.expires_at && new Date(slot.expires_at) < new Date()) {
            return failure("La reserva ha expirado")
        }

        // Obtener credenciales de Wompi de la plataforma
        const { data: wompiConfig } = await supabase
            .from("system_settings")
            .select("value")
            .eq("key", "platform_wompi_config")
            .single()

        if (!wompiConfig?.value) {
            return failure("Pasarela de pagos no configurada")
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const credentials = wompiConfig.value as any
        const publicKey = credentials.is_sandbox ? credentials.sandbox_public_key : credentials.production_public_key
        const integritySecret = credentials.is_sandbox ? credentials.sandbox_integrity_secret : credentials.production_integrity_secret

        if (!publicKey || !integritySecret) {
            return failure("Credenciales de pago incompletas")
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const program = slot.program as any
        const annualInfo = calculateAnnualPrice(slot.locked_price, program?.free_months || 2)

        // Generar referencia única
        const timestamp = Date.now()
        const reference = `founding_${slotId}_${timestamp}`

        // Calcular monto en centavos
        const amountInCents = Math.round(annualInfo.totalPrice * 100)
        const currency = slot.locked_currency || "COP"

        // URL de redirección
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://landingchat.co"
        const redirectUrl = `${baseUrl}/founding/checkout/result`

        // Generar firma de integridad
        const signatureString = `${reference}${amountInCents}${currency}${integritySecret}`
        const integritySignature = crypto
            .createHash("sha256")
            .update(signatureString)
            .digest("hex")

        // Guardar referencia en el slot para el webhook
        await supabase
            .from("founding_slots")
            .update({
                referral_code: reference, // Usamos este campo para guardar la referencia de pago
            })
            .eq("id", slotId)

        // En modo sandbox, generar URL de checkout directo como fallback
        let checkoutUrl: string | undefined
        if (credentials.is_sandbox) {
            const checkoutParams = new URLSearchParams({
                "public-key": publicKey,
                currency,
                "amount-in-cents": amountInCents.toString(),
                reference,
                "redirect-url": redirectUrl,
                "signature:integrity": integritySignature,
            })
            if (customerEmail) {
                checkoutParams.set("customer-data:email", customerEmail)
            }
            checkoutUrl = `https://checkout.wompi.co/p/?${checkoutParams.toString()}`
        }

        return success({
            widgetData: {
                publicKey,
                amountInCents,
                currency,
                reference,
                redirectUrl,
                integritySignature,
                customerEmail,
                isTestMode: credentials.is_sandbox,
                checkoutUrl,
            }
        })
    } catch (error) {
        console.error("[generateFoundingPaymentData] Error:", error)
        return failure("Error al generar datos de pago")
    }
}

/**
 * Extiende el tiempo de expiración de un slot (por si el usuario tarda en pagar)
 */
export async function extendSlotExpiration(slotId: string): Promise<ActionResult<void>> {
    try {
        const supabase = createServiceClient()

        const expiresAt = new Date()
        expiresAt.setMinutes(expiresAt.getMinutes() + 30)

        await supabase
            .from("founding_slots")
            .update({ expires_at: expiresAt.toISOString() })
            .eq("id", slotId)
            .eq("status", "reserved")

        return success(undefined)
    } catch (error) {
        console.error("[extendSlotExpiration] Error:", error)
        return failure("Error al extender tiempo")
    }
}
