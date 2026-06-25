"use server"

/**
 * Onboarding mágico — server actions (importar catálogo desde la web del merchant).
 *
 * 1. previewStoreImport(url): extrae SIN escribir → el merchant revisa/edita.
 * 2. confirmStoreImport(products): crea los productos revisados reusando
 *    createProduct (validación Zod + slug + variantes + límite de plan).
 *
 * La extracción es una PROPUESTA: nunca se importa a ciegas.
 */

import { createClient } from "@/lib/supabase/server"
import { createProduct } from "@/app/dashboard/products/actions"
import { extractStoreFromUrl, type ExtractedStore } from "@/lib/onboarding/store-importer"
import { buildOnboardingOrgUpdates, type ImportedBrand } from "@/lib/onboarding/brand-updates"
import { type ActionResult, success, failure } from "@/types"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { syncVariantDrafts } from "@/lib/commerce/syncVariantDrafts"
import type { ProductVariantDraft } from "@/lib/commerce/variantDrafts"

async function requireUser() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user
}

/** Extrae el catálogo de una URL para previsualizar (no escribe nada). */
export async function previewStoreImport(url: string): Promise<ActionResult<ExtractedStore>> {
    if (!(await requireUser())) return failure("No autenticado")

    const result = await extractStoreFromUrl(url)
    if (!result.ok) return failure(result.error)
    return success(result.data)
}

const importVariantSchema = z.object({
    title: z.string().trim().min(1),
    sku: z.string().nullish(),
    price: z.number().positive(),
    compareAtPrice: z.number().positive().nullish(),
    optionValues: z.array(z.object({ name: z.string(), value: z.string() })).default([]),
})

const importItemSchema = z.object({
    name: z.string().trim().min(1, "Nombre requerido"),
    price: z.number().positive("Precio debe ser mayor a 0"),
    description: z.string().nullish(),
    imageUrl: z.string().url().nullish(),
    variants: z.array(importVariantSchema).nullish(),
})

export interface StoreImportSummary {
    created: number
    failed: number
    errors: string[]
}

/** Crea los productos revisados por el merchant. */
export async function confirmStoreImport(
    items: Array<z.infer<typeof importItemSchema>>,
    brand?: ImportedBrand,
    options?: { initialStock?: number },
): Promise<ActionResult<StoreImportSummary>> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return failure("No autenticado")

    if (!Array.isArray(items) || items.length === 0) {
        return failure("No hay productos para importar")
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()
    const orgId = profile?.organization_id ?? null

    // Onboarding mágico: desde la marca extraída generamos el contrato de diseño
    // (designSystem) y lo aplicamos a la organización → el storefront sale con la
    // marca del cliente + plantilla premium + tipografía desde el primer momento.
    if (brand && orgId) {
        await persistImportedBrand(supabase, orgId, brand)
    }

    const summary: StoreImportSummary = { created: 0, failed: 0, errors: [] }
    const initialStock = options?.initialStock && options.initialStock > 0 ? Math.floor(options.initialStock) : 100

    for (const raw of items) {
        const parsed = importItemSchema.safeParse(raw)
        if (!parsed.success) {
            summary.failed++
            summary.errors.push(`${(raw as { name?: string })?.name ?? "Producto"}: ${parsed.error.issues[0]?.message}`)
            continue
        }
        const item = parsed.data

        // Re-hospedamos la imagen scrapeada en NUESTRO storage: las URLs externas
        // del merchant no están en images.remotePatterns (next.config), así que
        // next/image las bloquearía (salían rotas). Si falla, queda sin imagen.
        const hostedImage = orgId && item.imageUrl
            ? await rehostProductImage(supabase, item.imageUrl, orgId)
            : null

        // createProduct revalida con Zod (aplica defaults de categories/
        // variants/etc.), por eso basta el objeto mínimo. El cast salva la
        // fricción de tipos (el param es z.infer=salida, con defaults requeridos).
        const result = await createProduct({
            name: item.name,
            description: item.description ?? undefined,
            price: item.price,
            images: hostedImage ? [hostedImage] : [],
            image_url: hostedImage ?? undefined,
            // Vendibles por default (inStock = stock > 0). El merchant elige el
            // stock inicial en el import (o ajusta luego en el dashboard).
            stock: initialStock,
            is_active: true,
        } as unknown as Parameters<typeof createProduct>[0])

        if (result.success) {
            summary.created++
            // Variantes (talla/color con precio propio): reemplazan la variante
            // default que createProduct crea. No bloquea el producto si falla.
            if (orgId && item.variants && item.variants.length > 1) {
                await createImportedVariants(supabase, result.data.id, orgId, item.variants, initialStock)
            }
        } else {
            summary.failed++
            // El límite de plan corta el resto: lo reportamos y paramos
            summary.errors.push(`${item.name}: ${result.error}`)
            if (result.error?.includes("límite")) break
        }
    }

    revalidatePath("/dashboard/products")
    return success(summary)
}

