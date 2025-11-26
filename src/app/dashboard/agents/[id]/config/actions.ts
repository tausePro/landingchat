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
