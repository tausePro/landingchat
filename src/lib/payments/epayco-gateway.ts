/**
 * Implementación de PaymentGateway para ePayco
 * Documentación: https://docs.epayco.co/
 */

import crypto from "crypto"
import type { Bank } from "@/types/payment"
import type {
    PaymentGateway,
    GatewayConfig,
    TransactionInput,
    TransactionResult,
    TransactionDetails,
    TokenResult,
    CardData,
} from "./types"

const EPAYCO_API_URL = {
    sandbox: "https://apify.epayco.co",
    production: "https://apify.epayco.co",
}

const EPAYCO_SECURE_URL = {
    sandbox: "https://secure.epayco.co",
    production: "https://secure.epayco.co",
}

export class EpaycoGateway implements PaymentGateway {
    readonly provider = "epayco" as const
    private config: GatewayConfig
    private baseUrl: string
    private secureUrl: string
    private customerId: string
    private encryptionKey: string

    constructor(config: GatewayConfig) {
        this.config = config
        this.baseUrl = config.isTestMode
            ? EPAYCO_API_URL.sandbox
            : EPAYCO_API_URL.production
        this.secureUrl = config.isTestMode
            ? EPAYCO_SECURE_URL.sandbox
            : EPAYCO_SECURE_URL.production
        
        // Para ePayco, el integrity_secret contiene el P_CUST_ID_CLIENTE
        this.customerId = config.integritySecret || ""
        // Y encryptionKey contiene el P_ENCRYPTION_KEY
        this.encryptionKey = config.encryptionKey || ""
    }

