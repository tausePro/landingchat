"use server"

import { createClient, createServiceClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import {
    type ActionResult,
    success,
    failure,
} from "@/types"
import type { WhatsAppInstance } from "@/types"
import { deserializeWhatsAppInstance } from "@/types"

// ============================================
// Tipos
// ============================================

export interface SocialChannel {
    id: string
    platform: "instagram" | "messenger"
    platform_page_id: string
    platform_username: string | null
    status: string
    created_at: string
}

export interface ChannelsStatus {
    whatsapp: {
        instance: WhatsAppInstance | null
        plan_limit: number
        conversations_used: number
    }
    instagram: SocialChannel | null
    messenger: SocialChannel | null
    meta_config: { app_id: string; config_id?: string } | null
}

// ============================================
// Helpers
// ============================================

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

// ============================================
// Obtener estado de todos los canales
// ============================================

export async function getChannelsStatus(): Promise<ActionResult<ChannelsStatus>> {
    try {
        const orgId = await getCurrentOrganization()
        if (!orgId) {
            return failure("No autorizado")
        }

        const supabase = await createClient()

        // WhatsApp: instancia corporativa
        const { data: instances } = await supabase
            .from("whatsapp_instances")
            .select("*")
            .eq("organization_id", orgId)

        const corporate = instances?.find((i: Record<string, unknown>) => i.instance_type === "corporate") || null

        // Límite del plan
        const { data: subscription } = await supabase
            .from("subscriptions")
            .select("plans(max_whatsapp_conversations)")
            .eq("organization_id", orgId)
            .eq("status", "active")
            .single()

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const planLimit = (subscription?.plans as any)?.max_whatsapp_conversations || 10

        // Conversaciones usadas
        const { data: orgData } = await supabase
            .from("organizations")
            .select("whatsapp_conversations_used")
            .eq("id", orgId)
            .single()

        // Social channels: Instagram y Messenger
        const { data: socialChannels } = await supabase
            .from("social_channels")
            .select("id, platform, platform_page_id, platform_username, status, created_at")
            .eq("organization_id", orgId)

        const instagram = socialChannels?.find((c: Record<string, unknown>) => c.platform === "instagram") as SocialChannel | undefined
        const messenger = socialChannels?.find((c: Record<string, unknown>) => c.platform === "messenger") as SocialChannel | undefined

        // Meta config (para Facebook SDK)
        const serviceClient = createServiceClient()
        const { data: settings } = await serviceClient
            .from("system_settings")
            .select("value")
            .eq("key", "meta_whatsapp_config")
            .single()

        let metaConfig: { app_id: string; config_id?: string } | null = null
        if (settings?.value) {
            const config = settings.value as Record<string, string>
            if (config.app_id) {
                metaConfig = {
                    app_id: config.app_id,
                    config_id: config.config_id,
                }
            }
        }

        return success({
            whatsapp: {
                instance: corporate ? deserializeWhatsAppInstance(corporate) : null,
                plan_limit: planLimit,
                conversations_used: orgData?.whatsapp_conversations_used || 0,
            },
            instagram: instagram || null,
            messenger: messenger || null,
            meta_config: metaConfig,
        })
    } catch (error) {
        return failure(
            error instanceof Error ? error.message : "Error al obtener canales"
        )
    }
}

// ============================================
// Desconectar canal social
// ============================================

export async function disconnectSocialChannel(
    platform: "instagram" | "messenger"
): Promise<ActionResult<void>> {
    try {
        const orgId = await getCurrentOrganization()
        if (!orgId) {
            return failure("No autorizado")
        }

        const supabase = await createClient()

        const { error } = await supabase
            .from("social_channels")
            .update({
                status: "disconnected",
                page_access_token: "",
                updated_at: new Date().toISOString(),
            })
            .eq("organization_id", orgId)
            .eq("platform", platform)

        if (error) {
            return failure(error.message)
        }

        revalidatePath("/dashboard/settings/channels")
        return success(undefined)
    } catch (error) {
        return failure(
            error instanceof Error ? error.message : "Error al desconectar"
        )
    }
}
