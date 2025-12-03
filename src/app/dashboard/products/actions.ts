"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export interface SubscriptionConfig {
    enabled: boolean
    price: number
    interval: 'day' | 'week' | 'month' | 'year'
    interval_count: number
    trial_days?: number
    discount_percentage?: number
}

export interface ConfigOption {
    name: string
    type: 'text' | 'select' | 'number' | 'color'
    required: boolean
    placeholder?: string
    max_length?: number
    choices?: string[]
    min?: number
    max?: number
    default?: any
    affects_preview?: boolean
}

export interface ProductData {
    id: string
    organization_id: string
    name: string
    description?: string
    price: number
    sale_price?: number
    image_url?: string
    stock: number
    sku?: string
    categories?: string[]
    images?: string[]
    variants?: Array<{ type: string; values: string[]; priceAdjustment?: number }>
    options?: Array<{ name: string; values: string[] }>
    is_active?: boolean
    is_subscription?: boolean
    is_configurable?: boolean
    subscription_config?: SubscriptionConfig
    configurable_options?: ConfigOption[]
    // Marketing fields
    badge_id?: string
    free_shipping_enabled?: boolean
    free_shipping_min_amount?: number
    free_shipping_conditions?: string
    meta_title?: string
    meta_description?: string
    keywords?: string[]
    tags?: string[]
    is_featured?: boolean
    max_quantity_per_customer?: number
    created_at: string
}

export interface CreateProductData {
    name: string
    description?: string
    price: number
    sale_price?: number
    image_url?: string
    stock?: number
    sku?: string
    categories?: string[]
    images?: string[]
    variants?: Array<{ type: string; values: string[]; priceAdjustment?: number }>
    options?: Array<{ name: string; values: string[] }>
    is_active?: boolean
    is_subscription?: boolean
    is_configurable?: boolean
    subscription_config?: SubscriptionConfig
    configurable_options?: ConfigOption[]
    // Marketing fields
    badge_id?: string
    free_shipping_enabled?: boolean
    free_shipping_min_amount?: number
    free_shipping_conditions?: string
    meta_title?: string
    meta_description?: string
    keywords?: string[]
    tags?: string[]
    is_featured?: boolean
    max_quantity_per_customer?: number
}

export async function getProducts() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return []

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) return []

    const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: false })

    if (error) {
        console.error("Error fetching products:", error)
        return []
    }

    return data as ProductData[]
}

export async function getProductById(id: string) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .single()

    if (error) {
        console.error("Error fetching product:", error)
        return null
    }

    return data as ProductData
}

import { generateSlug, generateUniqueSlug } from "@/lib/utils/slug"

export async function createProduct(productData: CreateProductData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error("Unauthorized")

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) throw new Error("No organization found")

    // Generate slug
    const baseSlug = generateSlug(productData.name)

    // Check for existing slugs in this organization
    const { data: existingSlugs } = await supabase
        .from("products")
        .select("slug")
        .eq("organization_id", profile.organization_id)
        .ilike("slug", `${baseSlug}%`)

    const slugs = existingSlugs?.map(p => p.slug) || []
    const slug = generateUniqueSlug(baseSlug, slugs)

    const { data, error } = await supabase
        .from("products")
        .insert({
            organization_id: profile.organization_id,
            name: productData.name,
            slug: slug,
            description: productData.description,
            price: productData.price,
            image_url: productData.image_url,
            stock: productData.stock ?? 0,
            sku: productData.sku,
            categories: productData.categories ?? [],
            images: productData.images ?? [],
            variants: productData.variants ?? [],
            options: productData.options ?? [],
            is_active: productData.is_active ?? true,
            is_subscription: productData.is_subscription ?? false,
            is_configurable: productData.is_configurable ?? false,
            subscription_config: productData.subscription_config ?? null,
            configurable_options: productData.configurable_options ?? null,
            sale_price: productData.sale_price ?? null,
            badge_id: productData.badge_id ?? null
        })
        .select()
        .single()

    if (error) {
        console.error("Error creating product:", error)
        return { success: false, error: error.message }
    }

    revalidatePath("/dashboard/products")
    return { success: true, product: data }
}

export async function updateProduct(id: string, productData: Partial<CreateProductData>) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error("Unauthorized")

    // If name is updated, we might want to update slug, but usually slugs should be stable for SEO.
    // For now, we'll keep the slug stable unless explicitly requested or if it's missing.
    // If we wanted to update slug on name change:
    /*
    let updateData: any = { ...productData }
    
    if (productData.name) {
        const { data: product } = await supabase.from("products").select("organization_id").eq("id", id).single()
        if (product) {
            const baseSlug = generateSlug(productData.name)
            const { data: existingSlugs } = await supabase
                .from("products")
                .select("slug")
                .eq("organization_id", product.organization_id)
                .neq("id", id) // Exclude current product
                .ilike("slug", `${baseSlug}%`)
            
            const slugs = existingSlugs?.map(p => p.slug) || []
            updateData.slug = generateUniqueSlug(baseSlug, slugs)
        }
    }
    */

    const { error } = await supabase
        .from("products")
        .update(productData)
        .eq("id", id)

    if (error) {
        console.error("Error updating product:", error)
        return { success: false, error: error.message }
    }

    revalidatePath("/dashboard/products")
    revalidatePath(`/dashboard/products/${id}/edit`)
    return { success: true }
}

export async function deleteProduct(id: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", id)

    if (error) {
        console.error("Error deleting product:", error)
        return { success: false, error: error.message }
    }

    revalidatePath("/dashboard/products")
    return { success: true }
}

export async function uploadProductImage(file: File, organizationId: string): Promise<string> {
    const supabase = await createClient()

    const fileExt = file.name.split('.').pop()
    const fileName = `${organizationId}/${Date.now()}.${fileExt}`

    const { data, error } = await supabase.storage
        .from('product-images')
        .upload(fileName, file)

    if (error) {
        console.error("Error uploading image:", error)
        throw new Error(`Failed to upload image: ${error.message}`)
    }

    const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(data.path)

    return publicUrl
}