type ServerSupabase = Awaited<ReturnType<typeof createClient>>
type ImportedVariant = z.infer<typeof importVariantSchema>

/**
 * Crea las variantes importadas (talla/color) reemplazando la variante default
 * que createProduct genera. syncVariantDrafts actualiza por posición: la default
 * (posición 0) pasa a ser la 1ª variante real y el resto se inserta. No lanza:
 * un fallo de variantes no debe tumbar el producto ya creado.
 */
async function createImportedVariants(
    supabase: ServerSupabase,
    productId: string,
    organizationId: string,
    variants: ImportedVariant[],
    initialStock: number,
): Promise<void> {
    try {
        const drafts: ProductVariantDraft[] = variants.map((v, i) => ({
            title: v.title.slice(0, 120),
            sku: v.sku?.trim() || null,
            position: i,
            is_default: i === 0,
            is_active: true,
            price: v.price,
            compare_at_price: v.compareAtPrice && v.compareAtPrice > v.price ? v.compareAtPrice : null,
            stock_quantity: initialStock,
            image_url: null,
            option_values: v.optionValues.map((o) => ({ option_name: o.name, value: o.value })),
        }))
        await syncVariantDrafts({ client: supabase, productId, organizationId, drafts })
    } catch (error) {
        console.error("[createImportedVariants] no-fatal:", error)
    }
}

/** Persiste la marca/color/logo extraídos en la organización (RLS: su propia org). */
async function persistImportedBrand(supabase: ServerSupabase, orgId: string, brand: ImportedBrand): Promise<void> {
    const { data: org } = await supabase
        .from("organizations")
        .select("settings, industry")
        .eq("id", orgId)
        .single()

    const updates = buildOnboardingOrgUpdates(brand, {
        settings: (org?.settings ?? null) as Record<string, unknown> | null,
        industry: typeof org?.industry === "string" ? org.industry : null,
    })

    // El logo del sitio es externo → re-hospedarlo para que next/image lo sirva.
    if (brand.logoUrl) {
        const hostedLogo = await rehostProductImage(supabase, brand.logoUrl, orgId)
        if (hostedLogo) updates.logo_url = hostedLogo
    }

    await supabase.from("organizations").update(updates).eq("id", orgId)
}

/**
 * Descarga una imagen externa y la re-hospeda en el bucket product-images
 * (supabase.co, permitido por next/image). Devuelve la URL pública o null si
 * falla (timeout, no-imagen, muy grande, error de subida) — nunca lanza.
 */
async function rehostProductImage(supabase: ServerSupabase, url: string, orgId: string): Promise<string | null> {
    try {
        const res = await fetch(url, {
            signal: AbortSignal.timeout(8000),
            headers: { "user-agent": "Mozilla/5.0 (compatible; LandingChatImporter/1.0)" },
        })
        if (!res.ok) return null
        const contentType = res.headers.get("content-type") ?? ""
        if (!contentType.startsWith("image/")) return null
        const buffer = await res.arrayBuffer()
        if (buffer.byteLength === 0 || buffer.byteLength > 5_000_000) return null
        const ext = (contentType.split("/")[1] ?? "jpg").split("+")[0].replace(/[^a-z0-9]/gi, "").slice(0, 5) || "jpg"
        const path = `${orgId}/imported/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`
        const { error } = await supabase.storage.from("product-images").upload(path, buffer, { contentType, upsert: false })
        if (error) return null
        const { data } = supabase.storage.from("product-images").getPublicUrl(path)
        return data.publicUrl || null
    } catch {
        return null
    }
}
