"use server"

import { createClient, createServiceClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import {
    type ActionResult,
    success,
    failure,
    UpdateWhatsAppInstanceInputSchema,
    type WhatsAppInstance,
    deserializeWhatsAppInstance,
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

    return profile?.organization_id || null
}

/**
 * Obtiene el estado de WhatsApp de la organización
 */
export async function getWhatsAppStatus(): Promise<
    ActionResult<{
        corporate: WhatsAppInstance | null
        personal: WhatsAppInstance | null
        plan_limit: number
    }>
> {
    try {
        const orgId = await getCurrentOrganization()
        if (!orgId) {
            return failure("No autorizado")
        }

        const supabase = await createClient()

        // Obtener instancias
        const { data: instances, error: instancesError } = await supabase
            .from("whatsapp_instances")
            .select("*")
            .eq("organization_id", orgId)

        if (instancesError) {
            return failure(instancesError.message)
        }

        // Obtener límite del plan desde subscriptions
        const { data: subscription } = await supabase
            .from("subscriptions")
            .select("plans(max_whatsapp_conversations)")
            .eq("organization_id", orgId)
            .eq("status", "active")
            .single()

        // Si no hay suscripción, usar plan gratuito por defecto (10 conversaciones)
        const planLimit = (subscription?.plans as any)?.max_whatsapp_conversations || 10

        const corporate =
            instances?.find((i) => i.instance_type === "corporate") || null
        const personal =
            instances?.find((i) => i.instance_type === "personal") || null

        // Obtener contador de conversaciones usadas
        const { data: orgData } = await supabase
            .from("organizations")
            .select("whatsapp_conversations_used")
            .eq("id", orgId)
            .single()

        return success({
            corporate: corporate ? deserializeWhatsAppInstance(corporate) : null,
            personal: personal ? deserializeWhatsAppInstance(personal) : null,
            plan_limit: planLimit,
            conversations_used: orgData?.whatsapp_conversations_used || 0,
        })
    } catch (error) {
        return failure(
            error instanceof Error ? error.message : "Error al obtener estado"
        )
    }
}

/**
 * Conecta WhatsApp corporativo
 */
export async function connectWhatsApp(): Promise<
    ActionResult<{ qr_code: string; instance_id: string }>
> {
    try {
        const orgId = await getCurrentOrganization()
        if (!orgId) {
            return failure("No autorizado")
        }

        const supabase = await createClient()

        // Verificar límite del plan desde subscriptions
        const { data: subscription } = await supabase
            .from("subscriptions")
            .select("plans(max_whatsapp_conversations)")
            .eq("organization_id", orgId)
            .eq("status", "active")
            .single()

        // Si no hay suscripción, usar plan gratuito por defecto (10 conversaciones)
        const planLimit = (subscription?.plans as any)?.max_whatsapp_conversations || 10

        if (planLimit === 0) {
            return failure(
                "Tu plan no incluye WhatsApp. Actualiza tu plan para usar esta función."
            )
        }

        // Verificar si ya existe una instancia corporativa
        const { data: existing } = await supabase
            .from("whatsapp_instances")
            .select("id, status")
            .eq("organization_id", orgId)
            .eq("instance_type", "corporate")
            .single()

        if (existing && existing.status === "connected") {
            return failure("Ya tienes un WhatsApp conectado")
        }

        // Obtener configuración de Evolution API desde system_settings
        // Usamos serviceClient porque system_settings tiene RLS restrictivo
        try {
            const serviceClient = createServiceClient()
            const { data: settings, error: settingsError } = await serviceClient
                .from("system_settings")
                .select("value")
                .eq("key", "evolution_api_config")
                .single()

            if (settingsError) {
                console.error("[connectWhatsApp] Error fetching Evolution config:", settingsError)
                return failure(`Error al obtener configuración: ${settingsError.message}`)
            }

            if (!settings?.value) {
                console.error("[connectWhatsApp] Evolution API config not found in database")
                return failure("Evolution API no está configurado. Contacta al administrador.")
            }

            const config = settings.value as { url: string; apiKey: string }
            
            if (!config.url || !config.apiKey) {
                console.error("[connectWhatsApp] Invalid Evolution config:", config)
                return failure("Configuración de Evolution API incompleta.")
            }

            const { EvolutionClient } = await import("@/lib/evolution")
            const evolutionClient = new EvolutionClient({
                baseUrl: config.url,
                apiKey: config.apiKey,
            })

            const instanceName = `org_${orgId}`

            // Si existe instancia, eliminarla primero
            if (existing) {
                try {
                    await evolutionClient.deleteInstance(instanceName)
                } catch (deleteError) {
                    console.log("[connectWhatsApp] Could not delete existing instance:", deleteError)
                    // Ignorar error si no existe
                }
            }

            // Crear nueva instancia en Evolution
            const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/whatsapp`
            console.log("[connectWhatsApp] Creating instance with webhook:", webhookUrl)
            
            await evolutionClient.createInstance({
                instanceName,
                token: orgId, // Usamos orgId como token para identificar
                qrcode: true,
                webhook: webhookUrl,
                webhookByEvents: true,
                events: [
                    "MESSAGES_UPSERT",
                    "CONNECTION_UPDATE",
                    "QRCODE_UPDATED",
                ],
            })

            // Obtener QR code
            const qrData = await evolutionClient.getQRCode(instanceName)

            // Guardar/actualizar instancia en DB
            const qrExpiresAt = new Date()
            qrExpiresAt.setMinutes(qrExpiresAt.getMinutes() + 2) // QR expira en 2 minutos

            const instanceData = {
                organization_id: orgId,
                instance_name: instanceName,
                instance_type: "corporate" as const,
                status: "connecting" as const,
                qr_code: qrData.base64 || qrData.code,
                qr_expires_at: qrExpiresAt.toISOString(),
                updated_at: new Date().toISOString(),
            }

            let instanceId: string

            if (existing) {
                const { error } = await supabase
                    .from("whatsapp_instances")
                    .update(instanceData)
                    .eq("id", existing.id)

                if (error) {
                    return failure(error.message)
                }
                instanceId = existing.id
            } else {
                const { data: newInstance, error } = await supabase
                    .from("whatsapp_instances")
                    .insert(instanceData)
                    .select("id")
                    .single()

                if (error) {
                    return failure(error.message)
                }
                instanceId = newInstance.id
            }

            revalidatePath("/dashboard/settings/whatsapp")

            return success({
                qr_code: qrData.base64 || qrData.code,
                instance_id: instanceId,
            })
        } catch (serviceError) {
            console.error("[connectWhatsApp] Service client error:", serviceError)
            return failure(
                serviceError instanceof Error 
                    ? `Error del servicio: ${serviceError.message}` 
                    : "Error al conectar con el servicio"
            )
        }


    } catch (error) {
        return failure(
            error instanceof Error ? error.message : "Error al conectar WhatsApp"
        )
    }
}

/**
 * Desconecta WhatsApp corporativo
 */
export async function disconnectWhatsApp(): Promise<ActionResult<void>> {
    try {
        const orgId = await getCurrentOrganization()
        if (!orgId) {
            return failure("No autorizado")
        }

        const supabase = await createClient()

        // Obtener instancia
        const { data: instance } = await supabase
            .from("whatsapp_instances")
            .select("id, instance_name")
            .eq("organization_id", orgId)
            .eq("instance_type", "corporate")
            .single()

        if (!instance) {
            return failure("No hay WhatsApp conectado")
        }

        // Obtener configuración de Evolution API
        // Usamos serviceClient porque system_settings tiene RLS restrictivo
        const serviceClient = createServiceClient()
        const { data: settings } = await serviceClient
            .from("system_settings")
            .select("value")
            .eq("key", "evolution_api_config")
            .single()

        if (settings?.value) {
            const config = settings.value as { url: string; apiKey: string }
            const { EvolutionClient } = await import("@/lib/evolution")
            const evolutionClient = new EvolutionClient({
                baseUrl: config.url,
                apiKey: config.apiKey,
            })

            try {
                await evolutionClient.logout(instance.instance_name)
            } catch (error) {
                console.error("Error al desconectar de Evolution:", error)
                // Continuar aunque falle
            }
        }

        // Actualizar estado en DB
        const { error } = await supabase
            .from("whatsapp_instances")
            .update({
                status: "disconnected",
                phone_number: null,
                phone_number_display: null,
                disconnected_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq("id", instance.id)

        if (error) {
            return failure(error.message)
        }

        revalidatePath("/dashboard/settings/whatsapp")
        return success(undefined)
    } catch (error) {
        return failure(
            error instanceof Error ? error.message : "Error al desconectar WhatsApp"
        )
    }
}

/**
 * Obtiene el código QR actualizado
 */
export async function getQRCode(): Promise<ActionResult<string>> {
    try {
        const orgId = await getCurrentOrganization()
        if (!orgId) {
            return failure("No autorizado")
        }

        const supabase = await createClient()

        // Obtener instancia
        const { data: instance } = await supabase
            .from("whatsapp_instances")
            .select("qr_code, qr_expires_at, status")
            .eq("organization_id", orgId)
            .eq("instance_type", "corporate")
            .single()

        if (!instance) {
            return failure("No hay proceso de conexión activo")
        }

        if (instance.status === "connected") {
            return failure("WhatsApp ya está conectado")
        }

        // Verificar si el QR expiró
        if (
            instance.qr_expires_at &&
            new Date(instance.qr_expires_at) < new Date()
        ) {
            return failure("QR expirado. Inicia el proceso de conexión nuevamente.")
        }

        if (!instance.qr_code) {
            return failure("No hay QR disponible")
        }

        return success(instance.qr_code)
    } catch (error) {
        return failure(
            error instanceof Error ? error.message : "Error al obtener QR"
        )
    }
}

/**
 * Actualiza la configuración de notificaciones
 */
export async function updateNotificationSettings(
    input: unknown
): Promise<ActionResult<void>> {
    try {
        const orgId = await getCurrentOrganization()
        if (!orgId) {
            return failure("No autorizado")
        }

        // Validar input
        const validation = UpdateWhatsAppInstanceInputSchema.safeParse(input)
        if (!validation.success) {
            return failure(validation.error.issues[0].message)
        }

        const data = validation.data
        const supabase = await createClient()

        // Actualizar configuración
        const { error } = await supabase
            .from("whatsapp_instances")
            .update({
                ...data,
                updated_at: new Date().toISOString(),
            })
            .eq("organization_id", orgId)
            .eq("instance_type", "personal")

        if (error) {
            return failure(error.message)
        }

        revalidatePath("/dashboard/settings/whatsapp")
        return success(undefined)
    } catch (error) {
        return failure(
            error instanceof Error
                ? error.message
                : "Error al actualizar configuración"
        )
    }
}

/**
 * Conecta WhatsApp personal para notificaciones
 */
export async function connectPersonalWhatsApp(
    phoneNumber: string
): Promise<ActionResult<void>> {
    try {
        const orgId = await getCurrentOrganization()
        if (!orgId) {
            return failure("No autorizado")
        }

        const supabase = await createClient()

        // Verificar si ya existe
        const { data: existing } = await supabase
            .from("whatsapp_instances")
            .select("id")
            .eq("organization_id", orgId)
            .eq("instance_type", "personal")
            .single()

        const instanceData = {
            organization_id: orgId,
            instance_name: `org_${orgId}_personal`,
            instance_type: "personal" as const,
            status: "connected" as const,
            phone_number: phoneNumber,
            phone_number_display: phoneNumber.slice(-4),
            connected_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }

        if (existing) {
            const { error } = await supabase
                .from("whatsapp_instances")
                .update(instanceData)
                .eq("id", existing.id)

            if (error) {
                return failure(error.message)
            }
        } else {
            const { error } = await supabase
                .from("whatsapp_instances")
                .insert(instanceData)

            if (error) {
                return failure(error.message)
            }
        }

        revalidatePath("/dashboard/settings/whatsapp")
        return success(undefined)
    } catch (error) {
        return failure(
            error instanceof Error
                ? error.message
                : "Error al conectar WhatsApp personal"
        )
    }
}
