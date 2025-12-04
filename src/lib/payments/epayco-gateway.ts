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

    constructor(config: GatewayConfig) {
        this.config = config
        this.baseUrl = config.isTestMode
            ? EPAYCO_API_URL.sandbox
            : EPAYCO_API_URL.production
        this.secureUrl = config.isTestMode
            ? EPAYCO_SECURE_URL.sandbox
            : EPAYCO_SECURE_URL.production
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
            const headers = await this.getHeaders()

            const body: Record<string, unknown> = {
                token_card: input.cardToken,
                customer_id: input.customerDocument,
                doc_type: input.customerDocumentType || "CC",
                doc_number: input.customerDocument,
                name: input.customerName,
                last_name: "",
                email: input.customerEmail,
                cell_phone: input.customerPhone,
                bill: input.reference,
                description: `Pago ${input.reference}`,
                value: String(input.amount / 100), // ePayco usa valor en pesos, no centavos
                tax: "0",
                tax_base: String(input.amount / 100),
                currency: input.currency,
                dues: "1",
                ip: "127.0.0.1",
                url_response: input.redirectUrl,
                url_confirmation: input.redirectUrl,
                test: this.config.isTestMode ? "true" : "false",
            }

            let endpoint = "/payment/process"

            if (input.paymentMethod === "pse" && input.bankCode) {
                endpoint = "/payment/process/pse"
                body.bank = input.bankCode
                body.type_person = input.personType === "juridica" ? "1" : "0"
            }

            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                method: "POST",
                headers,
                body: JSON.stringify(body),
            })

            const data = await response.json()

            if (!data.success) {
                return {
                    success: false,
                    status: "error",
                    error: data.message || "Error al crear transacción",
                    rawResponse: data,
                }
            }

            return {
                success: true,
                transactionId: data.data.ref_payco,
                providerTransactionId: data.data.ref_payco,
                status: this.mapStatus(data.data.estado),
                redirectUrl: data.data.urlbanco, // Para PSE
                rawResponse: data,
            }
        } catch (error) {
            return {
                success: false,
                status: "error",
                error: error instanceof Error ? error.message : "Error desconocido",
            }
        }
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
        if (!this.config.privateKey) return false

        // ePayco usa: SHA256(p_cust_id_cliente + p_key + x_ref_payco + x_transaction_id + x_amount + x_currency_code)
        const stringToSign = [
            this.config.publicKey,
            this.config.privateKey,
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
