"use server"

/**
 * Canal de notificaciones de la plataforma (Platform Notifier v0 — T3).
 * Gestión solo super admin: estado, instancia Evolution propia, QR,
 * toggle de habilitación y test send.
 */

import { requireAdminRole } from "@/lib/admin/roles"
import { createServiceClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createEvolutionClient } from "@/lib/evolution"
import { MetaCloudClient } from "@/lib/whatsapp/meta-client"
import { encrypt, decrypt } from "@/lib/utils/encryption"
import { type ActionResult, success, failure } from "@/types"
import { PLATFORM_INSTANCE_NAME } from "@/lib/whatsapp/reconcileInstances"
import {
    getPlatformNotificationsConfig,
    sendPlatformNotification,
    type PlatformProvider,
} from "@/lib/notifications/platform-whatsapp"

async function checkSuperAdmin() {
    // Admin S1: superadmin siempre pasa; 'tech' tiene acceso a esta sección
    return requireAdminRole(["tech"])
}

export interface PlatformChannelStatus {
    serverReachable: boolean
    enabled: boolean
    provider: PlatformProvider
    instanceName: string
    instanceStatus: "connected" | "connecting" | "disconnected" | "missing"
    phoneDisplay: string | null
    /** Meta: credenciales y template configurados (el token nunca viaja al cliente). */
    metaConfigured: boolean
    metaTemplateName: string | null
}

/** Estado completo del canal para la página del admin. */
export async function getPlatformChannelStatus(): Promise<ActionResult<PlatformChannelStatus>> {
    if (!(await checkSuperAdmin())) return failure("No autorizado")

    try {
        const config = await getPlatformNotificationsConfig()
        const instanceName = config.instance_name || PLATFORM_INSTANCE_NAME

        const supabase = await createServiceClient()
        const evolution = await createEvolutionClient(supabase)
        if (!evolution) {
            return success({
                serverReachable: false,
                enabled: config.enabled,
                provider: config.provider,
                instanceName,
                instanceStatus: "missing",
                phoneDisplay: null,
                metaConfigured: Boolean(config.meta_phone_number_id && config.meta_access_token_encrypted),
                metaTemplateName: config.meta_template_name ?? null,
            })
        }

        const serverReachable = await evolution.testConnection()
        let instanceStatus: PlatformChannelStatus["instanceStatus"] = "missing"
        let phoneDisplay: string | null = null

        if (serverReachable) {
            try {
                const instances = await evolution.listInstances()
                const platform = instances.find((instance) => instance.name === instanceName)
                if (platform) {
                    instanceStatus = platform.status === "open"
                        ? "connected"
                        : platform.status === "connecting" ? "connecting" : "disconnected"
                    phoneDisplay = platform.number ? `****${platform.number.slice(-4)}` : null
                }
            } catch {
                // server alcanzable pero listado falló — se reporta como missing
            }
        }

        return success({
            serverReachable,
            enabled: config.enabled,
            provider: config.provider,
            instanceName,
            instanceStatus,
            phoneDisplay,
            metaConfigured: Boolean(config.meta_phone_number_id && config.meta_access_token_encrypted),
            metaTemplateName: config.meta_template_name ?? null,
        })
    } catch (error) {
        console.error("[platform-notifications] Status error:", error)
        return failure("Error al consultar el estado del canal")
    }
}

const saveConfigSchema = z.object({
    enabled: z.boolean(),
    provider: z.enum(["evolution", "meta"]),
    metaPhoneNumberId: z.string().trim().optional(),
    metaWabaId: z.string().trim().optional(),
    /** Solo cuando el admin escribe un token nuevo; vacío = conservar el actual. */
    metaAccessToken: z.string().trim().optional(),
    metaTemplateName: z.string().trim().optional(),
    metaTemplateLanguage: z.string().trim().max(10).optional(),
})

export type SavePlatformConfigInput = z.infer<typeof saveConfigSchema>

/** Guarda la config del canal. El access token se encripta y nunca se relee al cliente. */
export async function savePlatformChannelConfig(input: SavePlatformConfigInput): Promise<ActionResult<void>> {
    if (!(await checkSuperAdmin())) return failure("No autorizado")

    try {
        const validation = saveConfigSchema.safeParse(input)
        if (!validation.success) {
            return failure(validation.error.issues[0]?.message || "Datos inválidos")
        }
        const data = validation.data

        if (data.provider === "meta" && data.enabled) {
            const current = await getPlatformNotificationsConfig()
            const willHaveToken = Boolean(data.metaAccessToken || current.meta_access_token_encrypted)
            const willHavePhoneId = Boolean(data.metaPhoneNumberId || current.meta_phone_number_id)
            if (!willHaveToken || !willHavePhoneId) {
                return failure("Para habilitar Meta necesitas Phone Number ID y Access Token")
            }
        }

        const current = await getPlatformNotificationsConfig()
        const value = {
            enabled: data.enabled,
            provider: data.provider,
            instance_name: PLATFORM_INSTANCE_NAME,
            meta_phone_number_id: data.metaPhoneNumberId || current.meta_phone_number_id || null,
            meta_waba_id: data.metaWabaId || current.meta_waba_id || null,
            meta_access_token_encrypted: data.metaAccessToken
                ? encrypt(data.metaAccessToken)
                : current.meta_access_token_encrypted || null,
            meta_template_name: data.metaTemplateName || current.meta_template_name || null,
            meta_template_language: data.metaTemplateLanguage || current.meta_template_language || "es",
        }

        const supabase = await createServiceClient()
        const { error } = await supabase.from("system_settings").upsert(
            { key: "platform_notifications_config", value, updated_at: new Date().toISOString() },
            { onConflict: "key" }
        )
        if (error) return failure(error.message)

        revalidatePath("/admin/settings/platform-notifications")
        return success(undefined)
    } catch (error) {
        console.error("[platform-notifications] Save error:", error)
        return failure("Error al guardar la configuración")
    }
}

