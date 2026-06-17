"use server"

import { createClient, createServiceClient } from "@/lib/supabase/server"
import { getPlatformWompiCredentials } from "@/app/admin/platform-payments/actions"
import type { WompiWidgetData } from "./actions"
import crypto from "crypto"

// Marcador en marketplace_items.config_schema que identifica un pack de créditos.
const CREDIT_PACK_KIND = "conversation_credits"

export interface CreditPack {
    id: string
    name: string
    description: string | null
    creditAmount: number
    price: number
    currency: string
}

/**
 * Packs de créditos disponibles para comprar. Se modelan como marketplace_items
 * activos con config_schema = { kind: "conversation_credits", credit_amount: N }.
 */
export async function getCreditPacks(): Promise<CreditPack[]> {
    const supabase = await createServiceClient()
    const { data, error } = await supabase
        .from("marketplace_items")
        .select("id, name, description, base_price, config_schema")
        .eq("is_active", true)
        .eq("config_schema->>kind", CREDIT_PACK_KIND)
        .order("base_price", { ascending: true })

    if (error || !data) return []

    return data
        .map((item) => {
            const config = (item.config_schema || {}) as { credit_amount?: number }
            return {
                id: item.id as string,
                name: item.name as string,
                description: (item.description as string | null) ?? null,
                creditAmount: Number(config.credit_amount) || 0,
                price: Number(item.base_price) || 0,
                currency: "COP",
            }
        })
        .filter((p) => p.creditAmount > 0)
}

/**
 * Inicia la compra de un pack de créditos: registra credit_purchases (pending) y
 * devuelve los datos del Widget de Wompi (firma generada en servidor). El crédito
 * se acredita en el webhook al confirmarse el pago (idempotente).
 */
export async function initiateCreditPurchase(packId: string): Promise<{
    success: boolean
    data?: { widgetData: WompiWidgetData }
    error?: string
}> {
    // Org del usuario autenticado
    const userClient = await createClient()
    const {
        data: { user },
    } = await userClient.auth.getUser()
    if (!user) return { success: false, error: "No autenticado" }

    const { data: profile } = await userClient
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()
    const organizationId = profile?.organization_id as string | undefined
    if (!organizationId) return { success: false, error: "Organización no encontrada" }

    const supabase = await createServiceClient()

    // Validar el pack
    const { data: item, error: itemError } = await supabase
        .from("marketplace_items")
        .select("id, name, base_price, config_schema, is_active")
        .eq("id", packId)
        .maybeSingle()

    if (itemError || !item || !item.is_active) {
        return { success: false, error: "Pack no disponible" }
    }
    const config = (item.config_schema || {}) as { kind?: string; credit_amount?: number }
    const creditAmount = Number(config.credit_amount) || 0
    if (config.kind !== CREDIT_PACK_KIND || creditAmount <= 0) {
        return { success: false, error: "Pack inválido" }
    }

    const price = Number(item.base_price) || 0
    const currency = "COP"
    const amountInCents = Math.round(price * 100)

    // Credenciales Wompi de la plataforma
    const credentials = await getPlatformWompiCredentials()
    if (!credentials.success || !credentials.data) {
        return { success: false, error: "Pasarela de pagos no configurada" }
    }

    // Registrar la compra en estado pending con referencia única
    const reference = `credits_${crypto.randomUUID()}`
    const { error: insertError } = await supabase.from("credit_purchases").insert({
        organization_id: organizationId,
        marketplace_item_id: item.id,
        credit_amount: creditAmount,
        amount_paid: price,
        currency,
        reference,
        provider: "wompi",
        status: "pending",
    })
    if (insertError) {
        console.error("[credit-purchase] Error creando compra:", insertError)
        return { success: false, error: "No se pudo iniciar la compra" }
    }

    // Firma de integridad (servidor; NO se expone el secret)
    const signatureString = `${reference}${amountInCents}${currency}${credentials.data.integritySecret}`
    const integritySignature = crypto.createHash("sha256").update(signatureString).digest("hex")

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://landingchat.co"
    const redirectUrl = `${baseUrl}/dashboard`
    const customerEmail = user.email || undefined

    // Fallback de checkout directo solo en sandbox (desarrollo local)
    let checkoutUrl: string | undefined
    if (credentials.data.isTestMode) {
        const checkoutParams = new URLSearchParams({
            "public-key": credentials.data.publicKey,
            currency,
            "amount-in-cents": amountInCents.toString(),
            reference,
            "redirect-url": redirectUrl,
            "signature:integrity": integritySignature,
        })
        if (customerEmail) checkoutParams.set("customer-data:email", customerEmail)
        checkoutUrl = `https://checkout.wompi.co/p/?${checkoutParams.toString()}`
    }

    return {
        success: true,
        data: {
            widgetData: {
                publicKey: credentials.data.publicKey,
                amountInCents,
                currency,
                reference,
                redirectUrl,
                integritySignature,
                customerEmail,
                isTestMode: credentials.data.isTestMode,
                checkoutUrl,
            },
        },
    }
}
