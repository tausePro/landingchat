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

function appendAccessToCheckoutUrl(checkoutUrl: string, redirectUrl: string) {
    try {
        const sourceUrl = new URL(redirectUrl)
        const access = sourceUrl.searchParams.get("access")

        if (!access) {
            return checkoutUrl
        }

        const targetUrl = new URL(checkoutUrl)
        targetUrl.searchParams.set("access", access)
        return targetUrl.toString()
    } catch {
        return checkoutUrl
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getNestedValue(root: unknown, path: string) {
    let current: unknown = root

    for (const part of path.split(".")) {
        if (!isRecord(current)) return undefined
        current = current[part]
    }

    return current
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
            // Wompi usa el Widget de Checkout del lado del cliente (checkout.wompi.co/widget.js)
            // Similar a ePayco: redirigimos a una página interna que carga el widget
            // La firma de integridad se genera server-side en la página de checkout
            
            const redirectUrl = input.redirectUrl || ""
            let checkoutUrl: string

            // Detectar si es dominio personalizado (no contiene /store/)
            if (redirectUrl.includes("/store/")) {
                const urlParts = redirectUrl.match(/(.+)\/store\/([^/]+)\/order\//)
                const baseUrl = urlParts?.[1] || process.env.NEXT_PUBLIC_APP_URL || "https://landingchat.co"
                const slug = urlParts?.[2] || ""
                checkoutUrl = `${baseUrl}/store/${slug}/checkout/wompi/${input.reference}`
            } else {
                const urlParts = redirectUrl.match(/(.+)\/order\//)
                const baseUrl = urlParts?.[1] || ""
                checkoutUrl = `${baseUrl}/checkout/wompi/${input.reference}`
            }

            checkoutUrl = appendAccessToCheckoutUrl(checkoutUrl, redirectUrl)

            return {
                success: true,
                transactionId: input.reference,
                providerTransactionId: input.reference,
                status: "pending",
                redirectUrl: checkoutUrl,
                rawResponse: {
                    message: "Redirect to Wompi checkout widget page",
                    checkoutUrl,
                },
            }
        } catch (error) {
            return {
                success: false,
                status: "error",
                error: error instanceof Error ? error.message : "Error desconocido",
            }
        }
    }

    /**
     * Genera la firma de integridad SHA256 requerida por el Widget de Wompi
     * Concatena: reference + amountInCents + currency + integritySecret
     */
    generateIntegritySignature(reference: string, amountInCents: number, currency: string): string {
        if (!this.config.integritySecret) {
            throw new Error("Integrity secret no configurado")
        }
        const concatenated = `${reference}${amountInCents}${currency}${this.config.integritySecret}`
        return crypto
            .createHash("sha256")
            .update(concatenated)
            .digest("hex")
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
        void _signature
        void _timestamp

        if (!this.config.integritySecret) return false
        if (!payload.signature?.properties || !payload.signature.checksum || !payload.data) return false

        const properties = payload.signature.properties
        const values: string[] = []

        for (const prop of properties) {
            const value = getNestedValue(payload.data, prop)
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

        return calculatedChecksum.toLowerCase() === payload.signature.checksum.toLowerCase()
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
