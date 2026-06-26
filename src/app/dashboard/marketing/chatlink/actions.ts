"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

/**
 * Config de ChatLink (capa 1 del builder). Vive en `organizations.settings.chatlink`
 * (jsonb, sin migración). La página /c/[slug] la lee con fallback al auto-gen.
 */
export interface ChatLinkConfig {
    greeting?: string
    productIds?: string[]
    triggers?: { label: string; context: string }[]
}

export interface ChatLinkProduct {
    id: string
    name: string
    image_url: string | null
    price: number | null
    sale_price: number | null
}

type Result<T> = { success: true; data: T } | { success: false; error: string }

async function resolveOrg(): Promise<{ supabase: Awaited<ReturnType<typeof createClient>>; orgId: string } | null> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()
    if (!profile?.organization_id) return null
    return { supabase, orgId: profile.organization_id }
}

export async function getChatLinkConfig(): Promise<Result<{ slug: string; config: ChatLinkConfig; products: ChatLinkProduct[] }>> {
    const ctx = await resolveOrg()
    if (!ctx) return { success: false, error: "No autorizado" }
    const { supabase, orgId } = ctx

    const { data: org } = await supabase
        .from("organizations")
        .select("slug, settings")
        .eq("id", orgId)
        .single()

    const { data: products } = await supabase
        .from("products")
        .select("id, name, image_url, price, sale_price")
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })

    const config = ((org?.settings as { chatlink?: ChatLinkConfig } | null)?.chatlink) ?? {}
    return {
        success: true,
        data: {
            slug: (org?.slug as string) ?? "",
            config,
            products: (products as ChatLinkProduct[] | null) ?? [],
        },
    }
}

export async function updateChatLinkConfig(config: ChatLinkConfig): Promise<Result<null>> {
    const ctx = await resolveOrg()
    if (!ctx) return { success: false, error: "No autorizado" }
    const { supabase, orgId } = ctx

    // Merge superficial al nivel de settings: preserva branding/storefront/etc.
    const { data: org } = await supabase
        .from("organizations")
        .select("settings")
        .eq("id", orgId)
        .single()
    const current = (org?.settings as Record<string, unknown> | null) ?? {}
    const next = { ...current, chatlink: config }

    const { error } = await supabase
        .from("organizations")
        .update({ settings: next })
        .eq("id", orgId)

    if (error) return { success: false, error: error.message }
    revalidatePath("/dashboard/marketing/chatlink")
    return { success: true, data: null }
}
