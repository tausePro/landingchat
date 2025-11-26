"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export type MarketplaceItemType = 'agent_template' | 'channel' | 'feature' | 'service'

export interface MarketplaceItemData {
    id?: string
    type: MarketplaceItemType
    name: string
    description?: string
    icon?: string
    base_price: number
    cost: number
    billing_period: 'monthly' | 'yearly' | 'one_time'
    config_schema?: any
    is_active: boolean
    // Agent Template specific
    agent_role?: string
    system_prompt?: string
    default_config?: any
}

export async function getMarketplaceItems() {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from("marketplace_items")
        .select(`
            *,
            agent_templates (*)
        `)
        .order("created_at", { ascending: false })

    if (error) {
        console.error("Error fetching marketplace items:", error)
        throw new Error("Failed to fetch marketplace items")
    }

    return data
}

export async function createMarketplaceItem(data: MarketplaceItemData) {
    const supabase = await createClient()

    // 1. Create Marketplace Item
    const { data: item, error: itemError } = await supabase
        .from("marketplace_items")
        .insert({
            type: data.type,
            name: data.name,
            description: data.description,
            icon: data.icon,
            base_price: data.base_price,
            cost: data.cost,
            billing_period: data.billing_period,
            config_schema: data.config_schema,
            is_active: data.is_active,
        })
        .select()
        .single()

    if (itemError) {
        console.error("Error creating marketplace item:", itemError)
        throw new Error("Failed to create marketplace item")
    }

    // 2. If it's an agent template, create the template record
    if (data.type === 'agent_template' && data.agent_role && data.system_prompt) {
        const { error: templateError } = await supabase
            .from("agent_templates")
            .insert({
                marketplace_item_id: item.id,
                name: data.name, // Usually same as item name
                role: data.agent_role,
                system_prompt: data.system_prompt,
                default_config: data.default_config || {},
            })

        if (templateError) {
            console.error("Error creating agent template:", templateError)
            // Cleanup: delete the item if template creation fails
            await supabase.from("marketplace_items").delete().eq("id", item.id)
            throw new Error("Failed to create agent template details")
        }
    }

    revalidatePath("/admin/marketplace")
    return { success: true, itemId: item.id }
}

export async function updateMarketplaceItem(id: string, data: MarketplaceItemData) {
    const supabase = await createClient()

    // 1. Update Marketplace Item
    const { error: itemError } = await supabase
        .from("marketplace_items")
        .update({
            type: data.type,
            name: data.name,
            description: data.description,
            icon: data.icon,
            base_price: data.base_price,
            cost: data.cost,
            billing_period: data.billing_period,
            config_schema: data.config_schema,
            is_active: data.is_active,
        })
        .eq("id", id)

    if (itemError) {
        console.error("Error updating marketplace item:", itemError)
        throw new Error("Failed to update marketplace item")
    }

    // 2. Update Agent Template if applicable
    if (data.type === 'agent_template') {
        // Check if template exists
        const { data: existingTemplate } = await supabase
            .from("agent_templates")
            .select("id")
            .eq("marketplace_item_id", id)
            .single()

        if (existingTemplate) {
            const { error: templateError } = await supabase
                .from("agent_templates")
                .update({
                    name: data.name,
                    role: data.agent_role,
                    system_prompt: data.system_prompt,
                    default_config: data.default_config || {},
                })
                .eq("marketplace_item_id", id)

            if (templateError) throw templateError
        } else if (data.agent_role && data.system_prompt) {
            // Create if it didn't exist (e.g. changed type to agent_template)
            const { error: templateError } = await supabase
                .from("agent_templates")
                .insert({
                    marketplace_item_id: id,
                    name: data.name,
                    role: data.agent_role,
                    system_prompt: data.system_prompt,
                    default_config: data.default_config || {},
                })

            if (templateError) throw templateError
        }
    }

    revalidatePath("/admin/marketplace")
    return { success: true }
}

export async function deleteMarketplaceItem(id: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from("marketplace_items")
        .delete()
        .eq("id", id)

    if (error) {
        console.error("Error deleting marketplace item:", error)
        throw new Error("Failed to delete marketplace item")
    }

    revalidatePath("/admin/marketplace")
    return { success: true }
}
