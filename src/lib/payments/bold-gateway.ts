/**
 * Implementación de PaymentGateway para Bold.
 *
 * Bold tiene flujo de "hosted_redirect": creamos un payment link via API
 * y redirigimos al cliente a `https://checkout.bold.co/LNK_xxx`.
 *
 * Documentación:
 *   - API: https://developers.bold.co/pagos-en-linea/api-integration
 *   - Webhooks: https://developers.bold.co/webhook
 *
 * Webhook security:
 *   - Header `x-bold-signature` con HMAC-SHA256(base64(body), secret) en hex.
 *   - Bold reintenta hasta 5 veces si no recibe HTTP 200.
 *
 * Estado: integración funcional pero deshabilitada en `registry.ts`
 * (`enabled: false`) hasta que se prueben credenciales en producción.
 */

import crypto from "crypto"
import { logger } from "@/lib/logger"
import type { Bank } from "@/types/payment"
import type {
    PaymentGateway,
    GatewayConfig,
    TransactionInput,
    TransactionResult,
    TransactionDetails,
    TokenResult,
    CardData,
    WebhookParseResult,
} from "./types"

const log = logger("payments/bold")

const BOLD_API_URL = {
    sandbox: "https://integrations-sandbox.api.bold.co",
    production: "https://integrations.api.bold.co",
}

interface BoldPaymentLinkResponse {
    payload?: {
        payment_link?: string
        url?: string
    }
    errors?: Array<{ code?: string; message?: string }>
}

interface BoldPaymentLinkStatus {
    api_version?: string
    id?: string
    total?: number
    status?: "ACTIVE" | "PROCESSING" | "PAID" | "EXPIRED"
    payment_method?: string
    transaction_id?: string
    creation_date?: number
    description?: string
}

interface BoldWebhookPayload {
    type?: string // SALE_APPROVED, SALE_REJECTED, etc.
    subject?: string
    source?: string
    data?: {
        payment_id?: string
        merchant_id?: string
        payment_method?: string
        amount?: { total?: number; currency?: string }
        metadata?: { reference?: string }
        created_at?: string
    }
}

export class BoldGateway implements PaymentGateway {
    readonly provider = "bold" as const
    private config: GatewayConfig
    private baseUrl: string

    constructor(config: GatewayConfig) {
        this.config = config
        this.baseUrl = config.isTestMode ? BOLD_API_URL.sandbox : BOLD_API_URL.production
    }

    private getHeaders(): HeadersInit {
        return {
            "Content-Type": "application/json",
            Authorization: `x-api-key ${this.config.privateKey}`,
        }
    }

    /**
     * Crea un payment link y devuelve la URL de checkout de Bold.
     *
     * Bold espera el monto en pesos enteros (no centavos). Recibimos centavos
     * desde la capa superior y dividimos.
     */
    async createTransaction(input: TransactionInput): Promise<TransactionResult> {
        try {
            const totalAmount = Math.round(input.amount / 100)
            const body = {
                amount_type: "CLOSE",
                amount: {
                    currency: input.currency,
                    total_amount: totalAmount,
                },
                description: input.reference,
                callback_url: input.redirectUrl,
                payer_email: input.customerEmail,
                metadata: {
                    reference: input.reference,
                },
            }

            const response = await fetch(`${this.baseUrl}/online/link/v1`, {
                method: "POST",
                headers: this.getHeaders(),
                body: JSON.stringify(body),
            })

            const data: BoldPaymentLinkResponse = await response.json()

            if (!response.ok || !data.payload?.url || data.errors?.length) {
                const errorMsg = data.errors?.[0]?.message || `HTTP ${response.status}`
                log.error("Failed to create Bold payment link", { errorMsg, status: response.status })
                return {
                    success: false,
                    status: "error",
                    error: `Error al crear link de pago Bold: ${errorMsg}`,
                }
            }

            return {
                success: true,
                transactionId: data.payload.payment_link,
                providerTransactionId: data.payload.payment_link,
                status: "pending",
                redirectUrl: data.payload.url,
                rawResponse: data as unknown as Record<string, unknown>,
            }
        } catch (error) {
            log.error("Bold createTransaction error", {
                error: error instanceof Error ? error.message : String(error),
            })
            return {
                success: false,
                status: "error",
                error: error instanceof Error ? error.message : "Error desconocido",
            }
        }
    }

