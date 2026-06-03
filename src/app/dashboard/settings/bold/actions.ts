"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { encrypt, decrypt } from "@/lib/utils/encryption"
import { type ActionResult, success, failure } from "@/types"

/**
 * Contrato del UI de Bold.
 *
 * Bold NO usa llave pública. Tiene dos llaves (docs:
 * https://developers.bold.co/pagos-en-linea/llaves-de-integracion):
 *   - Llave de identidad (API key): identifica el comercio → header `x-api-key`.
 *     La persistimos en `private_key_encrypted`.
 *   - Llave secreta: HMAC-SHA256 de la firma del webhook (`x-bold-signature`).
 *     La persistimos en `integrity_secret_encrypted`.
 */
interface BoldConfigInput {
    is_active: boolean
    is_test_mode: boolean
    /** Llave de identidad (API key) — header x-api-key */
    identity_key: string
    /** Llave secreta — HMAC del webhook (opcional: vacía preserva la existente) */
    secret_key?: string
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
 * Obtiene la configuración de Bold para la organización actual
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
 * Guarda la configuración de Bold
 *
 * Contrato con el UI:
 *   - `identity_key`: SIEMPRE requerida al guardar (el UI obliga a re-ingresarla).
 *   - `secret_key`: opcional — si llega vacía, se PRESERVA el valor existente en DB
 *     (mismo patrón que wompi para no borrar secretos válidos en un UPDATE).
 */
export async function saveBoldConfig(
    input: BoldConfigInput
): Promise<ActionResult<Record<string, unknown>>> {
    try {
        const organizationId = await getCurrentOrganization()
        if (!organizationId) {
            return failure("No autorizado")
        }

        if (!input.identity_key) {
            return failure("La llave de identidad es requerida")
        }

        const supabase = await createClient()

        // Generar URL de webhook (handler genérico por provider)
        const { data: org } = await supabase
            .from("organizations")
            .select("slug")
            .eq("id", organizationId)
            .single()

        const webhookUrl = org?.slug
            ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/payments/bold?org=${org.slug}`
            : null

        // Bold no tiene llave pública: la llave de identidad va como private_key
        // (x-api-key) y la secreta como integrity_secret (HMAC webhook).
        const configData: Record<string, unknown> = {
            organization_id: organizationId,
            provider: "bold",
            is_active: input.is_active,
            is_test_mode: input.is_test_mode,
            private_key_encrypted: encrypt(input.identity_key),
            webhook_url: webhookUrl,
            updated_at: new Date().toISOString(),
        }

        // La llave secreta solo se incluye si viene con contenido; si llega vacía
        // se omite y el valor previo en DB queda intacto.
        if (input.secret_key) {
            configData.integrity_secret_encrypted = encrypt(input.secret_key)
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
 * Prueba la conexión con Bold consultando los métodos de pago disponibles
 * (GET /online/link/v1/payment_methods, autenticado con la llave de identidad).
 */
export async function testBoldConnection(): Promise<
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
            .eq("provider", "bold")
            .single()

        if (error || !config) {
            return failure("No hay configuración de Bold. Guarda las credenciales primero.")
        }

        const identityKey = config.private_key_encrypted
            ? decrypt(config.private_key_encrypted)
            : ""

        if (!identityKey) {
            return failure("Falta la llave de identidad. Guárdala primero.")
        }

        const integritySecret = config.integrity_secret_encrypted
            ? decrypt(config.integrity_secret_encrypted)
            : undefined

        const { BoldGateway } = await import("@/lib/payments/bold-gateway")
        const gateway = new BoldGateway({
            provider: "bold",
            publicKey: "",
            privateKey: identityKey,
            integritySecret,
            isTestMode: config.is_test_mode,
        })

        const isConnected = await gateway.testConnection()

        if (isConnected) {
            return success({ success: true, message: "Conexión exitosa con Bold" })
        }

        return success({
            success: false,
            message:
                "No se pudo conectar. Verifica que la llave de identidad sea la del Botón de pagos de tu comercio Bold.",
        })
    } catch (error) {
        return failure(
            error instanceof Error ? error.message : "Error al probar conexión"
        )
    }
}
