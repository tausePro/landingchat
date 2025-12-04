/**
 * Implementación de PaymentGateway para Wompi
 * Documentación: https://docs.wompi.co/
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

const WOMPI_API_URL = {
    sandbox: "https://sandbox.wompi.co/v1",
    production: "https://production.wompi.co/v1",
}

export class WompiGateway implements PaymentGateway {
    readonly provider = "wompi" as const
    private config: GatewayConfig
    private baseUrl: string

    constructor(config: GatewayConfig) {
        this.config = config
        this.baseUrl = config.isTestMode
            ? WOMPI_API_URL.sandbox
            : WOMPI_API_URL.production
    }

    private getHeaders(): HeadersInit {
        return {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.config.privateKey}`,
        }
    }

    async createTransaction(input: TransactionInput): Promise<TransactionResult> {
        try {
            // Obtener token de aceptación
            const acceptanceToken = await this.getAcceptanceToken()

            const body: Record<string, unknown> = {
                amount_in_cents: input.amount,
                currency: input.currency,
                reference: input.reference,
                customer_email: input.customerEmail,
                acceptance_token: acceptanceToken,
                redirect_url: input.redirectUrl,
            }

            // Configurar según método de pago
            if (input.paymentMethod === "card" && input.cardToken) {
                body.payment_method = {
                    type: "CARD",
                    token: input.cardToken,
                    installments: 1,
                }
            } else if (input.paymentMethod === "pse" && input.bankCode) {
                body.payment_method = {
                    type: "PSE",
                    user_type: input.personType === "juridica" ? 1 : 0,
                    user_legal_id_type: input.customerDocumentType || "CC",
                    user_legal_id: input.customerDocument,
                    financial_institution_code: input.bankCode,
                    payment_description: `Pago ${input.reference}`,
                }
            } else if (input.paymentMethod === "nequi") {
                body.payment_method = {
                    type: "NEQUI",
                    phone_number: input.customerPhone,
                }
            }

            const response = await fetch(`${this.baseUrl}/transactions`, {
                method: "POST",
                headers: this.getHeaders(),
                body: JSON.stringify(body),
            })

            const data = await response.json()

            if (!response.ok) {
                return {
                    success: false,
                    status: "error",
                    error: data.error?.message || "Error al crear transacción",
                    rawResponse: data,
                }
            }

            return {
                success: true,
                transactionId: data.data.id,
                providerTransactionId: data.data.id,
                status: this.mapStatus(data.data.status),
                redirectUrl: data.data.redirect_url,
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
        const response = await fetch(
            `${this.baseUrl}/transactions/${transactionId}`,
            { headers: this.getHeaders() }
        )

        if (!response.ok) {
            throw new Error("Error al obtener transacción")
        }

        const data = await response.json()
        const tx = data.data

        return {
            id: tx.id,
            providerTransactionId: tx.id,
            reference: tx.reference,
            amount: tx.amount_in_cents,
            currency: tx.currency,
            status: this.mapStatus(tx.status),
            paymentMethod: tx.payment_method_type,
            createdAt: tx.created_at,
            completedAt: tx.finalized_at,
            rawResponse: data,
        }
    }

    async getTransactionByReference(reference: string): Promise<TransactionDetails> {
        const response = await fetch(
            `${this.baseUrl}/transactions?reference=${encodeURIComponent(reference)}`,
            { headers: this.getHeaders() }
        )

        if (!response.ok) {
            throw new Error("Error al obtener transacción")
        }

        const data = await response.json()
        if (!data.data || data.data.length === 0) {
            throw new Error("Transacción no encontrada")
        }

        const tx = data.data[0]
        return {
            id: tx.id,
            providerTransactionId: tx.id,
            reference: tx.reference,
            amount: tx.amount_in_cents,
            currency: tx.currency,
            status: this.mapStatus(tx.status),
            paymentMethod: tx.payment_method_type,
            createdAt: tx.created_at,
            completedAt: tx.finalized_at,
            rawResponse: data,
        }
    }

    async tokenizeCard(card: CardData): Promise<TokenResult> {
        try {
            const response = await fetch(`${this.baseUrl}/tokens/cards`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.config.publicKey}`,
                },
                body: JSON.stringify({
                    number: card.number,
                    cvc: card.cvc,
                    exp_month: card.expMonth,
                    exp_year: card.expYear,
                    card_holder: card.cardHolder,
                }),
            })

            const data = await response.json()

            if (!response.ok) {
                return {
                    success: false,
                    error: data.error?.message || "Error al tokenizar tarjeta",
                }
            }

            return {
                success: true,
                token: data.data.id,
                lastFourDigits: data.data.last_four,
                brand: data.data.brand,
                expirationMonth: data.data.exp_month,
                expirationYear: data.data.exp_year,
            }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Error desconocido",
            }
        }
    }

    async getBanks(): Promise<Bank[]> {
        const response = await fetch(
            `${this.baseUrl}/pse/financial_institutions`,
            { headers: this.getHeaders() }
        )

        if (!response.ok) {
            throw new Error("Error al obtener bancos")
        }

        const data = await response.json()
        return data.data.map((bank: { financial_institution_code: string; financial_institution_name: string }) => ({
            code: bank.financial_institution_code,
            name: bank.financial_institution_name,
        }))
    }

    async testConnection(): Promise<boolean> {
        try {
            const response = await fetch(
                `${this.baseUrl}/merchants/${this.config.publicKey}`
            )
            return response.ok
        } catch {
            return false
        }
    }

    validateWebhookSignature(
        payload: { signature?: { checksum?: string; properties?: string[] }; data?: Record<string, unknown>; timestamp?: number },
        _signature: string,
        _timestamp?: string
    ): boolean {
        if (!this.config.integritySecret) return false
        if (!payload.signature?.properties || !payload.data) return false

        const properties = payload.signature.properties
        const values: string[] = []

        for (const prop of properties) {
            const parts = prop.split(".")
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let value: any = payload.data
            for (const part of parts) {
                value = value?.[part]
            }
            if (value !== undefined) {
                values.push(String(value))
            }
        }

        values.push(String(payload.timestamp))
        values.push(this.config.integritySecret)

        const calculatedChecksum = crypto
            .createHash("sha256")
            .update(values.join(""))
            .digest("hex")

        return calculatedChecksum === payload.signature.checksum
    }

    private async getAcceptanceToken(): Promise<string> {
        const response = await fetch(
            `${this.baseUrl}/merchants/${this.config.publicKey}`
        )

        if (!response.ok) {
            throw new Error("Error al obtener token de aceptación")
        }

        const data = await response.json()
        return data.data.presigned_acceptance.acceptance_token
    }

    private mapStatus(wompiStatus: string): TransactionDetails["status"] {
        const statusMap: Record<string, TransactionDetails["status"]> = {
            APPROVED: "approved",
            DECLINED: "declined",
            VOIDED: "voided",
            ERROR: "error",
            PENDING: "pending",
        }
        return statusMap[wompiStatus] || "pending"
    }
}
