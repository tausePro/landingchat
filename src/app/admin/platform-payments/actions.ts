"use server"

import { createServiceClient } from "@/lib/supabase/server"
import { createClient } from "@/lib/supabase/server"
import { encrypt, decrypt } from "@/lib/utils/encryption"
import { revalidatePath } from "next/cache"

export interface PlatformWompiConfig {
    provider: "wompi"
    is_active: boolean
    is_test_mode: boolean
    public_key: string
    webhook_url: string
}

export interface PlatformWompiConfigWithSecrets extends PlatformWompiConfig {
    private_key: string
    integrity_secret: string
}

interface ConfigRow {
    id: string
    key: string
    value: PlatformWompiConfig
    encrypted_values: {
        private_key_encrypted?: string
        integrity_secret_encrypted?: string
    }
}

/**
 * Verifica que el usuario sea superadmin
 */
async function verifySuperadmin(): Promise<boolean> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return false

    const { data: profile } = await supabase
        .from("profiles")
        .select("is_superadmin")
        .eq("id", user.id)
        .single()

    return profile?.is_superadmin === true
}

/**
 * Obtiene la configuración de Wompi de la plataforma
 */
export async function getPlatformWompiConfig(): Promise<{
    success: boolean
    data?: PlatformWompiConfig & { has_private_key: boolean; has_integrity_secret: boolean }
    error?: string
}> {
    try {
        if (!await verifySuperadmin()) {
            return { success: false, error: "No autorizado" }
        }

        const supabase = createServiceClient()

        const { data, error } = await supabase
            .from("platform_config")
            .select("*")
            .eq("key", "payment_gateway_wompi")
            .single()

        if (error) {
            if (error.code === "PGRST116") {
                // No existe, retornar config vacía
                return {
                    success: true,
                    data: {
                        provider: "wompi",
                        is_active: false,
                        is_test_mode: true,
                        public_key: "",
                        webhook_url: "",
                        has_private_key: false,
                        has_integrity_secret: false,
                    }
                }
            }
            throw error
        }

        const config = data as ConfigRow
        const encryptedValues = config.encrypted_values || {}

        return {
            success: true,
            data: {
                ...config.value,
                has_private_key: !!encryptedValues.private_key_encrypted,
                has_integrity_secret: !!encryptedValues.integrity_secret_encrypted,
            }
        }
    } catch (error) {
        console.error("[getPlatformWompiConfig] Error:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Error desconocido"
        }
    }
}

/**
 * Guarda la configuración de Wompi de la plataforma
 */
export async function savePlatformWompiConfig(input: {
    is_active: boolean
    is_test_mode: boolean
    public_key: string
    private_key?: string  // Solo si se quiere actualizar
    integrity_secret?: string  // Solo si se quiere actualizar
}): Promise<{ success: boolean; error?: string }> {
    try {
        if (!await verifySuperadmin()) {
            return { success: false, error: "No autorizado" }
        }

        const supabase = createServiceClient()

        // Obtener configuración existente para preservar valores encriptados si no se actualizan
        const { data: existing } = await supabase
            .from("platform_config")
            .select("encrypted_values")
            .eq("key", "payment_gateway_wompi")
            .single()

        const existingEncrypted = (existing?.encrypted_values as ConfigRow["encrypted_values"]) || {}

        // Preparar valores encriptados
        const encryptedValues: ConfigRow["encrypted_values"] = {
            private_key_encrypted: existingEncrypted.private_key_encrypted,
            integrity_secret_encrypted: existingEncrypted.integrity_secret_encrypted,
        }

        // Encriptar nuevos valores si se proporcionan
        if (input.private_key && input.private_key.trim()) {
            encryptedValues.private_key_encrypted = encrypt(input.private_key.trim())
        }
        if (input.integrity_secret && input.integrity_secret.trim()) {
            encryptedValues.integrity_secret_encrypted = encrypt(input.integrity_secret.trim())
        }

        // Generar webhook URL
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://landingchat.co"
        const webhookUrl = `${baseUrl}/api/webhooks/subscriptions/wompi`

        const value: PlatformWompiConfig = {
            provider: "wompi",
            is_active: input.is_active,
            is_test_mode: input.is_test_mode,
            public_key: input.public_key.trim(),
            webhook_url: webhookUrl,
        }

        // Upsert configuración
        const { error } = await supabase
            .from("platform_config")
            .upsert({
                key: "payment_gateway_wompi",
                value,
                encrypted_values: encryptedValues,
                description: "Configuración de Wompi para cobrar suscripciones de la plataforma",
            }, {
                onConflict: "key",
            })

        if (error) throw error

        revalidatePath("/admin/platform-payments")

        return { success: true }
    } catch (error) {
        console.error("[savePlatformWompiConfig] Error:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Error desconocido"
        }
    }
}

