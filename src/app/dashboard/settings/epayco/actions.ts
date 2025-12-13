"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { encrypt, decrypt } from "@/lib/utils/encryption"
import { type ActionResult, success, failure } from "@/types"

interface EpaycoConfigInput {
    provider: "epayco"
    is_active: boolean
    is_test_mode: boolean
    public_key: string
    private_key: string
    integrity_secret: string // P_CUST_ID_CLIENTE
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
 * Obtiene la configuración de ePayco
 */
export async function getEpaycoConfig(): Promise<ActionResult<any>> {
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
            .eq("provider", "epayco")
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
 * Guarda la configuración de ePayco
 */
export async function saveEpaycoConfig(input: EpaycoConfigInput): Promise<ActionResult<any>> {
    try {
        const organizationId = await getCurrentOrganization()
        if (!organizationId) {
            return failure("No autorizado")
        }

        // Validar campos requeridos
        if (!input.public_key || !input.private_key || !input.integrity_secret) {
            return failure("Todos los campos son requeridos para ePayco")
        }

        const supabase = await createClient()

        // Encriptar credenciales sensibles
        const encryptedPrivateKey = encrypt(input.private_key)
        const encryptedCustomerId = encrypt(input.integrity_secret)

        // Generar URL de webhook
        const { data: org } = await supabase
            .from("organizations")
            .select("slug")
            .eq("id", organizationId)
            .single()

        const webhookUrl = org?.slug
            ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/payments/epayco?org=${org.slug}`
            : null

        const configData = {
            organization_id: organizationId,
            provider: "epayco",
            is_active: input.is_active,
            is_test_mode: input.is_test_mode,
            public_key: input.public_key,
            private_key_encrypted: encryptedPrivateKey,
            integrity_secret_encrypted: encryptedCustomerId,
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

        revalidatePath("/dashboard/settings/epayco")
        revalidatePath("/dashboard/settings/payments")

        return success(result)
    } catch (error) {
        return failure(
            error instanceof Error ? error.message : "Error al guardar configuración"
        )
    }
}

/**
 * Prueba la conexión con ePayco
 */
export async function testEpaycoConnection(): Promise<ActionResult<{ success: boolean; message: string }>> {
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
            .eq("provider", "epayco")
            .single()

        if (error || !config) {
            return failure("No hay configuración de ePayco")
        }

        // Desencriptar credenciales
        const privateKey = config.private_key_encrypted
            ? decrypt(config.private_key_encrypted)
            : ""
        const customerId = config.integrity_secret_encrypted
            ? decrypt(config.integrity_secret_encrypted)
            : ""

        // Crear instancia del gateway
        const { EpaycoGateway } = await import("@/lib/payments/epayco-gateway")
        const gateway = new EpaycoGateway({
            publicKey: config.public_key,
            privateKey: privateKey,
            integritySecret: customerId,
            isTestMode: config.is_test_mode
        })

        const isConnected = await gateway.testConnection()

        if (isConnected) {
            return success({
                success: true,
                message: "Conexión exitosa con ePayco"
            })
        } else {
            return success({
                success: false,
                message: "No se pudo conectar. Verifica las credenciales."
            })
        }
    } catch (error) {
        return failure(
            error instanceof Error ? error.message : "Error al probar conexión"
        )
    }
}