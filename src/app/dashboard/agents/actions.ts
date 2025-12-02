"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export interface AgentData {
    id: string
    name: string
    type: 'human' | 'bot'
    role: string
    status: string
    avatar_url?: string
    configuration?: any
    personalization_config?: any
    created_at: string
}

export interface AgentTemplateData {
    id: string
    name: string
    description: string
    icon: string
    base_price: number
    agent_template: {
        role: string
        system_prompt: string
        default_config: any
    }
}

export async function getAgents() {
    return getUserAgents()
}

export async function getUserAgents() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return []

    // Get user's org
    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) return []

    const { data, error } = await supabase
        .from("agents")
        .select("*")
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: false })

    if (error) {
        console.error("Error fetching agents:", error)
        return []
    }

    return data as AgentData[]
}

export async function getAgentTemplates() {
    const supabase = await createClient()

    // Fetch marketplace items of type 'agent_template' that are active
    // And join with agent_templates table
    const { data, error } = await supabase
        .from("marketplace_items")
        .select(`
            id,
            name,
            description,
            icon,
            base_price,
            agent_templates (
                role,
                system_prompt,
                default_config
            )
        `)
        .eq("type", "agent_template")
        .eq("is_active", true)

    if (error) {
        console.error("Error fetching templates:", error)
        return []
    }

    // Flatten structure
    return data.map((item: any) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        icon: item.icon,
        base_price: item.base_price,
        agent_template: item.agent_templates?.[0]
    })) as AgentTemplateData[]
}

export async function createAgentFromTemplate(templateId: string, name: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error("Unauthorized")

    // Get user's org
    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) throw new Error("No organization found")

    // Get template details
    const { data: templateItem, error: templateError } = await supabase
        .from("marketplace_items")
        .select(`
            *,
            agent_templates (*)
        `)
        .eq("id", templateId)
        .single()

    if (templateError) {
        console.error("Error fetching template:", templateError)
        throw new Error("Failed to fetch template")
    }

    if (!templateItem || !templateItem.agent_templates?.[0]) {
        throw new Error("Template not found")
    }

    const templateDetails = templateItem.agent_templates[0]

    // Prepare configuration
    const config = {
        ...templateDetails.default_config,
        system_prompt: templateDetails.system_prompt
    }

    // Create Agent
    const { data: newAgent, error } = await supabase
        .from("agents")
        .insert({
            organization_id: profile.organization_id,
            name: name || templateItem.name,
            type: 'bot',
            role: templateDetails.role,
            status: 'offline', // Default status
            avatar_url: templateItem.icon,
            configuration: config
        })
        .select()
        .single()

    if (error) {
        console.error("Error creating agent:", error)
        throw new Error(`Failed to create agent: ${error.message}`)
    }

    revalidatePath("/dashboard/agents")
    return { success: true, agent: newAgent }
}

export async function updateAgent(id: string, agentData: Partial<AgentData>) {
    const supabase = await createClient()

    const { error } = await supabase
        .from("agents")
        .update(agentData)
        .eq("id", id)

    if (error) {
        console.error("Error updating agent:", error)
        throw new Error(`Failed to update agent: ${error.message}`)
    }

    revalidatePath("/dashboard/agents")
    return { success: true }
}

export async function deleteAgent(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error("Unauthorized")

    const { error } = await supabase
        .from("agents")
        .delete()
        .eq("id", id)

    if (error) {
        console.error("Error deleting agent:", error)
        throw new Error("Failed to delete agent")
    }

    revalidatePath("/dashboard/agents")
    return { success: true }
}
