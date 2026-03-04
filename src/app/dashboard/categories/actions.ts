"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export interface Category {
    id: string
    organization_id: string
    name: string
    slug: string
    description: string | null
    image_url: string | null
    sort_order: number
    is_visible: boolean
    created_at: string
    updated_at: string
    product_count?: number
}

export interface CategoryProduct {
    id: string
    name: string
    price: number
    sale_price: number | null
    image_url: string | null
    is_active: boolean
}

async function getOrgId() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) throw new Error("No organization found")
    return { supabase, orgId: profile.organization_id }
}

export async function getCategories(): Promise<Category[]> {
    const { supabase, orgId } = await getOrgId()

    const { data: categories, error } = await supabase
        .from("categories")
        .select("*")
        .eq("organization_id", orgId)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true })

    if (error) throw new Error(error.message)

    // Obtener conteo de productos por categoría
    const { data: counts } = await supabase
        .from("product_categories")
        .select("category_id")
        .in("category_id", (categories || []).map(c => c.id))

    const countMap = new Map<string, number>()
    for (const row of counts || []) {
        countMap.set(row.category_id, (countMap.get(row.category_id) || 0) + 1)
    }

    return (categories || []).map(c => ({
        ...c,
        product_count: countMap.get(c.id) || 0
    }))
}

export async function getCategoryProducts(categoryId: string): Promise<CategoryProduct[]> {
    const { supabase } = await getOrgId()

    const { data: links } = await supabase
        .from("product_categories")
        .select("product_id")
        .eq("category_id", categoryId)

    if (!links || links.length === 0) return []

    const productIds = links.map(l => l.product_id)
    const { data: products } = await supabase
        .from("products")
        .select("id, name, price, sale_price, image_url, is_active")
        .in("id", productIds)
        .order("name")

    return products || []
}

function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .trim()
}

