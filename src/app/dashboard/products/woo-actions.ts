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
    description?: string
    short_description?: string
    price?: string
    regular_price?: string
    sale_price?: string
    stock_quantity?: number | null
    images?: Array<{ src: string }>
    categories?: Array<{ name: string }>
    attributes?: Array<{ name: string; options: string[] }>
}

export async function importWooCommerceProducts(formData: FormData): Promise<ImportResult> {
    const rawData = {
        url: formData.get("url"),
        consumerKey: formData.get("consumerKey"),
        consumerSecret: formData.get("consumerSecret"),
    }

    // 1. Validate Input
    const validated = importSchema.safeParse(rawData)
    if (!validated.success) {
        return { success: false, imported: 0, skipped: 0, total: 0, errors: [validated.error.issues[0]?.message || "Datos inválidos"] }
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
                    skipped: 0,
                    total: 0,
                    errors: [`Error ${response.status}: ${response.statusText}. ${text.substring(0, 100)}`]
                }
            }

            const wcProducts = await response.json()

            if (!Array.isArray(wcProducts)) {
                return { success: false, imported: 0, skipped: 0, total: 0, errors: ["Formato de respuesta inválido de WooCommerce"] }
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
            skipped: 0,
            total: 0,
            errors: [`Error de conexión: ${errorMessage}`]
        }
    }

    // 4. Process products
    let importedCount = 0
    let skippedCount = 0

    for (const p of allProducts) {
        try {
            // Check if product already exists by NAME or SKU
            let existing = null

            // First check by SKU if available
            if (p.sku) {
                const { data } = await supabase
                    .from("products")
                    .select("id")
                    .eq("organization_id", organizationId)
                    .eq("sku", p.sku)
                    .maybeSingle()
                existing = data
            }

            // If not found by SKU, check by name
            if (!existing) {
                const { data } = await supabase
                    .from("products")
                    .select("id")
                    .eq("organization_id", organizationId)
                    .eq("name", p.name)
                    .maybeSingle()
                existing = data
            }

            if (existing) {
                skippedCount++
                continue
            }

            // Generate Slug
            const slugBase = p.slug || p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
            const slug = `${slugBase}-${Math.random().toString(36).substring(7)}`

            // Map Images & Upload
            const imagePromises = (p.images || []).slice(0, 5).map(async (img, index) => {
                try {
                    return await uploadImageToSupabase(img.src, organizationId, slug)
                } catch {
                    // Fallback to original URL if upload fails
                    return img.src
                }
            })

            const processedImages = await Promise.all(imagePromises)
            const validImages = processedImages.filter(Boolean) as string[]

            // Map Variants
            const variants = p.attributes?.map((attr) => ({
                type: attr.name,
                values: attr.options,
                hasPriceAdjustment: false,
                priceAdjustments: {}
            })) || []

            // Map Price
            const price = parseFloat(p.regular_price || p.price || "0")
            const salePrice = p.sale_price ? parseFloat(p.sale_price) : undefined

            // Map ALL categories (not just the first one)
            const categories = p.categories?.map(c => c.name) || ["General"]

            // Create Product with stock=0 if not defined (safer default)
            const { error: insertError } = await supabase.from("products").insert({
                organization_id: organizationId,
                name: p.name,
                slug: slug,
                description: p.description || p.short_description || "",
                price: price,
                sale_price: salePrice,
                stock: p.stock_quantity ?? 0, // Changed from 999 to 0 for safety
                image_url: validImages[0] || null,
                images: validImages,
                categories: categories,
                variants: variants,
                is_active: p.status === 'publish',
                options: [],
                sku: p.sku || undefined
            })

            if (insertError) {
                errors.push(`${p.name}: ${insertError.message}`)
            } else {
                importedCount++
            }

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
            errors.push(`${p.name}: ${errorMessage}`)
        }
    }

    revalidatePath("/dashboard/products")

    return {
        success: true,
        imported: importedCount,
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
