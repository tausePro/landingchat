"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { encrypt, decrypt } from "@/lib/utils/encryption"
import { type ActionResult, success, failure } from "@/types"

interface BoldConfigInput {
    provider: "bold"
    is_active: boolean
    is_test_mode: boolean
    /**
     * Identity Key pública de Bold. No es un `pk_*` como Wompi — Bold usa
     * un identity key que se expone al frontend para el botón de pago.
     * Opcional en este flujo porque hoy usamos el hosted checkout vía API.
     */
    public_key: string
    /**
     * API Key privada de Bold (x-api-key). Se envía en el header
     * `Authorization: x-api-key <valor>` para crear payment links.
     */
    private_key: string
    /**
     * Signature Key para validar el header `x-bold-signature` de los
     * webhooks. Se almacena en `integrity_secret_encrypted` por parity
     * con Wompi/ePayco.
     */
    integrity_secret: string
}

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
 * Obtiene la configuración de Bold para la organización actual.
 */
export async function getBoldConfig(): Promise<ActionResult<Record<string, unknown> | null>> {
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
            .eq("provider", "bold")
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
 * Guarda la configuración de Bold. Encripta API key y signature key.
 */
export async function saveBoldConfig(input: BoldConfigInput): Promise<ActionResult<Record<string, unknown>>> {
    try {
        const organizationId = await getCurrentOrganization()
        if (!organizationId) {
            return failure("No autorizado")
        }

        if (!input.private_key) {
            return failure("El API Key es requerido")
        }

        const supabase = await createClient()

        const encryptedPrivateKey = encrypt(input.private_key)
        const encryptedIntegritySecret = input.integrity_secret
            ? encrypt(input.integrity_secret)
            : null

        const { data: org } = await supabase
            .from("organizations")
            .select("slug")
            .eq("id", organizationId)
            .single()

        const webhookUrl = org?.slug
            ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/payments/bold?org=${org.slug}`
            : null

        const configData = {
            organization_id: organizationId,
            provider: "bold",
            is_active: input.is_active,
            is_test_mode: input.is_test_mode,
            public_key: input.public_key || null,
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

        revalidatePath("/dashboard/settings/bold")
        revalidatePath("/dashboard/settings/payments")

        return success(result)
    } catch (error) {
        return failure(
            error instanceof Error ? error.message : "Error al guardar configuración"
        )
    }
}

/**
 * Prueba la conexión con Bold llamando `testConnection()` del gateway,
 * que bajo el capó hace GET `/online/methods/v1`. Un 200 indica que el
 * API key es válido.
 */
export async function testBoldConnection(): Promise<
    ActionResult<{
        success: boolean
        message: string
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
            .eq("provider", "bold")
            .single()

        if (error || !config) {
            return failure("No hay configuración de Bold. Guarda las credenciales primero.")
        }

        const privateKey = config.private_key_encrypted
            ? decrypt(config.private_key_encrypted)
            : ""

        const integritySecret = config.integrity_secret_encrypted
            ? decrypt(config.integrity_secret_encrypted)
            : undefined

        const { BoldGateway } = await import("@/lib/payments/bold-gateway")
        const gateway = new BoldGateway({
            provider: "bold",
            publicKey: config.public_key || "",
            privateKey,
            integritySecret,
            isTestMode: config.is_test_mode,
        })

        const isConnected = await gateway.testConnection()

        if (isConnected) {
            return success({
                success: true,
                message: "Conexión exitosa con Bold",
            })
        }

        return success({
            success: false,
            message: "No se pudo conectar con Bold. Verifica que el API Key sea válido para el modo seleccionado.",
        })
    } catch (error) {
        return failure(
            error instanceof Error ? error.message : "Error al probar conexión"
        )
    }
}
