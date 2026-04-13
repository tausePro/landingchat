"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { encrypt, decrypt } from "@/lib/utils/encryption"
import { type ActionResult, success, failure } from "@/types"

interface WompiConfigInput {
    provider: "wompi"
    is_active: boolean
    is_test_mode: boolean
    public_key: string
    private_key: string
    integrity_secret: string
    events_secret?: string
}

/**
 * Obtiene la organización del usuario actual
 */
async function getCurrentOrganization() {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) return null

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    return profile?.organization_id
}

/**
 * Obtiene la configuración de Wompi para la organización actual
 */
export async function getWompiConfig(): Promise<ActionResult<Record<string, unknown> | null>> {
    try {
        const organizationId = await getCurrentOrganization()
        if (!organizationId) {
            return failure("No autorizado")
        }

        const supabase = await createClient()
        const { data, error } = await supabase
            .from("payment_gateway_configs")
            .select("*")
            .eq("organization_id", organizationId)
            .eq("provider", "wompi")
            .single()

        if (error && error.code !== "PGRST116") {
            return failure(error.message)
        }

        return success(data)
    } catch (error) {
        return failure(
            error instanceof Error ? error.message : "Error al obtener configuración"
        )
    }
}

/**
 * Guarda la configuración de Wompi
 */
export async function saveWompiConfig(input: WompiConfigInput): Promise<ActionResult<Record<string, unknown>>> {
    try {
        const organizationId = await getCurrentOrganization()
        if (!organizationId) {
            return failure("No autorizado")
        }

        if (!input.public_key || !input.private_key) {
            return failure("Llave pública y privada son requeridas")
        }

        const supabase = await createClient()

        // Encriptar credenciales sensibles
        const encryptedPrivateKey = encrypt(input.private_key)
        const encryptedIntegritySecret = input.integrity_secret
            ? encrypt(input.integrity_secret)
            : null
        const encryptedEventsSecret = input.events_secret
            ? encrypt(input.events_secret)
            : null

        // Generar URL de webhook
        const { data: org } = await supabase
            .from("organizations")
            .select("slug")
            .eq("id", organizationId)
            .single()

        const webhookUrl = org?.slug
            ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/payments/wompi?org=${org.slug}`
            : null

        const configData = {
            organization_id: organizationId,
            provider: "wompi",
            is_active: input.is_active,
            is_test_mode: input.is_test_mode,
            public_key: input.public_key,
            private_key_encrypted: encryptedPrivateKey,
            integrity_secret_encrypted: encryptedIntegritySecret,
            events_secret_encrypted: encryptedEventsSecret,
            webhook_url: webhookUrl,
            updated_at: new Date().toISOString(),
        }

        const { data: result, error } = await supabase
            .from("payment_gateway_configs")
            .upsert(configData, {
                onConflict: "organization_id,provider",
            })
            .select()
            .single()

        if (error) {
            return failure(error.message)
        }

        revalidatePath("/dashboard/settings/wompi")
        revalidatePath("/dashboard/settings/payments")

        return success(result)
    } catch (error) {
        return failure(
            error instanceof Error ? error.message : "Error al guardar configuración"
        )
    }
}

/**
 * Prueba la conexión con Wompi usando el endpoint de merchants
 */
export async function testWompiConnection(): Promise<
    ActionResult<{
        success: boolean
        message: string
        merchant?: { name: string; legal_name: string; accepted_currencies: string[] }
    }>
> {
    try {
        const organizationId = await getCurrentOrganization()
        if (!organizationId) {
            return failure("No autorizado")
        }

        const supabase = await createClient()
        const { data: config, error } = await supabase
            .from("payment_gateway_configs")
            .select("*")
            .eq("organization_id", organizationId)
            .eq("provider", "wompi")
            .single()

        if (error || !config) {
            return failure("No hay configuración de Wompi. Guarda las credenciales primero.")
        }

        // Desencriptar credenciales
        const privateKey = config.private_key_encrypted
            ? decrypt(config.private_key_encrypted)
            : ""

        const integritySecret = config.integrity_secret_encrypted
            ? decrypt(config.integrity_secret_encrypted)
            : undefined

        // Crear instancia del gateway
        const { WompiGateway } = await import("@/lib/payments/wompi-gateway")
        const gateway = new WompiGateway({
            provider: "wompi",
            publicKey: config.public_key || "",
            privateKey,
            integritySecret,
            isTestMode: config.is_test_mode,
        })

        // testConnection() hace GET /merchants/{publicKey}
        const isConnected = await gateway.testConnection()

        if (isConnected) {
            // Obtener datos del merchant para mostrar info
            const baseUrl = config.is_test_mode
                ? "https://sandbox.wompi.co/v1"
                : "https://production.wompi.co/v1"

            const merchantResponse = await fetch(`${baseUrl}/merchants/${config.public_key}`)
            let merchantInfo = undefined

            if (merchantResponse.ok) {
                const merchantData = await merchantResponse.json()
                merchantInfo = {
                    name: merchantData.data?.name || "",
                    legal_name: merchantData.data?.legal_name || "",
                    accepted_currencies: merchantData.data?.accepted_currencies || [],
                }
            }

            return success({
                success: true,
                message: "Conexión exitosa con Wompi",
                merchant: merchantInfo,
            })
        } else {
            return success({
                success: false,
                message: "No se pudo conectar. Verifica que la llave pública sea correcta.",
            })
        }
    } catch (error) {
        return failure(
            error instanceof Error ? error.message : "Error al probar conexión"
        )
    }
}
