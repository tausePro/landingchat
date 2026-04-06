import { EvolutionClient } from "@/lib/evolution"
import { createServiceClient } from "@/lib/supabase/server"

export interface EvolutionSyncInstanceRow {
    id: string
    organization_id: string
    instance_name: string
    instance_type: string | null
    provider: string | null
    status: string | null
    phone_number: string | null
    phone_number_display: string | null
    connected_at?: string | null
    disconnected_at?: string | null
}

function normalizeEvolutionStatus(state: string | null | undefined): "connected" | "disconnected" | "connecting" {
    const normalized = String(state || "").toLowerCase()

    if (normalized === "open") {
        return "connected"
    }

    if (normalized === "connecting") {
        return "connecting"
    }

    return "disconnected"
}

function normalizePhoneNumber(value: string | null | undefined): {
    phoneNumber: string | null
    phoneNumberDisplay: string | null
} {
    if (!value) {
        return { phoneNumber: null, phoneNumberDisplay: null }
    }

    const phoneNumber = value.replace("@s.whatsapp.net", "").replace(/\D/g, "")
    if (!phoneNumber) {
        return { phoneNumber: null, phoneNumberDisplay: null }
    }

    return {
        phoneNumber,
        phoneNumberDisplay: phoneNumber.length >= 4 ? phoneNumber.slice(-4) : phoneNumber,
    }
}

export async function syncEvolutionCorporateInstanceStatus(
    instance: EvolutionSyncInstanceRow | null
): Promise<EvolutionSyncInstanceRow | null> {
    if (!instance || instance.instance_type !== "corporate" || !instance.instance_name || instance.provider === "meta") {
        return instance
    }

    const supabase = createServiceClient()
    const { data: settings } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "evolution_api_config")
        .single()

    const config = settings?.value as { url?: string; apiKey?: string } | null
    if (!config?.url || !config?.apiKey) {
        return instance
    }

    const evolutionClient = new EvolutionClient({
        baseUrl: config.url,
        apiKey: config.apiKey,
    })

    let state: string
    try {
        const connectionState = await evolutionClient.getConnectionStatus(instance.instance_name)
        state = connectionState.state
    } catch {
        return instance
    }

    const nextStatus = normalizeEvolutionStatus(state)
    let phoneNumber = instance.phone_number
    let phoneNumberDisplay = instance.phone_number_display

    if (nextStatus === "connected" && (!phoneNumber || !phoneNumberDisplay)) {
        try {
            const instanceInfo = await evolutionClient.getInstance(instance.instance_name)
            const normalizedPhone = normalizePhoneNumber(instanceInfo.phoneNumber || instanceInfo.owner)
            phoneNumber = normalizedPhone.phoneNumber
            phoneNumberDisplay = normalizedPhone.phoneNumberDisplay
        } catch {
            const normalizedPhone = normalizePhoneNumber(instance.phone_number)
            phoneNumber = normalizedPhone.phoneNumber
            phoneNumberDisplay = normalizedPhone.phoneNumberDisplay
        }
    }

    const needsUpdate =
        instance.status !== nextStatus ||
        instance.provider !== "evolution" ||
        phoneNumber !== instance.phone_number ||
        phoneNumberDisplay !== instance.phone_number_display

    if (!needsUpdate) {
        return {
            ...instance,
            provider: instance.provider || "evolution",
        }
    }

    const now = new Date().toISOString()
    const updateData: Record<string, string | null> = {
        status: nextStatus,
        provider: "evolution",
        updated_at: now,
    }

    if (nextStatus === "connected") {
        updateData.connected_at = instance.connected_at || now
        if (phoneNumber) {
            updateData.phone_number = phoneNumber
            updateData.phone_number_display = phoneNumberDisplay
        }
    }

    if (nextStatus === "disconnected") {
        updateData.disconnected_at = now
    }

    const { error } = await supabase
        .from("whatsapp_instances")
        .update(updateData)
        .eq("id", instance.id)

    if (error) {
        return {
            ...instance,
            provider: instance.provider || "evolution",
        }
    }

    return {
        ...instance,
        provider: "evolution",
        status: nextStatus,
        phone_number: phoneNumber,
        phone_number_display: phoneNumberDisplay,
        connected_at: nextStatus === "connected" ? (instance.connected_at || now) : instance.connected_at,
        disconnected_at: nextStatus === "disconnected" ? now : instance.disconnected_at,
    }
}
