/**
 * Tipos para Evolution API
 * Documentación: https://doc.evolution-api.com/
 */

export interface EvolutionConfig {
    baseUrl: string
    apiKey: string
}

// ============================================
// Gestión de Instancias
// ============================================

/**
 * Evolution API v2.x - Create Instance Request
 * @see https://doc.evolution-api.com/v2/pt/get-started/instances#criar-instância
 */
export interface CreateInstanceRequest {
    instanceName: string
    token?: string
    number?: string
    qrcode?: boolean
    // Integration type - required in v2.x
    integration?: "WHATSAPP-BAILEYS" | "WHATSAPP-BUSINESS"
    // Webhook configuration for v2.x
    webhook?: {
        url: string
        byEvents?: boolean
        base64?: boolean
        headers?: Record<string, string>
        events?: string[]
    }
    // Legacy fields (v1.x) - kept for compatibility
    webhookUrl?: string
    webhookByEvents?: boolean
    webhookBase64?: boolean
    events?: string[]
}

export interface CreateInstanceResponse {
    instance: {
        instanceName: string
        status: string
    }
    hash: {
        apikey: string
    }
    webhook?: string
    qrcode?: {
        code: string
        base64: string
    }
}

export interface InstanceInfo {
    instanceName: string
    status: "open" | "close" | "connecting"
    serverUrl: string
    apikey: string
    owner: string
    profileName?: string
    profilePictureUrl?: string
    profileStatus?: string
    phoneNumber?: string
}

export interface QRCodeResponse {
    code: string
    base64: string
    count: number
}

export interface ConnectionState {
    instance: string
    state: "open" | "close" | "connecting"
}

// ============================================
// Mensajería
// ============================================

export interface SendTextMessageRequest {
    number: string // Número con código de país (ej: 573001234567)
    text: string
    delay?: number
}

export interface SendMediaMessageRequest {
    number: string
    mediatype: "image" | "video" | "audio" | "document"
    media: string // URL o base64
    caption?: string
    fileName?: string
    delay?: number
}

export interface SendButtonMessageRequest {
    number: string
    title: string
    description?: string
    footer?: string
    buttons: Array<{
        buttonId: string
        buttonText: {
            displayText: string
        }
        type: number
    }>
}

export interface SendMessageResponse {
    key: {
        remoteJid: string
        fromMe: boolean
        id: string
    }
    message: Record<string, unknown>
    messageTimestamp: string
    status: string
}

// ============================================
// Webhooks
// ============================================

export interface WebhookMessage {
    key: {
        remoteJid: string
        fromMe: boolean
        id: string
    }
    pushName?: string
    message?: {
        conversation?: string
        extendedTextMessage?: {
            text: string
        }
        imageMessage?: {
            url: string
            caption?: string
        }
    }
    messageType: string
    messageTimestamp: number
    instanceName: string
    source: string
}

export interface WebhookConnectionUpdate {
    instance: string
    state: "open" | "close" | "connecting"
    statusReason?: number
}

export interface WebhookQRCode {
    instance: string
    qrcode: {
        code: string
        base64: string
    }
}

// ============================================
// Errores
// ============================================

export interface EvolutionError {
    error: string
    message: string
    statusCode?: number
}
