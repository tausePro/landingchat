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
    encryptionKey?: string
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

    // Parsear y validar webhook entrante. Convierte el payload provider-specific
    // en un WebhookEvent normalizado que `processWebhookEvent` consume.
    parseWebhook(request: Request): Promise<WebhookParseResult>
}

// Evento de webhook normalizado
export interface WebhookEvent {
    provider: PaymentProvider
    eventType: "transaction.updated" | "transaction.created"
    transactionId: string
    reference: string
    status: TransactionStatus
    amount: number // En centavos
    currency: string
    paymentMethod?: string
    rawPayload: Record<string, unknown>
}

// Resultado de parsear/validar un webhook
export interface WebhookParseResult {
    isValid: boolean
    event: WebhookEvent | null
    error?: string
    httpStatus?: number // Status HTTP a devolver al provider (200, 400, 401, etc.)
}

// Modo de checkout: cómo se renderiza al cliente
export type CheckoutMode =
    | "embedded_widget" // Wompi/ePayco: script JS embebido en página interna
    | "hosted_redirect" // Bold/Addi: server crea sesión, cliente va a URL externa

// Input para crear sesión de checkout (genérica para todos los providers)
export interface CheckoutSessionInput {
    orderId: string
    amountInCents: number
    currency: string
    customerEmail: string
    customerName: string
    customerPhone?: string
    customerDocument?: string
    customerDocumentType?: string
    returnUrl: string // A dónde vuelve el cliente tras pagar
    confirmationUrl: string // Webhook URL para este pago
    description?: string
    metadata?: Record<string, string>
}

// Datos para inicializar el widget (embedded_widget)
export interface CheckoutWidgetData {
    scriptUrl: string
    componentName: string // Nombre del componente cliente: "wompi" | "epayco" | etc.
    config: Record<string, unknown> // Params para configurar el widget
}

// Resultado de crear sesión de checkout
export interface CheckoutSession {
    mode: CheckoutMode
    widgetData?: CheckoutWidgetData // Solo para embedded_widget
    redirectUrl?: string // Solo para hosted_redirect
    transactionId?: string // ID interno del provider, si aplica
}
