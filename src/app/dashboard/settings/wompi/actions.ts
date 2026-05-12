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
 *
 * Contrato con el UI:
 *   - `private_key`: SIEMPRE requerida al guardar (el UI obliga a re-ingresarla)
 *   - `integrity_secret`: opcional — si llega vacía, se PRESERVA el valor existente en DB
 *   - `events_secret`: opcional — si llega vacía, se PRESERVA el valor existente en DB
 *
 * Bug regresivo previo: el server convertía los secretos vacíos en `null` y los
 * sobreescribía en DB, borrando configuraciones válidas previas. Fix: construir
 * el objeto del upsert condicionalmente, sin incluir campos cuando el input
 * llega vacío. En modo UPDATE (existe conflicto onConflict), los campos
 * omitidos del objeto preservan su valor anterior en DB.
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

        // Validar prefijos de los secretos para evitar el error clásico de
        // pegar "Eventos" donde va "Integridad" (o viceversa). Si vienen vacíos
        // se preservan los existentes, así que solo validamos cuando hay input.
        if (input.integrity_secret && !/^(test|prod)_integrity_/.test(input.integrity_secret)) {
            return failure(
                "El Secreto de Integridad debe empezar con 'test_integrity_' o 'prod_integrity_'. " +
                "Verifica en Wompi → Desarrolladores → Secretos que copiaste el de 'Integridad', no el de 'Eventos'."
            )
        }
        if (input.events_secret && !/^(test|prod)_events_/.test(input.events_secret)) {
            return failure(
                "El Secreto de Eventos debe empezar con 'test_events_' o 'prod_events_'. " +
                "Verifica que copiaste el secreto correcto desde Wompi → Desarrolladores → Secretos."
            )
        }
        if (!/^prv_(test|prod)_/.test(input.private_key)) {
            return failure("La llave privada debe empezar con 'prv_test_' o 'prv_prod_'.")
        }
        if (!/^pub_(test|prod)_/.test(input.public_key)) {
            return failure("La llave pública debe empezar con 'pub_test_' o 'pub_prod_'.")
        }
        // El modo de pruebas debe coincidir con el prefijo de la llave pública.
        const isTestKey = input.public_key.startsWith("pub_test_")
        if (input.is_test_mode !== isTestKey) {
            return failure(
                input.is_test_mode
                    ? "Activaste modo de pruebas pero la llave pública parece ser de producción ('pub_prod_'). Verifica que todas las credenciales correspondan al mismo ambiente."
                    : "Desactivaste modo de pruebas pero la llave pública parece ser de sandbox ('pub_test_'). Verifica que todas las credenciales correspondan al mismo ambiente."
            )
        }

        const supabase = await createClient()

        // Generar URL de webhook
        const { data: org } = await supabase
            .from("organizations")
            .select("slug")
            .eq("id", organizationId)
            .single()

        const webhookUrl = org?.slug
            ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/payments/wompi?org=${org.slug}`
            : null

        // Construir el objeto del upsert. Los secretos solo se incluyen cuando
        // el input los trae con contenido; si llegan vacíos, se omiten y el
        // valor previo en DB queda intacto.
        const configData: Record<string, unknown> = {
            organization_id: organizationId,
            provider: "wompi",
            is_active: input.is_active,
            is_test_mode: input.is_test_mode,
            public_key: input.public_key,
            private_key_encrypted: encrypt(input.private_key),
            webhook_url: webhookUrl,
            updated_at: new Date().toISOString(),
        }

        if (input.integrity_secret) {
            configData.integrity_secret_encrypted = encrypt(input.integrity_secret)
        }
        if (input.events_secret) {
            configData.events_secret_encrypted = encrypt(input.events_secret)
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
