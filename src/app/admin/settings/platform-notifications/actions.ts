"use server"

/**
 * Canal de notificaciones de la plataforma (Platform Notifier v0 — T3).
 * Gestión solo super admin: estado, instancia Evolution propia, QR,
 * toggle de habilitación y test send.
 */

import { createClient, createServiceClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { createEvolutionClient } from "@/lib/evolution"
import { type ActionResult, success, failure } from "@/types"
import { PLATFORM_INSTANCE_NAME } from "@/lib/whatsapp/reconcileInstances"
import {
    getPlatformNotificationsConfig,
    sendPlatformNotification,
} from "@/lib/notifications/platform-whatsapp"

async function checkSuperAdmin() {
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

export interface PlatformChannelStatus {
    serverReachable: boolean
    enabled: boolean
    instanceName: string
    instanceStatus: "connected" | "connecting" | "disconnected" | "missing"
    phoneDisplay: string | null
}

/** Estado completo del canal para la página del admin. */
export async function getPlatformChannelStatus(): Promise<ActionResult<PlatformChannelStatus>> {
    if (!(await checkSuperAdmin())) return failure("No autorizado")

    try {
        const config = await getPlatformNotificationsConfig()
        const instanceName = config.instance_name || PLATFORM_INSTANCE_NAME

        const supabase = createServiceClient()
        const evolution = await createEvolutionClient(supabase)
        if (!evolution) {
            return success({
                serverReachable: false,
                enabled: config.enabled,
                instanceName,
                instanceStatus: "missing",
                phoneDisplay: null,
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

        return success({ serverReachable, enabled: config.enabled, instanceName, instanceStatus, phoneDisplay })
    } catch (error) {
        console.error("[platform-notifications] Status error:", error)
        return failure("Error al consultar el estado del canal")
    }
}

/** Habilita/deshabilita el canal (rollback operativo sin deploy). */
export async function setPlatformChannelEnabled(enabled: boolean): Promise<ActionResult<void>> {
    if (!(await checkSuperAdmin())) return failure("No autorizado")

    try {
        const supabase = createServiceClient()
        const { error } = await supabase.from("system_settings").upsert(
            {
                key: "platform_notifications_config",
                value: { enabled, instance_name: PLATFORM_INSTANCE_NAME },
                updated_at: new Date().toISOString(),
            },
            { onConflict: "key" }
        )
        if (error) return failure(error.message)

        revalidatePath("/admin/settings/platform-notifications")
        return success(undefined)
    } catch (error) {
        console.error("[platform-notifications] Toggle error:", error)
        return failure("Error al guardar la configuración")
    }
}

/** Crea (si falta) la instancia platform y retorna el QR para conectar. */
export async function connectPlatformInstance(): Promise<ActionResult<{ qrCode: string | null }>> {
    if (!(await checkSuperAdmin())) return failure("No autorizado")

    try {
        const supabase = createServiceClient()
        const evolution = await createEvolutionClient(supabase)
        if (!evolution) return failure("Evolution API no configurada")

        const instances = await evolution.listInstances()
        const exists = instances.some((instance) => instance.name === PLATFORM_INSTANCE_NAME)

        if (!exists) {
            await evolution.createInstance({
                instanceName: PLATFORM_INSTANCE_NAME,
                qrcode: true,
                integration: "WHATSAPP-BAILEYS",
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
