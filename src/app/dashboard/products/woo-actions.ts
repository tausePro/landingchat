"use server"

import { createClient } from "@/lib/supabase/server"
import WooCommerceRestApi from "@woocommerce/woocommerce-rest-api"
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
        return { success: false, imported: 0, errors: [validated.error.errors[0]?.message || "Datos inválidos"] }
    }

    const { url, consumerKey, consumerSecret } = validated.data

    // 2. Auth Check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // Get Organization ID
    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) throw new Error("No organization found")
    const organizationId = profile.organization_id

    // 3. Connect to WooCommerce
    const api = new WooCommerceRestApi({
        url: url,
        consumerKey: consumerKey,
        consumerSecret: consumerSecret,
        version: "wc/v3"
    })

    let importedCount = 0
    const errors: string[] = []

    try {
        // Fetch products (limit 100 per page, loop if needed ideally, but starting with 100 is safe)
        // Only fetching 'publish' status to avoid trash
        const response = await api.get("products", { per_page: 50, status: 'publish' })
        const wcProducts = response.data

        if (!Array.isArray(wcProducts)) {
            return { success: false, imported: 0, errors: ["Respuesta inválida de WooCommerce"] }
        }

        for (const p of wcProducts) {
            try {
                // Check if product already exists (by name to avoid duplicates for now, simple check)
                // Ideally we'd store the external ID
                const { data: existing } = await supabase
                    .from("products")
                    .select("id")
                    .eq("organization_id", organizationId)
                    .eq("name", p.name)
                    .single()

                if (existing) {
                    console.log(`Skipping existing product: ${p.name}`)
                    continue
                }

                // Map Images
                const images = p.images?.map((img: any) => img.src) || []

                // Map Variants/Attributes
                // WC attributes: [{name: 'Size', options: ['S', 'M']}, ...]
                const variants = p.attributes?.map((attr: any) => ({
                    type: attr.name,
                    values: attr.options,
                    hasPriceAdjustment: false, // Default to false for imported
                    priceAdjustments: {}
                })) || []

                // Map Price
                const price = parseFloat(p.regular_price || p.price || "0")
                const salePrice = p.sale_price ? parseFloat(p.sale_price) : undefined

                // Create Product
                const { error: insertError } = await supabase.from("products").insert({
                    organization_id: organizationId,
                    name: p.name,
                    description: p.description || p.short_description || "",
                    price: price,
                    sale_price: salePrice,
                    stock: p.stock_quantity ?? 999, // WC null stock often means unlimited
                    image_url: images[0] || null, // Primary image
                    images: images,
                    category: p.categories?.[0]?.name || "General",
                    variants: variants,
                    is_active: p.status === 'publish',
                    options: [], // Default empty
                    sku: p.sku || undefined
                })

                if (insertError) {
                    console.error(`Error inserting ${p.name}:`, insertError)
                    errors.push(`Error importando ${p.name}`)
                } else {
                    importedCount++
                }

            } catch (err) {
                console.error(`Error processing product ${p.id}:`, err)
            }
        }

    } catch (error: any) {
        console.error("WooCommerce API Error:", error)
        return {
            success: false,
            imported: importedCount,
            errors: ["Error de conexión con WooCommerce. Verifica tus credenciales."]
        }
    }

    revalidatePath("/dashboard/products")
    return { success: true, imported: importedCount, errors }
}