/** URL del webhook de la plataforma (mismas reglas www que los tenants). */
function buildPlatformWebhookUrl(): string | null {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (!appUrl) return null
    let webhookUrl = `${appUrl}/api/webhooks/whatsapp`
    if (appUrl.includes("landingchat.co") && !appUrl.includes("www.")) {
        webhookUrl = webhookUrl.replace("landingchat.co", "www.landingchat.co")
    }
    return webhookUrl
}

/** Crea (si falta) la instancia platform y retorna el QR para conectar. */
export async function connectPlatformInstance(): Promise<ActionResult<{ qrCode: string | null }>> {
    if (!(await checkSuperAdmin())) return failure("No autorizado")

    try {
        const supabase = await createServiceClient()
        const evolution = await createEvolutionClient(supabase)
        if (!evolution) return failure("Evolution API no configurada")

        const webhookUrl = buildPlatformWebhookUrl()
        const instances = await evolution.listInstances()
        const exists = instances.some((instance) => instance.name === PLATFORM_INSTANCE_NAME)

        if (!exists) {
            await evolution.createInstance({
                instanceName: PLATFORM_INSTANCE_NAME,
                qrcode: true,
                integration: "WHATSAPP-BAILEYS",
                ...(webhookUrl && {
                    webhook: {
                        url: webhookUrl,
                        byEvents: true,
                        base64: false,
                        events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
                    },
                }),
            })
        } else if (webhookUrl) {
            // Instancia existente: asegurar el webhook (Copilot v1 — las
            // respuestas del merchant llegan por aquí). Idempotente.
            await evolution.setWebhook(PLATFORM_INSTANCE_NAME, {
                url: webhookUrl,
                events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
            })
        }

        const qr = await evolution.getQRCode(PLATFORM_INSTANCE_NAME)
        const qrCode = (qr as { base64?: string; code?: string }).base64
            ?? (qr as { base64?: string; code?: string }).code
            ?? null

        return success({ qrCode })
    } catch (error) {
        console.error("[platform-notifications] Connect error:", error)
        return failure(error instanceof Error ? error.message : "Error al conectar la instancia")
    }
}

/** Envío de prueba al número indicado (smoke del canal). */
export async function sendTestNotification(phone: string): Promise<ActionResult<void>> {
    if (!(await checkSuperAdmin())) return failure("No autorizado")

    const result = await sendPlatformNotification(
        phone,
        "🔔 *LandingChat* — prueba del canal de notificaciones de la plataforma. Si lees esto, el canal funciona."
    )
    if (!result.delivered) {
        return failure(result.error || "No se pudo enviar")
    }
    return success(undefined)
}

export interface MetaVerificationResult {
    phoneNumber: string | null
    verifiedName: string | null
    qualityRating: string | null
    /** Templates APROBADOS con al menos un body — los únicos usables por el canal. */
    approvedTemplates: Array<{ name: string; language: string; bodyPreview: string | null; hasBodyParam: boolean }>
}

/**
 * Verifica las credenciales del WABA contra la Graph API de Meta y carga
 * los templates aprobados (para seleccionar en vez de tipear a ciegas).
 * Usa las credenciales guardadas; los inputs opcionales permiten verificar
 * ANTES de guardar.
 */
export async function verifyMetaCredentials(input?: {
    metaWabaId?: string
    metaPhoneNumberId?: string
    metaAccessToken?: string
}): Promise<ActionResult<MetaVerificationResult>> {
    if (!(await checkSuperAdmin())) return failure("No autorizado")

    try {
        const current = await getPlatformNotificationsConfig()
        const wabaId = input?.metaWabaId?.trim() || current.meta_waba_id
        const phoneNumberId = input?.metaPhoneNumberId?.trim() || current.meta_phone_number_id
        const token = input?.metaAccessToken?.trim()
            || (current.meta_access_token_encrypted ? decrypt(current.meta_access_token_encrypted) : null)

        if (!wabaId || !token) {
            return failure("Necesitas WABA ID y Access Token para verificar")
        }

        const client = new MetaCloudClient()

        const [phoneNumbers, templates] = await Promise.all([
            client.getPhoneNumbers(wabaId, token),
            client.getMessageTemplates(wabaId, token),
        ])

        const configuredPhone = phoneNumberId
            ? phoneNumbers.find((phone) => phone.id === phoneNumberId) ?? null
            : phoneNumbers[0] ?? null

        const approvedTemplates = templates
            .filter((template) => template.status === "APPROVED")
            .map((template) => {
                const body = template.components.find((component) => component.type === "BODY")
                return {
                    name: template.name,
                    language: template.language,
                    bodyPreview: body?.text?.slice(0, 120) ?? null,
                    hasBodyParam: Boolean(body?.text?.includes("{{1}}")),
                }
            })

        return success({
            phoneNumber: configuredPhone?.display_phone_number ?? null,
            verifiedName: configuredPhone?.verified_name ?? null,
            qualityRating: configuredPhone?.quality_rating ?? null,
            approvedTemplates,
        })
    } catch (error) {
        console.error("[platform-notifications] Verify error:", error)
        return failure(error instanceof Error ? error.message : "Error verificando credenciales")
    }
}
