/**
 * Tipos para integración con Wompi
 * Documentación: https://docs.wompi.co/
 */

import { z } from "zod"

// Configuración de Wompi
export interface WompiConfig {
    publicKey: string
    privateKey: string
    integritySecret: string
    environment: "sandbox" | "production"
}

// Request para crear transacción
export interface WompiTransactionRequest {
    amount_in_cents: number
    currency: "COP"
    customer_email: string
    reference: string
    payment_method?: {
        type: "CARD" | "NEQUI" | "PSE" | "BANCOLOMBIA_TRANSFER"
        installments?: number
    }
    redirect_url?: string
    customer_data?: {
        phone_number?: string
        full_name?: string
        legal_id?: string
        legal_id_type?: "CC" | "CE" | "NIT" | "PP" | "TI"
    }
}

// Respuesta de transacción de Wompi
export interface WompiTransactionResponse {
    data: {
        id: string
        created_at: string
        finalized_at: string | null
        amount_in_cents: number
        reference: string
        customer_email: string
        currency: "COP"
        payment_method_type: string
        payment_method: Record<string, unknown>
        status: WompiTransactionStatus
        status_message: string | null
        billing_data: Record<string, unknown> | null
        shipping_address: Record<string, unknown> | null
        redirect_url: string | null
        payment_source_id: string | null
        payment_link_id: string | null
        customer_data: Record<string, unknown> | null
        bill_id: string | null
    }
}

// Estados de transacción de Wompi
export type WompiTransactionStatus =
    | "PENDING"
    | "APPROVED"
    | "DECLINED"
    | "VOIDED"
    | "ERROR"

// Webhook de Wompi
export interface WompiWebhookPayload {
    event: "transaction.updated" | "nequi_token.updated"
    data: {
        transaction: {
            id: string
            status: WompiTransactionStatus
            reference: string
            amount_in_cents: number
            currency: "COP"
            customer_email: string
            payment_method_type: string
            finalized_at: string | null
        }
    }
    sent_at: string
    timestamp: number
    signature: {
        properties: string[]
        checksum: string
    }
    environment: "test" | "prod"
}

// Schema Zod para validar configuración
export const WompiConfigSchema = z.object({
    publicKey: z.string().min(1, "La llave pública es requerida"),
    privateKey: z.string().min(1, "La llave privada es requerida"),
    integritySecret: z.string().min(1, "El secreto de integridad es requerido"),
    environment: z.enum(["sandbox", "production"]).default("sandbox"),
})

// Mapeo de estados Wompi a estados internos
export const WOMPI_STATUS_MAP: Record<WompiTransactionStatus, "pending" | "approved" | "declined" | "error" | "voided"> = {
    PENDING: "pending",
    APPROVED: "approved",
    DECLINED: "declined",
    VOIDED: "voided",
    ERROR: "error",
}

/**
 * Formatea una transacción para enviar a Wompi
 */
export function formatTransactionForWompi(
    amount: number,
    currency: "COP",
    email: string,
    reference: string
): WompiTransactionRequest {
    return {
        amount_in_cents: Math.round(amount * 100),
        currency,
        customer_email: email,
        reference,
    }
}

/**
 * Genera una referencia única para transacciones
 */
export function generateTransactionReference(subscriptionId: string): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    return `SUB-${subscriptionId.substring(0, 8)}-${timestamp}-${random}`
}