/**
 * Prueba la conexión con Wompi
 */
export async function testWompiConnection(): Promise<{
    success: boolean
    message: string
    details?: {
        merchant_name?: string
        merchant_legal_name?: string
        accepted_currencies?: string[]
    }
}> {
    try {
        if (!await verifySuperadmin()) {
            return { success: false, message: "No autorizado" }
        }

        const supabase = createServiceClient()

        const { data, error } = await supabase
            .from("platform_config")
            .select("*")
            .eq("key", "payment_gateway_wompi")
            .single()

        if (error || !data) {
            return { success: false, message: "Configuración no encontrada" }
        }

        const config = data as ConfigRow
        const encryptedValues = config.encrypted_values || {}

        if (!config.value.public_key) {
            return { success: false, message: "Public Key no configurada" }
        }

        if (!encryptedValues.private_key_encrypted) {
            return { success: false, message: "Private Key no configurada" }
        }

        // Desencriptar credenciales
        let privateKey = ""
        let integritySecret = ""

        try {
            privateKey = decrypt(encryptedValues.private_key_encrypted)
            if (encryptedValues.integrity_secret_encrypted) {
                integritySecret = decrypt(encryptedValues.integrity_secret_encrypted)
            }
        } catch {
            return { success: false, message: "Error al desencriptar credenciales" }
        }

        // Test básico: obtener info del merchant
        const baseUrl = config.value.is_test_mode
            ? "https://sandbox.wompi.co/v1"
            : "https://production.wompi.co/v1"

        const response = await fetch(`${baseUrl}/merchants/${config.value.public_key}`)

        if (!response.ok) {
            return {
                success: false,
                message: `Error de conexión: ${response.status} ${response.statusText}`
            }
        }

        const merchantData = await response.json()

        return {
            success: true,
            message: "Conexión exitosa con Wompi",
            details: {
                merchant_name: merchantData.data?.name,
                merchant_legal_name: merchantData.data?.legal_name,
                accepted_currencies: merchantData.data?.accepted_currencies,
            }
        }
    } catch (error) {
        console.error("[testWompiConnection] Error:", error)
        return {
            success: false,
            message: error instanceof Error ? error.message : "Error desconocido"
        }
    }
}

/**
 * Obtiene la configuración completa con secretos desencriptados
 * Solo para uso interno del servidor
 */
export async function getPlatformWompiCredentials(): Promise<{
    success: boolean
    data?: {
        publicKey: string
        privateKey: string
        integritySecret: string
        isTestMode: boolean
        isActive: boolean
    }
    error?: string
}> {
    try {
        const supabase = createServiceClient()

        const { data, error } = await supabase
            .from("platform_config")
            .select("*")
            .eq("key", "payment_gateway_wompi")
            .single()

        if (error || !data) {
            return { success: false, error: "Configuración de Wompi no encontrada" }
        }

        const config = data as ConfigRow
        const encryptedValues = config.encrypted_values || {}

        if (!config.value.is_active) {
            return { success: false, error: "Wompi no está activo" }
        }

        if (!encryptedValues.private_key_encrypted) {
            return { success: false, error: "Private Key no configurada" }
        }

        const privateKey = decrypt(encryptedValues.private_key_encrypted)
        const integritySecret = encryptedValues.integrity_secret_encrypted
            ? decrypt(encryptedValues.integrity_secret_encrypted)
            : ""

        return {
            success: true,
            data: {
                publicKey: config.value.public_key,
                privateKey,
                integritySecret,
                isTestMode: config.value.is_test_mode,
                isActive: config.value.is_active,
            }
        }
    } catch (error) {
        console.error("[getPlatformWompiCredentials] Error:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Error desconocido"
        }
    }
}
