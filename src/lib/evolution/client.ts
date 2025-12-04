/**
 * Cliente para Evolution API
 * Documentación: https://doc.evolution-api.com/
 */

import type {
    EvolutionConfig,
    CreateInstanceRequest,
    CreateInstanceResponse,
    InstanceInfo,
    QRCodeResponse,
    ConnectionState,
    SendTextMessageRequest,
    SendMediaMessageRequest,
    SendButtonMessageRequest,
    SendMessageResponse,
} from "./types"

export class EvolutionClient {
    private config: EvolutionConfig

    constructor(config: EvolutionConfig) {
        this.config = config
    }

    /**
     * Headers de autenticación
     */
    private getHeaders(): HeadersInit {
        return {
            "Content-Type": "application/json",
            apikey: this.config.apiKey,
        }
    }

    // ============================================
    // Gestión de Instancias
    // ============================================

    /**
     * Crea una nueva instancia de WhatsApp
     */
    async createInstance(
        request: CreateInstanceRequest
    ): Promise<CreateInstanceResponse> {
        const response = await fetch(`${this.config.baseUrl}/instance/create`, {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify(request),
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(
                `Evolution API error: ${error.message || "Failed to create instance"}`
            )
        }

        return response.json()
    }

    /**
     * Elimina una instancia
     */
    async deleteInstance(instanceName: string): Promise<void> {
        const response = await fetch(
            `${this.config.baseUrl}/instance/delete/${instanceName}`,
            {
                method: "DELETE",
                headers: this.getHeaders(),
            }
        )

        if (!response.ok) {
            const error = await response.json()
            throw new Error(
                `Evolution API error: ${error.message || "Failed to delete instance"}`
            )
        }
    }

    /**
     * Obtiene información de una instancia
     */
    async getInstance(instanceName: string): Promise<InstanceInfo> {
        const response = await fetch(
            `${this.config.baseUrl}/instance/fetchInstances?instanceName=${instanceName}`,
            {
                method: "GET",
                headers: this.getHeaders(),
            }
        )

        if (!response.ok) {
            const error = await response.json()
            throw new Error(
                `Evolution API error: ${error.message || "Failed to get instance"}`
            )
        }

        const data = await response.json()
        return Array.isArray(data) ? data[0] : data
    }

    /**
     * Obtiene el código QR de una instancia
     */
    async getQRCode(instanceName: string): Promise<QRCodeResponse> {
        const response = await fetch(
            `${this.config.baseUrl}/instance/connect/${instanceName}`,
            {
                method: "GET",
                headers: this.getHeaders(),
            }
        )

        if (!response.ok) {
            const error = await response.json()
            throw new Error(
                `Evolution API error: ${error.message || "Failed to get QR code"}`
            )
        }

        const data = await response.json()
        return data.qrcode || data
    }

    /**
     * Obtiene el estado de conexión de una instancia
     */
    async getConnectionStatus(instanceName: string): Promise<ConnectionState> {
        const response = await fetch(
            `${this.config.baseUrl}/instance/connectionState/${instanceName}`,
            {
                method: "GET",
                headers: this.getHeaders(),
            }
        )

        if (!response.ok) {
            const error = await response.json()
            throw new Error(
                `Evolution API error: ${error.message || "Failed to get connection status"}`
            )
        }

        return response.json()
    }

    /**
     * Desconecta una instancia (logout)
     */
    async logout(instanceName: string): Promise<void> {
        const response = await fetch(
            `${this.config.baseUrl}/instance/logout/${instanceName}`,
            {
                method: "DELETE",
                headers: this.getHeaders(),
            }
        )

        if (!response.ok) {
            const error = await response.json()
            throw new Error(
                `Evolution API error: ${error.message || "Failed to logout"}`
            )
        }
    }

    // ============================================
    // Mensajería
    // ============================================

    /**
     * Envía un mensaje de texto
     */
    async sendTextMessage(
        instanceName: string,
        request: SendTextMessageRequest
    ): Promise<SendMessageResponse> {
        return this.sendMessageWithRetry(instanceName, async () => {
            const response = await fetch(
                `${this.config.baseUrl}/message/sendText/${instanceName}`,
                {
                    method: "POST",
                    headers: this.getHeaders(),
                    body: JSON.stringify(request),
                }
            )

            if (!response.ok) {
                const error = await response.json()
                throw new Error(
                    `Evolution API error: ${error.message || "Failed to send message"}`
                )
            }

            return response.json()
        })
    }

    /**
     * Envía un mensaje con media (imagen, video, etc.)
     */
    async sendMediaMessage(
        instanceName: string,
        request: SendMediaMessageRequest
    ): Promise<SendMessageResponse> {
        return this.sendMessageWithRetry(instanceName, async () => {
            const response = await fetch(
                `${this.config.baseUrl}/message/sendMedia/${instanceName}`,
                {
                    method: "POST",
                    headers: this.getHeaders(),
                    body: JSON.stringify(request),
                }
            )

            if (!response.ok) {
                const error = await response.json()
                throw new Error(
                    `Evolution API error: ${error.message || "Failed to send media"}`
                )
            }

            return response.json()
        })
    }

    /**
     * Envía un mensaje con botones
     */
    async sendButtonMessage(
        instanceName: string,
        request: SendButtonMessageRequest
    ): Promise<SendMessageResponse> {
        return this.sendMessageWithRetry(instanceName, async () => {
            const response = await fetch(
                `${this.config.baseUrl}/message/sendButtons/${instanceName}`,
                {
                    method: "POST",
                    headers: this.getHeaders(),
                    body: JSON.stringify(request),
                }
            )

            if (!response.ok) {
                const error = await response.json()
                throw new Error(
                    `Evolution API error: ${error.message || "Failed to send buttons"}`
                )
            }

            return response.json()
        })
    }

    /**
     * Envía un mensaje con reintentos y backoff exponencial
     */
    private async sendMessageWithRetry<T>(
        instanceName: string,
        sendFn: () => Promise<T>,
        maxRetries = 3
    ): Promise<T> {
        let lastError: Error | null = null

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await sendFn()
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error))

                if (attempt < maxRetries - 1) {
                    // Backoff exponencial: 1s, 2s, 4s
                    const delay = Math.pow(2, attempt) * 1000
                    await new Promise((resolve) => setTimeout(resolve, delay))
                }
            }
        }

        throw lastError || new Error("Failed to send message after retries")
    }

    /**
     * Verifica la conexión con Evolution API
     */
    async testConnection(): Promise<boolean> {
        try {
            const response = await fetch(`${this.config.baseUrl}/instance/fetchInstances`, {
                method: "GET",
                headers: this.getHeaders(),
            })
            return response.ok
        } catch {
            return false
        }
    }
}

/**
 * Crea una instancia del cliente Evolution con configuración del sistema
 */
export async function createEvolutionClient(
    supabase: any
): Promise<EvolutionClient | null> {
    const { data: settings, error } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "evolution_api_config")
        .single()

    if (error || !settings?.value) {
        console.warn("Evolution API not configured")
        return null
    }

    const config = settings.value as { url: string; apiKey: string }

    return new EvolutionClient({
        baseUrl: config.url,
        apiKey: config.apiKey,
    })
}