    async getTransaction(transactionId: string): Promise<TransactionDetails> {
        const response = await fetch(`${this.baseUrl}/online/link/v1/${encodeURIComponent(transactionId)}`, {
            headers: this.getHeaders(),
        })

        if (!response.ok) {
            throw new Error(`Error al consultar transacción Bold (HTTP ${response.status})`)
        }

        const data = (await response.json()) as { payload?: BoldPaymentLinkStatus }
        const tx = data.payload
        if (!tx) {
            throw new Error("Transacción Bold no encontrada")
        }

        return {
            id: tx.id || transactionId,
            providerTransactionId: tx.id || transactionId,
            reference: tx.description || transactionId,
            amount: Math.round((tx.total || 0) * 100),
            currency: "COP",
            status: this.mapStatus(tx.status),
            paymentMethod: tx.payment_method,
            createdAt: tx.creation_date ? new Date(tx.creation_date / 1_000_000).toISOString() : new Date().toISOString(),
            completedAt: tx.status === "PAID" ? new Date().toISOString() : undefined,
            rawResponse: data as unknown as Record<string, unknown>,
        }
    }

    async getTransactionByReference(reference: string): Promise<TransactionDetails> {
        // Bold no expone consulta pública por reference: nosotros guardamos
        // el `payment_link` (LNK_xxx) como `provider_transaction_id` cuando
        // creamos el link, así que esta operación no aporta valor adicional.
        // Si llega aquí es porque la capa de reconciliación no encontró el
        // link cacheado.
        throw new Error(
            `Bold no soporta consulta por reference. Usa getTransaction(payment_link). Reference recibida: ${reference}`,
        )
    }

    async tokenizeCard(_card: CardData): Promise<TokenResult> {
        void _card
        return {
            success: false,
            error: "Bold no expone tokenización de tarjeta vía API en este flujo",
        }
    }

    async getBanks(): Promise<Bank[]> {
        // Bold expone /online/methods/v1 con métodos y bancos. Si lo necesitamos
        // para PSE, extender este método. Por ahora retorna vacío.
        return []
    }

    async testConnection(): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/online/methods/v1`, {
                headers: this.getHeaders(),
            })
            return response.ok
        } catch {
            return false
        }
    }

    /**
     * Valida la firma del webhook según docs Bold:
     *   x-bold-signature = HMAC-SHA256(base64(rawBody), secret) en hex
     */
    validateWebhookSignature(payload: unknown, signature: string): boolean {
        if (!this.config.integritySecret || !signature) return false

        try {
            const bodyJson = typeof payload === "string" ? payload : JSON.stringify(payload)
            const bodyBase64 = Buffer.from(bodyJson, "utf8").toString("base64")
            const expected = crypto
                .createHmac("sha256", this.config.integritySecret)
                .update(bodyBase64)
                .digest("hex")
            return expected.toLowerCase() === signature.toLowerCase()
        } catch (error) {
            log.error("Bold signature validation error", {
                error: error instanceof Error ? error.message : String(error),
            })
            return false
        }
    }

    /**
     * Parsea webhook de Bold y devuelve `WebhookEvent` normalizado.
     */
    async parseWebhook(request: Request): Promise<WebhookParseResult> {
        try {
            const rawBody = await request.text()
            const signature = request.headers.get("x-bold-signature") || ""

            const isValid = this.validateWebhookSignature(rawBody, signature)
            if (!isValid) {
                return { isValid: false, event: null, error: "Invalid x-bold-signature", httpStatus: 401 }
            }

            const payload = JSON.parse(rawBody) as BoldWebhookPayload
            const data = payload.data

            if (!data?.payment_id) {
                return { isValid: false, event: null, error: "Missing payment_id", httpStatus: 400 }
            }

            return {
                isValid: true,
                event: {
                    provider: "bold",
                    eventType: "transaction.updated",
                    transactionId: data.payment_id,
                    reference: data.metadata?.reference || data.payment_id,
                    status: this.mapEventTypeToStatus(payload.type),
                    amount: Math.round((data.amount?.total || 0) * 100),
                    currency: data.amount?.currency || "COP",
                    paymentMethod: data.payment_method,
                    rawPayload: payload as unknown as Record<string, unknown>,
                },
            }
        } catch (error) {
            return {
                isValid: false,
                event: null,
                error: error instanceof Error ? error.message : "Bold webhook parse error",
                httpStatus: 400,
            }
        }
    }

    private mapStatus(boldStatus: string | undefined): TransactionDetails["status"] {
        switch (boldStatus) {
            case "PAID":
                return "approved"
            case "PROCESSING":
                return "pending"
            case "ACTIVE":
                return "pending"
            case "EXPIRED":
                return "voided"
            default:
                return "pending"
        }
    }

    private mapEventTypeToStatus(eventType: string | undefined): TransactionDetails["status"] {
        switch (eventType) {
            case "SALE_APPROVED":
                return "approved"
            case "SALE_REJECTED":
            case "SALE_FAILED":
                return "declined"
            case "VOID_APPROVED":
                return "voided"
            default:
                return "pending"
        }
    }
}
