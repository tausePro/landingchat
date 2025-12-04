/**
 * Tipos y schemas para pasarelas de pago de organizaciones
 */

import { z } from "zod"

// Proveedores de pago soportados
export const PaymentProviderSchema = z.enum(["wompi", "epayco"])
export type PaymentProvider = z.infer<typeof PaymentProviderSchema>

// Estados de transacción
export const TransactionStatusSchema = z.enum([
    "pending",
    "approved",
    "declined",
    "voided",
    "error",
])
export type TransactionStatus = z.infer<typeof TransactionStatusSchema>

// Estados de pago de orden
export const PaymentStatusSchema = z.enum([
    "pending",
    "processing",
    "paid",
    "failed",
    "refunded",
])
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>

// Métodos de pago
export const PaymentMethodSchema = z.enum([
    "card",
    "pse",
    "nequi",
    "bancolombia_transfer",
    "cash",
])
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>

// ============================================
// Configuración de Pasarela de Pago
// ============================================

export const PaymentGatewayConfigSchema = z.object({
    id: z.string().uuid(),
    organization_id: z.string().uuid(),
    provider: PaymentProviderSchema,
    is_active: z.boolean().default(false),
    is_test_mode: z.boolean().default(true),
    public_key: z.string().nullable().optional(),
    private_key_encrypted: z.string().nullable().optional(),
    integrity_secret_encrypted: z.string().nullable().optional(),
    webhook_url: z.string().url().nullable().optional(),
    config: z.record(z.string(), z.unknown()).default({}),
    created_at: z.string(),
    updated_at: z.string(),
})

export type PaymentGatewayConfig = z.infer<typeof PaymentGatewayConfigSchema>

// Input para crear/actualizar configuración
export const PaymentGatewayConfigInputSchema = z.object({
    provider: PaymentProviderSchema,
    is_active: z.boolean().optional(),
    is_test_mode: z.boolean().optional(),
    public_key: z.string().min(1, "La llave pública es requerida"),
    private_key: z.string().min(1, "La llave privada es requerida"),
    integrity_secret: z.string().optional(),
})

export type PaymentGatewayConfigInput = z.infer<typeof PaymentGatewayConfigInputSchema>

// ============================================
// Transacciones de Tienda
// ============================================

export const StoreTransactionSchema = z.object({
    id: z.string().uuid(),
    organization_id: z.string().uuid(),
    order_id: z.string().uuid().nullable().optional(),
    customer_id: z.string().uuid().nullable().optional(),
    amount: z.number().int().positive("El monto debe ser positivo"),
    currency: z.string().default("COP"),
    status: TransactionStatusSchema.default("pending"),
    provider: z.string(),
    provider_transaction_id: z.string().nullable().optional(),
    provider_reference: z.string().nullable().optional(),
    provider_response: z.record(z.string(), z.unknown()).nullable().optional(),
    payment_method: z.string().nullable().optional(),
    payment_method_details: z.record(z.string(), z.unknown()).nullable().optional(),
    created_at: z.string(),
    updated_at: z.string(),
    completed_at: z.string().nullable().optional(),
})

export type StoreTransaction = z.infer<typeof StoreTransactionSchema>

// Input para crear transacción
export const CreateTransactionInputSchema = z.object({
    order_id: z.string().uuid().optional(),
    customer_id: z.string().uuid().optional(),
    amount: z.number().int().positive("El monto debe ser positivo"),
    currency: z.string().default("COP"),
    payment_method: PaymentMethodSchema,
    // Datos específicos según método de pago
    card_token: z.string().optional(), // Para pagos con tarjeta
    bank_code: z.string().optional(), // Para PSE
    person_type: z.enum(["natural", "juridica"]).optional(), // Para PSE
    customer_email: z.string().email(),
    customer_name: z.string(),
    customer_phone: z.string().optional(),
    customer_document: z.string().optional(),
    customer_document_type: z.string().optional(),
})

export type CreateTransactionInput = z.infer<typeof CreateTransactionInputSchema>

// ============================================
// Respuestas de API
// ============================================

export interface TransactionResult {
    success: boolean
    transaction_id?: string
    provider_transaction_id?: string
    status: TransactionStatus
    redirect_url?: string // Para PSE
    error?: string
}

export interface Bank {
    code: string
    name: string
}

// ============================================
// Deserializadores
// ============================================

export function deserializePaymentGatewayConfig(
    data: Record<string, unknown>
): PaymentGatewayConfig {
    return PaymentGatewayConfigSchema.parse({
        id: data.id,
        organization_id: data.organization_id,
        provider: data.provider,
        is_active: data.is_active ?? false,
        is_test_mode: data.is_test_mode ?? true,
        public_key: data.public_key,
        private_key_encrypted: data.private_key_encrypted,
        integrity_secret_encrypted: data.integrity_secret_encrypted,
        webhook_url: data.webhook_url,
        config: data.config ?? {},
        created_at: data.created_at,
        updated_at: data.updated_at,
    })
}

export function deserializeStoreTransaction(
    data: Record<string, unknown>
): StoreTransaction {
    return StoreTransactionSchema.parse({
        id: data.id,
        organization_id: data.organization_id,
        order_id: data.order_id,
        customer_id: data.customer_id,
        amount: data.amount,
        currency: data.currency ?? "COP",
        status: data.status ?? "pending",
        provider: data.provider,
        provider_transaction_id: data.provider_transaction_id,
        provider_reference: data.provider_reference,
        provider_response: data.provider_response,
        payment_method: data.payment_method,
        payment_method_details: data.payment_method_details,
        created_at: data.created_at,
        updated_at: data.updated_at,
        completed_at: data.completed_at,
    })
}