    private async getAuthToken(): Promise<string> {
        const credentials = Buffer.from(
            `${this.config.publicKey}:${this.config.privateKey}`
        ).toString("base64")

        const response = await fetch(`${this.baseUrl}/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Basic ${credentials}`,
            },
        })

        if (!response.ok) {
            throw new Error("Error de autenticación con ePayco")
        }

        const data = await response.json()
        return data.token
    }

    private async getHeaders(): Promise<HeadersInit> {
        const token = await this.getAuthToken()
        return {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        }
    }

    async createTransaction(input: TransactionInput): Promise<TransactionResult> {
        try {
            // Para ePayco usamos el Checkout Estándar (checkout.js)
            // No llamamos a ninguna API aquí - solo generamos la URL de nuestra página de checkout
            // que cargará el script oficial de ePayco
            
            // La URL de checkout se construye basada en la redirectUrl que ya viene
            // con el dominio correcto (personalizado o landingchat.co)
            // Ejemplo redirectUrl: https://tez.com.co/order/123 o https://landingchat.co/store/tez/order/123
            
            // Extraer la base URL de la redirectUrl
            const redirectUrl = input.redirectUrl || ""
            let checkoutUrl: string
            
            // Detectar si es dominio personalizado (no contiene /store/)
            if (redirectUrl.includes("/store/")) {
                // URL con /store/slug/... → extraer slug y construir URL de checkout
                const urlParts = redirectUrl.match(/(.+)\/store\/([^/]+)\/order\//)
                const baseUrl = urlParts?.[1] || process.env.NEXT_PUBLIC_APP_URL || "https://landingchat.co"
                const slug = urlParts?.[2] || ""
                checkoutUrl = `${baseUrl}/store/${slug}/checkout/epayco/${input.reference}`
            } else {
                // Dominio personalizado: https://tez.com.co/order/123
                // Extraer base URL y construir checkout URL
                const urlParts = redirectUrl.match(/(.+)\/order\//)
                const baseUrl = urlParts?.[1] || ""
                checkoutUrl = `${baseUrl}/checkout/epayco/${input.reference}`
            }

            return {
                success: true,
                transactionId: input.reference,
                providerTransactionId: input.reference,
                status: "pending",
                redirectUrl: checkoutUrl,
                rawResponse: {
                    message: "Redirect to ePayco checkout page",
                    checkoutUrl,
                },
            }
        } catch (error) {
            console.error("[EpaycoGateway] Error creating transaction:", error)
            return {
                success: false,
                status: "error",
                error: error instanceof Error ? error.message : "Error desconocido",
            }
        }
    }

    /**
     * Genera la firma para ePayco
     */
    private generateSignature(params: Record<string, unknown>): string {
        // ePayco usa: p_cust_id_cliente^p_key^p_id_invoice^p_amount^p_currency_code
        const stringToSign = [
            params.p_cust_id_cliente,
            params.p_key,
            params.p_id_invoice,
            params.p_amount,
            params.p_currency_code
        ].join("^")

        return crypto.createHash("sha256").update(stringToSign).digest("hex")
    }

    async getTransaction(transactionId: string): Promise<TransactionDetails> {
        const headers = await this.getHeaders()

        const response = await fetch(
            `${this.baseUrl}/transaction/detail?ref_payco=${transactionId}`,
            { headers }
        )

        if (!response.ok) {
            throw new Error("Error al obtener transacción")
        }

        const data = await response.json()
        const tx = data.data

        return {
            id: tx.ref_payco,
            providerTransactionId: tx.ref_payco,
            reference: tx.factura,
            amount: Math.round(parseFloat(tx.valor) * 100), // Convertir a centavos
            currency: tx.moneda,
            status: this.mapStatus(tx.estado),
            paymentMethod: tx.metodo,
            createdAt: tx.fecha,
            completedAt: tx.estado === "Aceptada" ? tx.fecha : undefined,
            rawResponse: data,
        }
    }

    async getTransactionByReference(reference: string): Promise<TransactionDetails> {
        const headers = await this.getHeaders()

        const response = await fetch(
            `${this.baseUrl}/transaction/detail?factura=${encodeURIComponent(reference)}`,
            { headers }
        )

        if (!response.ok) {
            throw new Error("Error al obtener transacción")
        }

        const data = await response.json()
        if (!data.success || !data.data) {
            throw new Error("Transacción no encontrada")
        }

        const tx = data.data
        return {
            id: tx.ref_payco,
            providerTransactionId: tx.ref_payco,
            reference: tx.factura,
            amount: Math.round(parseFloat(tx.valor) * 100),
            currency: tx.moneda,
            status: this.mapStatus(tx.estado),
            paymentMethod: tx.metodo,
            createdAt: tx.fecha,
            completedAt: tx.estado === "Aceptada" ? tx.fecha : undefined,
            rawResponse: data,
        }
    }

    async tokenizeCard(card: CardData): Promise<TokenResult> {
        try {
            const headers = await this.getHeaders()

            const response = await fetch(`${this.baseUrl}/token/card`, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    card_number: card.number,
                    cvc: card.cvc,
                    exp_month: card.expMonth,
                    exp_year: card.expYear,
                    card_holder: card.cardHolder,
                }),
            })

            const data = await response.json()

            if (!data.success) {
                return {
                    success: false,
                    error: data.message || "Error al tokenizar tarjeta",
                }
            }

            return {
                success: true,
                token: data.data.id,
                lastFourDigits: data.data.mask?.slice(-4),
                brand: data.data.franchise,
            }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Error desconocido",
            }
        }
    }

    async getBanks(): Promise<Bank[]> {
        const headers = await this.getHeaders()

        const response = await fetch(`${this.baseUrl}/pse/banks`, { headers })

        if (!response.ok) {
            throw new Error("Error al obtener bancos")
        }

        const data = await response.json()
        return data.data.map((bank: { bankCode: string; bankName: string }) => ({
            code: bank.bankCode,
            name: bank.bankName,
        }))
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.getAuthToken()
            return true
        } catch {
            return false
        }
    }

    validateWebhookSignature(
        payload: { x_ref_payco?: string; x_transaction_id?: string; x_amount?: string; x_currency_code?: string; x_signature?: string },
        signature: string
    ): boolean {
        if (!this.encryptionKey || !this.customerId) return false

        // ePayco usa: SHA256(p_cust_id_cliente + p_encryption_key + x_ref_payco + x_transaction_id + x_amount + x_currency_code)
        const stringToSign = [
            this.customerId, // P_CUST_ID_CLIENTE
            this.encryptionKey, // P_ENCRYPTION_KEY
            payload.x_ref_payco,
            payload.x_transaction_id,
            payload.x_amount,
            payload.x_currency_code,
        ].join("")

        const calculatedSignature = crypto
            .createHash("sha256")
            .update(stringToSign)
            .digest("hex")

        return calculatedSignature === (payload.x_signature || signature)
    }

    private mapStatus(epaycoStatus: string): TransactionDetails["status"] {
        const statusMap: Record<string, TransactionDetails["status"]> = {
            Aceptada: "approved",
            Rechazada: "declined",
            Pendiente: "pending",
            Fallida: "error",
            Reversada: "voided",
        }
        return statusMap[epaycoStatus] || "pending"
    }
}
