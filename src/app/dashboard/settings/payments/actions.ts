"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { encrypt, decrypt } from "@/lib/utils/encryption"
import {
    type ActionResult,
    success,
    failure,
    type PaymentGatewayConfig,
    PaymentGatewayConfigInputSchema,
    deserializePaymentGatewayConfig,
} from "@/types"

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
 * Obtiene la configuración de pasarela de pago de la organización
 */
export async function getPaymentConfig(): Promise<
    ActionResult<PaymentGatewayConfig | null>
> {
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
            .single()

        if (error && error.code !== "PGRST116") {
            // PGRST116 = no rows returned
            return failure(error.message)
        }

        if (!data) {
            return success(null)
        }

        // No devolver las credenciales encriptadas al cliente
        const config = deserializePaymentGatewayConfig(data)
        return success({
            ...config,
            private_key_encrypted: config.private_key_encrypted ? "***" : null,
            integrity_secret_encrypted: config.integrity_secret_encrypted
                ? "***"
                : null,
        })
    } catch (error) {
        return failure(
            error instanceof Error ? error.message : "Error al obtener configuración"
        )
    }
}

/**
 * Guarda la configuración de pasarela de pago
 */
export async function savePaymentConfig(
    input: unknown
): Promise<ActionResult<PaymentGatewayConfig>> {
    try {
        const organizationId = await getCurrentOrganization()
        if (!organizationId) {
            return failure("No autorizado")
        }

        // Validar input
        const validation = PaymentGatewayConfigInputSchema.safeParse(input)
        if (!validation.success) {
            return failure(validation.error.issues[0].message)
        }

        const data = validation.data
        const supabase = await createClient()

        // Encriptar credenciales sensibles
        const encryptedPrivateKey = encrypt(data.private_key)
        const encryptedIntegritySecret = data.integrity_secret
            ? encrypt(data.integrity_secret)
            : null

        // Generar URL de webhook
        const { data: org } = await supabase
            .from("organizations")
            .select("slug")
            .eq("id", organizationId)
            .single()

        const webhookUrl = org?.slug
            ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/payments/${data.provider}?org=${org.slug}`
            : null

        const configData = {
            organization_id: organizationId,
            provider: data.provider,
            is_active: data.is_active ?? false,
            is_test_mode: data.is_test_mode ?? true,
            public_key: data.public_key,
            private_key_encrypted: encryptedPrivateKey,
            integrity_secret_encrypted: encryptedIntegritySecret,
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

        revalidatePath("/dashboard/settings/payments")

        const config = deserializePaymentGatewayConfig(result)
        return success({
            ...config,
            private_key_encrypted: "***",
            integrity_secret_encrypted: config.integrity_secret_encrypted
                ? "***"
                : null,
        })
    } catch (error) {
        return failure(
            error instanceof Error ? error.message : "Error al guardar configuración"
        )
    }
}

/**
 * Prueba la conexión con la pasarela de pago
 */
export async function testConnection(): Promise<
    ActionResult<{ success: boolean; message: string }>
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
            .single()

        if (error || !config) {
            return failure("No hay configuración de pasarela")
        }

        // Desencriptar credenciales
        const privateKey = config.private_key_encrypted
            ? decrypt(config.private_key_encrypted)
            : ""
        const integritySecret = config.integrity_secret_encrypted
            ? decrypt(config.integrity_secret_encrypted)
            : undefined

        // Importar dinámicamente para evitar problemas de SSR
        const { createPaymentGateway } = await import("@/lib/payments/factory")
        const gateway = createPaymentGateway(
            deserializePaymentGatewayConfig(config),
            privateKey,
            integritySecret
        )

        const isConnected = await gateway.testConnection()

        if (isConnected) {
            return success({
                success: true,
                message: "Conexión exitosa con " + config.provider,
            })
        } else {
            return success({
                success: false,
                message: "No se pudo conectar. Verifica las credenciales.",
            })
        }
    } catch (error) {
        return failure(
            error instanceof Error ? error.message : "Error al probar conexión"
        )
    }
}

/**
 * Activa o desactiva la pasarela de pago
 */
export async function toggleGateway(
    isActive: boolean
): Promise<ActionResult<void>> {
    try {
        const organizationId = await getCurrentOrganization()
        if (!organizationId) {
            return failure("No autorizado")
        }

        const supabase = await createClient()
        const { error } = await supabase
            .from("payment_gateway_configs")
            .update({ is_active: isActive, updated_at: new Date().toISOString() })
            .eq("organization_id", organizationId)

        if (error) {
            return failure(error.message)
        }

        revalidatePath("/dashboard/settings/payments")
        return success(undefined)
    } catch (error) {
        return failure(
            error instanceof Error ? error.message : "Error al actualizar estado"
        )
    }
}
