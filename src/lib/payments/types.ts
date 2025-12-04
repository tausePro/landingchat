/**
 * Tipos e interfaces para pasarelas de pago
 */

import type {
    PaymentProvider,
    TransactionStatus,
    PaymentMethod,
    Bank,
} from "@/types/payment"

// Configuración base para cualquier pasarela
export interface GatewayConfig {
    provider: PaymentProvider
    publicKey: string
    privateKey: string
    integritySecret?: string
    isTestMode: boolean
}

// Input para crear una transacción
export interface TransactionInput {
    amount: number // En centavos
    currency: string
    reference: string // Referencia única de la orden
    paymentMethod: PaymentMethod
    // Datos del cliente
    customerEmail: string
    customerName: string
    customerPhone?: string
    customerDocument?: string
    customerDocumentType?: string
    // Datos específicos del método
    cardToken?: string // Para pagos con tarjeta
    bankCode?: string // Para PSE
    personType?: "natural" | "juridica" // Para PSE
    // URLs de redirección
    redirectUrl?: string
}

// Resultado de crear una transacción
export interface TransactionResult {
    success: boolean
    transactionId?: string
    providerTransactionId?: string
    status: TransactionStatus
    redirectUrl?: string // Para PSE y otros métodos que requieren redirección
    error?: string
    rawResponse?: Record<string, unknown>
}

// Resultado de obtener una transacción
export interface TransactionDetails {
    id: string
    providerTransactionId: string
    reference: string
    amount: number
    currency: string
    status: TransactionStatus
    paymentMethod?: string
    createdAt: string
    completedAt?: string
    rawResponse?: Record<string, unknown>
}

// Resultado de tokenizar tarjeta
export interface TokenResult {
    success: boolean
    token?: string
    lastFourDigits?: string
    brand?: string
    expirationMonth?: string
    expirationYear?: string
    error?: string
}

// Datos de tarjeta para tokenizar
export interface CardData {
    number: string
    cvc: string
    expMonth: string
    expYear: string
    cardHolder: string
}

// Interfaz que deben implementar todas las pasarelas
export interface PaymentGateway {
    readonly provider: PaymentProvider

    // Crear una transacción
    createTransaction(input: TransactionInput): Promise<TransactionResult>

    // Obtener detalles de una transacción
    getTransaction(transactionId: string): Promise<TransactionDetails>

    // Obtener transacción por referencia
    getTransactionByReference(reference: string): Promise<TransactionDetails>

    // Tokenizar tarjeta (para pagos con tarjeta)
    tokenizeCard(card: CardData): Promise<TokenResult>

    // Obtener lista de bancos (para PSE)
    getBanks(): Promise<Bank[]>

    // Verificar conexión
    testConnection(): Promise<boolean>

    // Validar firma de webhook
    validateWebhookSignature(
        payload: unknown,
        signature: string,
        timestamp?: string
    ): boolean
}

// Evento de webhook normalizado
export interface WebhookEvent {
    provider: PaymentProvider
    eventType: "transaction.updated" | "transaction.created"
    transactionId: string
    reference: string
    status: TransactionStatus
    amount: number
    currency: string
    rawPayload: Record<string, unknown>
}
