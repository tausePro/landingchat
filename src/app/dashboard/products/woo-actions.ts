"use server"

import { createClient, createServiceClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"

// Schema for input validation
const importSchema = z.object({
    url: z.string().url("URL de tienda inválida"),
    consumerKey: z.string().min(1, "Consumer Key requerida"),
    consumerSecret: z.string().min(1, "Consumer Secret requerida"),
})

interface ImportResult {
    success: boolean
    imported: number
    updated: number
    skipped: number
    total: number
    errors: string[]
}

interface WooProduct {
    id: number
    name: string
    slug?: string
    sku?: string
    status: string
    type?: string
    description?: string
    short_description?: string
    price?: string
    regular_price?: string
    sale_price?: string
    stock_status?: string
    stock_quantity?: number | null
    manage_stock?: boolean
    images?: Array<{ src: string }>
    categories?: Array<{ name: string }>
    attributes?: Array<{ name: string; options: string[] }>
}

/**
 * Determina el stock real basándose en stock_quantity y stock_status de WooCommerce.
 * Cuando WooCommerce dice "Hay existencias" pero no tiene cantidad, asignamos 999.
 */
function getStockFromWoo(p: WooProduct): number {
    // Si tiene cantidad exacta, usarla
    if (p.stock_quantity != null && p.stock_quantity >= 0) {
        return p.stock_quantity
    }
    // Si no tiene cantidad pero dice "en stock", asignar 999
    if (p.stock_status === 'instock' || p.stock_status === 'onbackorder') {
        return 999
    }
    // Fuera de stock
    if (p.stock_status === 'outofstock') {
        return 0
    }
    // Fallback: si no gestiona stock y está publicado, asumir disponible
    if (!p.manage_stock && p.status === 'publish') {
        return 999
    }
    return 0
}

export async function importWooCommerceProducts(formData: FormData): Promise<ImportResult> {
    const rawData = {
        url: formData.get("url"),
        consumerKey: formData.get("consumerKey"),
        consumerSecret: formData.get("consumerSecret"),
    }

    const updateExisting = formData.get("updateExisting") === "true"

    // 1. Validate Input
    const validated = importSchema.safeParse(rawData)
    if (!validated.success) {
        return { success: false, imported: 0, updated: 0, skipped: 0, total: 0, errors: [validated.error.issues[0]?.message || "Datos inválidos"] }
    }

    const { url, consumerKey, consumerSecret } = validated.data

    // 2. Auth Check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        throw new Error("Unauthorized")
    }

    // Get Organization ID
    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) {
        throw new Error("No organization found")
    }
    const organizationId = profile.organization_id

    // 3. Fetch ALL products with pagination
    const baseUrl = url.endsWith('/') ? url : `${url}/`
    const credentials = btoa(`${consumerKey}:${consumerSecret}`)

    let allProducts: WooProduct[] = []
    let page = 1
    let hasMore = true
    const errors: string[] = []

    try {
        // Fetch all pages of products
        while (hasMore) {
            const response = await fetch(
                `${baseUrl}wp-json/wc/v3/products?per_page=100&page=${page}&status=publish`,
                {
                    headers: {
                        'Authorization': `Basic ${credentials}`,
                        'Content-Type': 'application/json'
                    },
                    cache: 'no-store'
                }
            )

            if (!response.ok) {
                const text = await response.text()
                return {
                    success: false,
                    imported: 0,
                    updated: 0,
                    skipped: 0,
                    total: 0,
                    errors: [`Error ${response.status}: ${response.statusText}. ${text.substring(0, 100)}`]
                }
            }

            const wcProducts = await response.json()

            if (!Array.isArray(wcProducts)) {
                return { success: false, imported: 0, updated: 0, skipped: 0, total: 0, errors: ["Formato de respuesta inválido de WooCommerce"] }
            }

            allProducts = [...allProducts, ...wcProducts]

            // Check if there are more pages
            hasMore = wcProducts.length === 100
            page++

            // Safety limit: max 10 pages (1000 products)
            if (page > 10) {
                errors.push("Se alcanzó el límite de 1000 productos. Algunos productos no fueron importados.")
                break
            }
        }

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
        return {
            success: false,
            imported: 0,
            updated: 0,
            skipped: 0,
            total: 0,
            errors: [`Error de conexión: ${errorMessage}`]
        }
    }

    // 4. Process products in batches to prevent DB overload
    let importedCount = 0
    let updatedCount = 0
    let skippedCount = 0
    const BATCH_SIZE = 5
    const MAX_CONCURRENT_IMAGES = 3

    // Helper: upload images with concurrency limit
    async function uploadImagesWithLimit(images: Array<{ src: string }>, orgId: string, slug: string): Promise<string[]> {
        const results: string[] = []
        const limitedImages = images.slice(0, 20)

        for (let i = 0; i < limitedImages.length; i += MAX_CONCURRENT_IMAGES) {
            const batch = limitedImages.slice(i, i + MAX_CONCURRENT_IMAGES)
            const batchResults = await Promise.all(
                batch.map(async (img) => {
                    try {
                        return await uploadImageToSupabase(img.src, orgId, slug)
                    } catch {
                        return img.src
                    }
                })
            )
            results.push(...batchResults.filter(Boolean) as string[])
        }
        return results
    }

    // Helper: process a single product
    async function processProduct(p: WooProduct) {
        // Check if product already exists by SKU or name
        let existing: { id: string } | null = null

        if (p.sku) {
            const { data } = await supabase
                .from("products")
                .select("id")
                .eq("organization_id", organizationId)
                .eq("sku", p.sku)
                .maybeSingle()
            existing = data
        }

        if (!existing) {
            const { data } = await supabase
                .from("products")
                .select("id")
                .eq("organization_id", organizationId)
                .eq("name", p.name)
                .maybeSingle()
            existing = data
        }

        if (existing && !updateExisting) {
            skippedCount++
            return
        }

        const slug = p.slug || p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        const validImages = await uploadImagesWithLimit(p.images || [], organizationId, existing ? slug : `${slug}-${Math.random().toString(36).substring(7)}`)

        const variants = p.attributes?.map((attr) => ({
            type: attr.name,
            values: attr.options,
            hasPriceAdjustment: false,
            priceAdjustments: {}
        })) || []

        const price = parseFloat(p.regular_price || p.price || "0")
        const salePrice = p.sale_price ? parseFloat(p.sale_price) : null
        const categories = p.categories?.map(c => c.name) || ["General"]

        if (existing && updateExisting) {
            const { error: updateError } = await supabase
                .from("products")
                .update({
                    description: p.description || p.short_description || "",
                    price,
                    sale_price: salePrice,
                    stock: getStockFromWoo(p),
                    image_url: validImages[0] || null,
                    images: validImages,
                    categories,
                    variants,
                    is_active: p.status === 'publish',
                })
                .eq("id", existing.id)

            if (updateError) {
                errors.push(`${p.name}: ${updateError.message}`)
            } else {
                updatedCount++
            }
        } else {
            const finalSlug = `${slug}-${Math.random().toString(36).substring(7)}`
            const { error: insertError } = await supabase.from("products").insert({
                organization_id: organizationId,
                name: p.name,
                slug: finalSlug,
                description: p.description || p.short_description || "",
                price,
                sale_price: salePrice || undefined,
                stock: getStockFromWoo(p),
                image_url: validImages[0] || null,
                images: validImages,
                categories,
                variants,
                is_active: p.status === 'publish',
                options: [],
                sku: p.sku || undefined
            })

            if (insertError) {
                errors.push(`${p.name}: ${insertError.message}`)
            } else {
                importedCount++
            }
        }
    }

    // Process in batches
    for (let i = 0; i < allProducts.length; i += BATCH_SIZE) {
        const batch = allProducts.slice(i, i + BATCH_SIZE)
        await Promise.all(batch.map(async (p) => {
            try {
                await processProduct(p)
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
                errors.push(`${p.name}: ${errorMessage}`)
            }
        }))
        // Small delay between batches to not overwhelm the DB
        if (i + BATCH_SIZE < allProducts.length) {
            await new Promise(resolve => setTimeout(resolve, 200))
        }
    }

    revalidatePath("/dashboard/products")

    return {
        success: true,
        imported: importedCount,
        updated: updatedCount,
        skipped: skippedCount,
        total: allProducts.length,
        errors
    }
}

