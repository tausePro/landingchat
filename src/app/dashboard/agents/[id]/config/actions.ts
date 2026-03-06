"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function getAgentById(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error("Unauthorized")

    // Get user's org to verify ownership via RLS
    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) throw new Error("No organization found")

    const { data, error } = await supabase
        .from("agents")
        .select("*")
        .eq("id", id)
        .single()

    if (error) {
        console.error("Error fetching agent:", error)
        throw new Error(`Agent not found: ${error.message}`)
    }

    // Verify agent belongs to user's organization (RLS should handle this, but double-check)
    if (data.organization_id !== profile.organization_id) {
        throw new Error("You don't have permission to access this agent")
    }

    return data
}

/**
 * Carga el contexto de la org para mostrar en la configuración del agente:
 * industry, features del plan activo, y modo determinado por el factory.
 */
export async function getOrgContext(orgId: string) {
    const supabase = await createClient()

    const [{ data: org }, { data: subscription }] = await Promise.all([
        supabase
            .from("organizations")
            .select("industry")
            .eq("id", orgId)
            .single(),
        supabase
            .from("subscriptions")
            .select("features, plans(name)")
            .eq("organization_id", orgId)
            .in("status", ["active", "trialing"])
            .order("created_at", { ascending: false })
            .limit(1)
            .single(),
    ])

    return {
        industry: org?.industry as string | null,
        features: (subscription?.features as Record<string, boolean>) || null,
        planName: (subscription?.plans as any)?.name as string | null,
    }
}

export async function updateAgentGeneral(id: string, data: {
    name: string
    avatar_url?: string
    status?: string
}) {
    const supabase = await createClient()

    const { error } = await supabase
        .from("agents")
        .update({
            name: data.name,
            avatar_url: data.avatar_url,
            status: data.status
        })
        .eq("id", id)

    if (error) {
        console.error("Error updating agent:", error)
        throw new Error("Failed to update agent")
    }

    revalidatePath(`/dashboard/agents/${id}/config`)
    return { success: true }
}

export async function updateAgentPersonality(id: string, personality: {
    tone?: string
    instructions?: string
    examples?: any[]
}) {
    const supabase = await createClient()

    // Get current config
    const { data: agent } = await supabase
        .from("agents")
        .select("configuration")
        .eq("id", id)
        .single()

    const updatedConfig = {
        ...(agent?.configuration || {}),
        personality
    }

    const { error } = await supabase
        .from("agents")
        .update({ configuration: updatedConfig })
        .eq("id", id)

    if (error) {
        console.error("Error updating personality:", error)
        throw new Error("Failed to update personality")
    }

    revalidatePath(`/dashboard/agents/${id}/config`)
    return { success: true }
}

export async function updateAgentSkills(id: string, skills: Record<string, { enabled: boolean; customInstructions?: string | null }>) {
    const supabase = await createClient()

    const { data: agent } = await supabase
        .from("agents")
        .select("configuration")
        .eq("id", id)
        .single()

    const updatedConfig = {
        ...(agent?.configuration || {}),
        skills
    }

    const { error } = await supabase
        .from("agents")
        .update({ configuration: updatedConfig })
        .eq("id", id)

    if (error) {
        console.error("Error updating skills:", error)
        throw new Error("Failed to update skills")
    }

    revalidatePath(`/dashboard/agents/${id}/config`)
    return { success: true }
}

export async function updateAgentKnowledge(id: string, knowledge: {
    documents?: string[]
    faqs?: any[]
    product_knowledge?: boolean
}) {
    const supabase = await createClient()

    const { data: agent } = await supabase
        .from("agents")
        .select("configuration")
        .eq("id", id)
        .single()

    const updatedConfig = {
        ...(agent?.configuration || {}),
        knowledge
    }

    const { error } = await supabase
        .from("agents")
        .update({ configuration: updatedConfig })
        .eq("id", id)

    if (error) {
        console.error("Error updating knowledge:", error)
        throw new Error("Failed to update knowledge")
    }

    revalidatePath(`/dashboard/agents/${id}/config`)
    return { success: true }
}

export async function updateAgentSchedule(id: string, schedule: {
    enabled: boolean
    timezone: string
    channels: Record<string, Record<string, { from: string; to: string } | null>>
}) {
    const supabase = await createClient()

    const { data: agent } = await supabase
        .from("agents")
        .select("configuration")
        .eq("id", id)
        .single()

    const updatedConfig = {
        ...(agent?.configuration || {}),
        schedule
    }

    const { error } = await supabase
        .from("agents")
        .update({ configuration: updatedConfig })
        .eq("id", id)

    if (error) {
        console.error("Error updating schedule:", error)
        throw new Error("Failed to update schedule")
    }

    revalidatePath(`/dashboard/agents/${id}/config`)
    return { success: true }
}
