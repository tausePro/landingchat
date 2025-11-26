"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export interface ProductData {
    id: string
    organization_id: string
    name: string
    description?: string
    price: number
    image_url?: string
    stock: number
    sku?: string
    categories?: string[]
    images?: string[]
    variants?: Array<{ type: string; values: string[] }>
    is_active?: boolean
    created_at: string
}

export interface CreateProductData {
    name: string
    description?: string
    price: number
    image_url?: string
    stock?: number
    sku?: string
    categories?: string[]
    images?: string[]
    variants?: Array<{ type: string; values: string[] }>
    is_active?: boolean
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
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error("Unauthorized")

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) throw new Error("No organization found")

    const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .single()

    if (error) {
        console.error("Error fetching product:", error)
        throw new Error(`Product not found: ${error.message}`)
    }

    if (data.organization_id !== profile.organization_id) {
        throw new Error("You don't have permission to access this product")
    }

    return data as ProductData
}

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

    const { data, error } = await supabase
        .from("products")
        .insert({
            organization_id: profile.organization_id,
            name: productData.name,
            description: productData.description,
            price: productData.price,
            image_url: productData.image_url,
            stock: productData.stock ?? 0,
            sku: productData.sku,
            categories: productData.categories ?? [],
            images: productData.images ?? [],
            variants: productData.variants ?? [],
            is_active: productData.is_active ?? true
        })
        .select()
        .single()

    if (error) {
        console.error("Error creating product:", error)
        throw new Error(`Failed to create product: ${error.message}`)
    }

    revalidatePath("/dashboard/products")
    return { success: true, product: data }
}

export async function updateProduct(id: string, productData: Partial<CreateProductData>) {
    const supabase = await createClient()

    const { error } = await supabase
        .from("products")
        .update(productData)
        .eq("id", id)

    if (error) {
        console.error("Error updating product:", error)
        throw new Error(`Failed to update product: ${error.message}`)
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
        throw new Error(`Failed to delete product: ${error.message}`)
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
