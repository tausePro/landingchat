"use server"

import { createClient } from "@/lib/supabase/server"
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
    errors: string[]
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
        return { success: false, imported: 0, errors: [validated.error.issues[0]?.message || "Datos inválidos"] }
    }

    const { url, consumerKey, consumerSecret } = validated.data

    console.log("🚀 Starting Import with:", { url, keyPattern: consumerKey.substring(0, 5) + "..." })

    // 2. Auth Check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        console.error("❌ Unauthorized user")
        throw new Error("Unauthorized")
    }

    // Get Organization ID
    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) {
        console.error("❌ No organization found for user", user.id)
        throw new Error("No organization found")
    }
    const organizationId = profile.organization_id
    console.log("✅ Organization found:", organizationId)

    // 3. Connect to WooCommerce using native Fetch (Basic Auth)
    // The SDK was causing conflicts with Supabase Auth fetch
    // Basic Auth over HTTPS is supported by WooCommerce

    let importedCount = 0
    const errors: string[] = []

    try {
        console.log("⏳ Fetching products from WooCommerce via native fetch...")

        // Construct URL
        const baseUrl = url.endsWith('/') ? url : `${url}/`
        // Also try Basic Auth header as backup/primary if query params fail, 
        // but query params are often easier for quick implementation if HTTPS.
        // Let's stick to query params first as per WC docs over HTTPS it's simplest, 
        // OR better: Authorization header "Basic " + btoa(ck:cs)

        const credentials = btoa(`${consumerKey}:${consumerSecret}`)

        const response = await fetch(`${baseUrl}wp-json/wc/v3/products?per_page=100&status=publish`, {
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/json'
            },
            cache: 'no-store'
        })

        console.log(`📡 Response Status: ${response.status} ${response.statusText}`)

        if (!response.ok) {
            const text = await response.text()
            console.error("❌ WooCommerce Error Response:", text)
            return { success: false, imported: 0, errors: [`Error ${response.status}: ${response.statusText}`] }
        }

        const wcProducts = await response.json()
        console.log(`📦 Body parsed, type: ${Array.isArray(wcProducts) ? 'Array' : typeof wcProducts}`)
        console.log(`🔢 Products found: ${wcProducts?.length}`)

        if (!Array.isArray(wcProducts)) {
            console.error("❌ Invalid response format (not array):", wcProducts)
            return { success: false, imported: 0, errors: ["Formato de respuesta inválido de WooCommerce"] }
        }

        for (const p of wcProducts) {
            console.log(`Processing ${p.name} (SKU: ${p.sku})`)
            try {
                // Check if product already exists
                const { data: existing } = await supabase
                    .from("products")
                    .select("id")
                    .eq("organization_id", organizationId)
                    .eq("name", p.name)
                    .single()

                if (existing) {
                    console.log(`⏩ Skipping existing product: ${p.name}`)
                    continue
                }

                // Generate Slug
                const slugBase = p.slug || p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
                const slug = p.slug || `${slugBase}-${Math.random().toString(36).substring(7)}`

                // Map Images & Upload
                const imagePromises = (p.images || []).map(async (img: any, index: number) => {
                    try {
                        return await uploadImageToSupabase(img.src, organizationId, slug)
                    } catch (e) {
                        console.error(`Failed to upload image ${index} for ${p.name}:`, e)
                        return img.src
                    }
                })

                const processedImages = await Promise.all(imagePromises)
                const validImages = processedImages.filter(Boolean) as string[]

                // Map Variants
                const variants = p.attributes?.map((attr: any) => ({
                    type: attr.name,
                    values: attr.options,
                    hasPriceAdjustment: false,
                    priceAdjustments: {}
                })) || []

                // Map Price
                const price = parseFloat(p.regular_price || p.price || "0")
                const salePrice = p.sale_price ? parseFloat(p.sale_price) : undefined

                // Create Product
                const { error: insertError } = await supabase.from("products").insert({
                    organization_id: organizationId,
                    name: p.name,
                    slug: slug,
                    description: p.description || p.short_description || "",
                    price: price,
                    sale_price: salePrice,
                    stock: p.stock_quantity ?? 999,
                    image_url: validImages[0] || null,
                    images: validImages,
                    categories: [p.categories?.[0]?.name || "General"],
                    variants: variants,
                    is_active: p.status === 'publish',
                    options: [],
                    sku: p.sku || undefined
                })

                if (insertError) {
                    console.error(`❌ Error inserting ${p.name}:`, insertError)
                    errors.push(`Error al importar ${p.name}: ${insertError.message} (${insertError.details || ''})`)
                } else {
                    console.log(`✅ Imported: ${p.name}`)
                    importedCount++
                }

            } catch (err) {
                console.error(`❌ Error processing product ${p.id}:`, err)
            }
        }

    } catch (error: any) {
        console.error("❌ Fetch Fatal Error:", error)
        return {
            success: false,
            imported: importedCount,
            errors: [`Error de conexión: ${error.message}`]
        }
    }

    revalidatePath("/dashboard/products")
    return { success: true, imported: importedCount, errors }
}

// Helper to upload image (outside the main function)
import { createServiceClient } from "@/lib/supabase/server"

async function uploadImageToSupabase(url: string, orgId: string, productSlug: string): Promise<string | null> {
    if (!url) return null

    try {
        const response = await fetch(url)
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`)

        const blob = await response.blob()
        const arrayBuffer = await blob.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // Generate a unique path
        // products/{orgId}/{productSlug}-{random}.jpg
        const ext = url.split('.').pop()?.split('?')[0] || 'jpg'
        const fileName = `${productSlug}-${Math.random().toString(36).substring(7)}.${ext}`
        const filePath = `${orgId}/${fileName}`

        const supabaseAdmin = createServiceClient()

        const { error: uploadError } = await supabaseAdmin
            .storage
            .from('products')
            .upload(filePath, buffer, {
                contentType: response.headers.get('content-type') || 'image/jpeg',
                upsert: true
            })

        if (uploadError) {
            console.error("Storage upload error:", uploadError)
            // Falls back to throwing so we catch it above and return original URL
            throw uploadError
        }

        const { data: { publicUrl } } = supabaseAdmin
            .storage
            .from('products')
            .getPublicUrl(filePath)

        return publicUrl
    } catch (error) {
        console.error("Image upload helper error:", error)
        throw error
    }
}
