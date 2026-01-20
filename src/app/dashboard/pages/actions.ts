"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { PAGE_TEMPLATES } from "./templates"

export type StorePage = {
    id: string
    organization_id: string
    slug: string
    title: string
    content: string | null // Legacy TEXT column
    content_jsonb: any | null // New JSONB column
    is_published: boolean
    seo_title: string | null
    seo_description: string | null
    created_at: string
    updated_at: string
}

export async function getStorePages(): Promise<StorePage[]> {
    const supabase = await createClient()

    const { data: profile } = await supabase.auth.getUser()
    if (!profile.user) return []

    const { data: userProfile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", profile.user.id)
        .single()

    if (!userProfile?.organization_id) return []

    const { data: pages, error } = await supabase
        .from("store_pages")
        .select("*")
        .eq("organization_id", userProfile.organization_id)
        .order("created_at", { ascending: false })

    if (error) {
        console.error("Error fetching pages:", error)
        return []
    }

    return pages || []
}

export async function getStorePage(pageId: string): Promise<(StorePage & { organization_slug?: string }) | null> {
    const supabase = await createClient()

    const { data: profile } = await supabase.auth.getUser()
    if (!profile.user) return null

    // Obtener org id y slug
    const { data: userProfile } = await supabase
        .from("profiles")
        .select(`
            organization_id,
            organization:organizations (
                slug
            )
        `)
        .eq("id", profile.user.id)
        .single()

    if (!userProfile?.organization_id) return null

    const { data: page, error } = await supabase
        .from("store_pages")
        .select("*")
        .eq("id", pageId)
        .eq("organization_id", userProfile.organization_id)
        .single()

    if (error) {
        console.error("Error fetching page:", error)
        return null
    }

    // @ts-ignore - Supabase types are tricky with joins
    const orgSlug = userProfile.organization?.slug

    return {
        ...page,
        organization_slug: orgSlug
    }
}

export async function createStorePage(data: {
    slug: string
    title: string
    content?: string // Legacy support
    content_jsonb?: any // New JSONB content
    seo_title?: string
    seo_description?: string
}): Promise<{ success: boolean; page?: StorePage; error?: string }> {
    const supabase = await createClient()

    const { data: profile } = await supabase.auth.getUser()
    if (!profile.user) {
        return { success: false, error: "No autenticado" }
    }

    const { data: userProfile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", profile.user.id)
        .single()

    if (!userProfile?.organization_id) {
        return { success: false, error: "No hay organización asociada" }
    }

    // Verificar que el slug no exista
    const { data: existing } = await supabase
        .from("store_pages")
        .select("id")
        .eq("organization_id", userProfile.organization_id)
        .eq("slug", data.slug)
        .single()

    if (existing) {
        return { success: false, error: "Ya existe una página con ese slug" }
    }

    const { data: page, error } = await supabase
        .from("store_pages")
        .insert({
            organization_id: userProfile.organization_id,
            slug: data.slug,
            title: data.title,
            content: data.content || "",  // Legacy fallback
            content_jsonb: data.content_jsonb || (data.content ? { type: 'html', html: data.content } : {}),
            seo_title: data.seo_title || data.title,
            seo_description: data.seo_description || "",
            is_published: false
        })
        .select()
        .single()

    if (error) {
        console.error("Error creating page:", error)
        return { success: false, error: error.message }
    }

    revalidatePath("/dashboard/pages")
    return { success: true, page }
}

export async function updateStorePage(
    pageId: string,
    data: {
        title?: string
        content?: string
        content_jsonb?: any
        seo_title?: string
        seo_description?: string
        is_published?: boolean
    }
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()

    const { data: profile } = await supabase.auth.getUser()
    if (!profile.user) {
        return { success: false, error: "No autenticado" }
    }

    const { data: userProfile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", profile.user.id)
        .single()

    if (!userProfile?.organization_id) {
        return { success: false, error: "No hay organización asociada" }
    }

    const { error } = await supabase
        .from("store_pages")
        .update(data)
        .eq("id", pageId)
        .eq("organization_id", userProfile.organization_id)

    if (error) {
        console.error("Error updating page:", error)
        return { success: false, error: error.message }
    }

    revalidatePath("/dashboard/pages")
    revalidatePath(`/dashboard/pages/${pageId}`)
    return { success: true }
}

export async function deleteStorePage(pageId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()

    const { data: profile } = await supabase.auth.getUser()
    if (!profile.user) {
        return { success: false, error: "No autenticado" }
    }

    const { data: userProfile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", profile.user.id)
        .single()

    if (!userProfile?.organization_id) {
        return { success: false, error: "No hay organización asociada" }
    }

    const { error } = await supabase
        .from("store_pages")
        .delete()
        .eq("id", pageId)
        .eq("organization_id", userProfile.organization_id)

    if (error) {
        console.error("Error deleting page:", error)
        return { success: false, error: error.message }
    }

    revalidatePath("/dashboard/pages")
    return { success: true }
}

export async function createFromTemplate(templateSlug: string): Promise<{ success: boolean; page?: StorePage; error?: string }> {
    const template = PAGE_TEMPLATES.find(t => t.slug === templateSlug)
    if (!template) {
        return { success: false, error: "Template no encontrado" }
    }

    return createStorePage({
        slug: template.slug,
        title: template.title,
        content_jsonb: template.content_jsonb, // Use JSONB structured content
        seo_title: template.seo_title,
        seo_description: template.seo_description
    })
}
