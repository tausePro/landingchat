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
import { type ActionResult, success, failure } from "@/types"
import { revalidatePath } from "next/cache"
import { z } from "zod"

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

const importItemSchema = z.object({
    name: z.string().trim().min(1, "Nombre requerido"),
    price: z.number().positive("Precio debe ser mayor a 0"),
    description: z.string().nullish(),
    imageUrl: z.string().url().nullish(),
})

export interface StoreImportSummary {
    created: number
    failed: number
    errors: string[]
}

/** Crea los productos revisados por el merchant. */
export async function confirmStoreImport(
    items: Array<z.infer<typeof importItemSchema>>
): Promise<ActionResult<StoreImportSummary>> {
    if (!(await requireUser())) return failure("No autenticado")

    if (!Array.isArray(items) || items.length === 0) {
        return failure("No hay productos para importar")
    }

    const summary: StoreImportSummary = { created: 0, failed: 0, errors: [] }

    for (const raw of items) {
        const parsed = importItemSchema.safeParse(raw)
        if (!parsed.success) {
            summary.failed++
            summary.errors.push(`${(raw as { name?: string })?.name ?? "Producto"}: ${parsed.error.issues[0]?.message}`)
            continue
        }
        const item = parsed.data

        // createProduct revalida con Zod (aplica defaults de categories/
        // variants/etc.), por eso basta el objeto mínimo. El cast salva la
        // fricción de tipos (el param es z.infer=salida, con defaults requeridos).
        const result = await createProduct({
            name: item.name,
            description: item.description ?? undefined,
            price: item.price,
            images: item.imageUrl ? [item.imageUrl] : [],
            image_url: item.imageUrl ?? undefined,
            stock: 0,
            is_active: true,
        } as unknown as Parameters<typeof createProduct>[0])

        if (result.success) {
            summary.created++
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