// Helper to upload image to Supabase Storage
async function uploadImageToSupabase(url: string, orgId: string, productSlug: string): Promise<string | null> {
    if (!url) return null

    try {
        const response = await fetch(url)
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`)

        const blob = await response.blob()
        const arrayBuffer = await blob.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // Generate a unique path
        const ext = url.split('.').pop()?.split('?')[0] || 'jpg'
        const fileName = `${productSlug}-${Math.random().toString(36).substring(7)}.${ext}`
        const filePath = `${orgId}/${fileName}`

        const supabaseAdmin = createServiceClient()

        // Use product-images bucket (consistent with rest of the app)
        const { error: uploadError } = await supabaseAdmin
            .storage
            .from('product-images')
            .upload(filePath, buffer, {
                contentType: response.headers.get('content-type') || 'image/jpeg',
                upsert: true
            })

        if (uploadError) {
            throw uploadError
        }

        const { data: { publicUrl } } = supabaseAdmin
            .storage
            .from('product-images')
            .getPublicUrl(filePath)

        return publicUrl
    } catch (error) {
        throw error
    }
}

// ============================================================
// MIGRATE EXTERNAL IMAGES TO SUPABASE
// For products that were imported before the fix
// ============================================================

interface MigrateResult {
    success: boolean
    migrated: number
    failed: number
    total: number
    errors: string[]
}

export async function migrateExternalImages(): Promise<MigrateResult> {
    // 1. Auth Check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        throw new Error("Unauthorized")
    }

    // Get Organization ID
    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) {
        throw new Error("No organization found")
    }
    const organizationId = profile.organization_id

    // 2. Get products with external images (not from supabase.co)
    const { data: products, error: fetchError } = await supabase
        .from("products")
        .select("id, name, slug, image_url, images")
        .eq("organization_id", organizationId)
        .not("image_url", "is", null)

    if (fetchError) {
        return { success: false, migrated: 0, failed: 0, total: 0, errors: [fetchError.message] }
    }

    // Filter products with external images (not supabase)
    const productsWithExternalImages = products?.filter(p => {
        const hasExternalPrimary = p.image_url && !p.image_url.includes('supabase.co')
        const hasExternalImages = p.images?.some((img: string) => !img.includes('supabase.co'))
        return hasExternalPrimary || hasExternalImages
    }) || []

    if (productsWithExternalImages.length === 0) {
        return { success: true, migrated: 0, failed: 0, total: 0, errors: [] }
    }

    // 3. Migrate each product's images
    let migrated = 0
    let failed = 0
    const errors: string[] = []

    for (const product of productsWithExternalImages) {
        try {
            const slug = product.slug || product.id
            const newImages: string[] = []

            // Migrate all images
            for (const imgUrl of (product.images || [])) {
                if (imgUrl.includes('supabase.co')) {
                    // Already in supabase, keep it
                    newImages.push(imgUrl)
                } else {
                    // Upload to supabase
                    try {
                        const newUrl = await uploadImageToSupabase(imgUrl, organizationId, slug)
                        if (newUrl) {
                            newImages.push(newUrl)
                        }
                    } catch {
                        // Keep original if upload fails
                        newImages.push(imgUrl)
                        errors.push(`${product.name}: Failed to migrate image`)
                    }
                }
            }

            // Update product
            const { error: updateError } = await supabase
                .from("products")
                .update({
                    image_url: newImages[0] || null,
                    images: newImages
                })
                .eq("id", product.id)

            if (updateError) {
                errors.push(`${product.name}: ${updateError.message}`)
                failed++
            } else {
                migrated++
            }

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
            errors.push(`${product.name}: ${errorMessage}`)
            failed++
        }
    }

    revalidatePath("/dashboard/products")

    return {
        success: true,
        migrated,
        failed,
        total: productsWithExternalImages.length,
        errors
    }
}
