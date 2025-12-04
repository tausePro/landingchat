/**
 * Cliente para integración con Wompi API
 * Documentación: https://docs.wompi.co/
 */

import crypto from "crypto"
import {
    type WompiConfig,
    type WompiTransactionRequest,
    type WompiTransactionResponse,
    type WompiWebhookPayload,
} from "./types"

const WOMPI_API_URL = {
    sandbox: "https://sandbox.wompi.co/v1",
    production: "https://production.wompi.co/v1",
}

export class WompiClient {
    private config: WompiConfig
    private baseUrl: string

    constructor(config: WompiConfig) {
        this.config = config
        this.baseUrl = WOMPI_API_URL[config.environment]
    }

    /**
     * Obtiene los headers de autenticación
     */
    private getHeaders(): HeadersInit {
        return {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.config.privateKey}`,
        }
    }

    /**
     * Crea una nueva transacción
     */
    async createTransaction(
        request: WompiTransactionRequest
    ): Promise<WompiTransactionResponse> {
        const response = await fetch(`${this.baseUrl}/transactions`, {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify(request),
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(`Wompi error: ${error.error?.message || "Unknown error"}`)
        }

        return response.json()
    }

    /**
     * Obtiene una transacción por ID
     */
    async getTransaction(transactionId: string): Promise<WompiTransactionResponse> {
        const response = await fetch(`${this.baseUrl}/transactions/${transactionId}`, {
            method: "GET",
            headers: this.getHeaders(),
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(`Wompi error: ${error.error?.message || "Unknown error"}`)
        }

        return response.json()
    }

    /**
     * Obtiene una transacción por referencia
     */
    async getTransactionByReference(reference: string): Promise<WompiTransactionResponse> {
        const response = await fetch(
            `${this.baseUrl}/transactions?reference=${encodeURIComponent(reference)}`,
            {
                method: "GET",
                headers: this.getHeaders(),
            }
        )

        if (!response.ok) {
            const error = await response.json()
            throw new Error(`Wompi error: ${error.error?.message || "Unknown error"}`)
        }

        return response.json()
    }

    /**
     * Valida la firma de un webhook
     */
    validateWebhookSignature(payload: WompiWebhookPayload): boolean {
        const { signature, data, timestamp } = payload

        // Construir el string a firmar según las propiedades indicadas
        const properties = signature.properties
        const values: string[] = []

        for (const prop of properties) {
            const parts = prop.split(".")
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let value: any = data

            for (const part of parts) {
                value = value?.[part]
            }

            if (value !== undefined) {
                values.push(String(value))
            }
        }

        // Agregar timestamp y secreto
        values.push(String(timestamp))
        values.push(this.config.integritySecret)

        // Calcular checksum
        const stringToSign = values.join("")
        const calculatedChecksum = crypto
            .createHash("sha256")
            .update(stringToSign)
            .digest("hex")

        return calculatedChecksum === signature.checksum
    }

    /**
     * Genera un token de aceptación (para términos y condiciones)
     */
    async getAcceptanceToken(): Promise<string> {
        const response = await fetch(`${this.baseUrl}/merchants/${this.config.publicKey}`, {
            method: "GET",
        })

        if (!response.ok) {
            throw new Error("Error al obtener token de aceptación")
        }

        const data = await response.json()
        return data.data.presigned_acceptance.acceptance_token
    }

    /**
     * Verifica la conexión con Wompi
     */
    async testConnection(): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/merchants/${this.config.publicKey}`, {
                method: "GET",
            })
            return response.ok
        } catch {
            return false
        }
    }
}

/**
 * Crea una instancia del cliente Wompi con las variables de entorno
 */
export function createWompiClient(): WompiClient | null {
    const publicKey = process.env.WOMPI_PUBLIC_KEY
    const privateKey = process.env.WOMPI_PRIVATE_KEY
    const integritySecret = process.env.WOMPI_INTEGRITY_SECRET
    const environment = (process.env.WOMPI_ENVIRONMENT || "sandbox") as "sandbox" | "production"

    if (!publicKey || !privateKey || !integritySecret) {
        console.warn("Wompi credentials not configured")
        return null
    }

    return new WompiClient({
        publicKey,
        privateKey,
        integritySecret,
        environment,
    })
}