export async function createCategory(data: {
    name: string
    description?: string
    image_url?: string
    is_visible?: boolean
}): Promise<{ success: boolean; error?: string; category?: Category }> {
    try {
        const { supabase, orgId } = await getOrgId()
        const slug = generateSlug(data.name)

        const { data: category, error } = await supabase
            .from("categories")
            .insert({
                organization_id: orgId,
                name: data.name.trim(),
                slug,
                description: data.description?.trim() || null,
                image_url: data.image_url || null,
                is_visible: data.is_visible ?? true,
                sort_order: 0
            })
            .select()
            .single()

        if (error) {
            if (error.code === "23505") return { success: false, error: "Ya existe una categoría con ese nombre" }
            return { success: false, error: error.message }
        }

        revalidatePath("/dashboard/categories")
        return { success: true, category }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function updateCategory(id: string, data: {
    name?: string
    description?: string | null
    image_url?: string | null
    sort_order?: number
    is_visible?: boolean
}): Promise<{ success: boolean; error?: string }> {
    try {
        const { supabase } = await getOrgId()

        const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
        if (data.name !== undefined) {
            updateData.name = data.name.trim()
            updateData.slug = generateSlug(data.name)
        }
        if (data.description !== undefined) updateData.description = data.description
        if (data.image_url !== undefined) updateData.image_url = data.image_url
        if (data.sort_order !== undefined) updateData.sort_order = data.sort_order
        if (data.is_visible !== undefined) updateData.is_visible = data.is_visible

        const { error } = await supabase
            .from("categories")
            .update(updateData)
            .eq("id", id)

        if (error) return { success: false, error: error.message }

        // Si cambió el nombre, actualizar el array en products para compatibilidad
        if (data.name !== undefined) {
            await syncCategoryNameToProducts(supabase, id, data.name.trim())
        }

        revalidatePath("/dashboard/categories")
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function deleteCategory(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { supabase } = await getOrgId()

        // Obtener nombre antes de borrar para limpiar el array en products
        const { data: category } = await supabase
            .from("categories")
            .select("name")
            .eq("id", id)
            .single()

        // Borrar categoría (CASCADE borra product_categories automáticamente)
        const { error } = await supabase
            .from("categories")
            .delete()
            .eq("id", id)

        if (error) return { success: false, error: error.message }

        // Limpiar array en products para compatibilidad
        if (category?.name) {
            await removeCategoryNameFromProducts(supabase, category.name)
        }

        revalidatePath("/dashboard/categories")
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function addProductsToCategory(categoryId: string, productIds: string[]): Promise<{ success: boolean; error?: string }> {
    try {
        const { supabase } = await getOrgId()

        // Obtener nombre de la categoría
        const { data: category } = await supabase
            .from("categories")
            .select("name, organization_id")
            .eq("id", categoryId)
            .single()

        if (!category) return { success: false, error: "Categoría no encontrada" }

        // Insertar vínculos
        const links = productIds.map(pid => ({ product_id: pid, category_id: categoryId }))
        await supabase
            .from("product_categories")
            .upsert(links, { onConflict: "product_id,category_id" })

        // Actualizar array en products para compatibilidad
        for (const pid of productIds) {
            const { data: product } = await supabase
                .from("products")
                .select("categories")
                .eq("id", pid)
                .single()

            const cats = (product?.categories as string[]) || []
            if (!cats.includes(category.name)) {
                await supabase
                    .from("products")
                    .update({ categories: [...cats, category.name] })
                    .eq("id", pid)
            }
        }

        revalidatePath("/dashboard/categories")
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function removeProductFromCategory(categoryId: string, productId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { supabase } = await getOrgId()

        const { data: category } = await supabase
            .from("categories")
            .select("name")
            .eq("id", categoryId)
            .single()

        await supabase
            .from("product_categories")
            .delete()
            .eq("product_id", productId)
            .eq("category_id", categoryId)

        // Actualizar array en products para compatibilidad
        if (category?.name) {
            const { data: product } = await supabase
                .from("products")
                .select("categories")
                .eq("id", productId)
                .single()

            const cats = (product?.categories as string[]) || []
            await supabase
                .from("products")
                .update({ categories: cats.filter(c => c !== category.name) })
                .eq("id", productId)
        }

        revalidatePath("/dashboard/categories")
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function getAvailableProducts(categoryId: string): Promise<CategoryProduct[]> {
    const { supabase, orgId } = await getOrgId()

    // Obtener productos ya vinculados
    const { data: linked } = await supabase
        .from("product_categories")
        .select("product_id")
        .eq("category_id", categoryId)

    const linkedIds = (linked || []).map(l => l.product_id)

    // Obtener todos los productos activos no vinculados
    let query = supabase
        .from("products")
        .select("id, name, price, sale_price, image_url, is_active")
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .order("name")

    if (linkedIds.length > 0) {
        query = query.not("id", "in", `(${linkedIds.join(",")})`)
    }

    const { data } = await query
    return data || []
}

// ─── Helpers de compatibilidad ──────────────────────────────────

async function syncCategoryNameToProducts(supabase: any, categoryId: string, newName: string) {
    const { data: oldCat } = await supabase
        .from("categories")
        .select("name")
        .eq("id", categoryId)
        .single()

    if (!oldCat) return

    const { data: links } = await supabase
        .from("product_categories")
        .select("product_id")
        .eq("category_id", categoryId)

    for (const link of links || []) {
        const { data: product } = await supabase
            .from("products")
            .select("categories")
            .eq("id", link.product_id)
            .single()

        const cats = (product?.categories as string[]) || []
        const updated = cats.map(c => c === oldCat.name ? newName : c)
        await supabase
            .from("products")
            .update({ categories: [...new Set(updated)] })
            .eq("id", link.product_id)
    }
}

async function removeCategoryNameFromProducts(supabase: any, categoryName: string) {
    const { data: products } = await supabase
        .from("products")
        .select("id, categories")
        .contains("categories", [categoryName])

    for (const product of products || []) {
        const cats = (product.categories as string[]) || []
        await supabase
            .from("products")
            .update({ categories: cats.filter((c: string) => c !== categoryName) })
            .eq("id", product.id)
    }
}
