"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { generateSlug, generateUniqueSlug } from "@/lib/utils/slug"
import { resolveDefaultVariantPricingSync, type DefaultVariantPricingSyncResult } from "@/lib/commerce/defaultVariantPricingSync"
import {
  createProductSchema,
  updateProductSchema,
  type CreateProductInput,
  type UpdateProductInput,
  type ProductData,
} from "@/types/product"
import { type ActionResult, success, failure } from "@/types/common"
import { canCreateResource } from "@/lib/utils/subscription"

// Re-export types for backward compatibility
export type {
  CreateProductInput,
  UpdateProductInput,
  ProductData,
} from "@/types/product"

function readOptionalNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

// ============================================================================
// Sync de variante default con product_variants (Commerce Reset Fase 2)
// ============================================================================

/**
 * Sincroniza la variante default en product_variants cuando se crea o actualiza un producto.
 * Mantiene product_variants como fuente de verdad para pricing/stock,
 * mientras products conserva los campos legacy como fallback.
 * 
 * Ref: docs-private/ANALISIS_COMMERCE_RESET.md §3 Grupo B
 */
async function syncDefaultVariant(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string,
  organizationId: string,
  data: {
    price?: number
    sale_price?: number | null
    stock?: number
    sku?: string | null
    image_url?: string | null
    is_active?: boolean
    name?: string
  }
) {
  try {
    const variantData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    let resolvedPricing: DefaultVariantPricingSyncResult | null = null

    const loadResolvedPricing = async () => {
      if (resolvedPricing) {
        return resolvedPricing
      }

      const { data: productPricing } = await supabase
        .from("products")
        .select("price, sale_price")
        .eq("id", productId)
        .eq("organization_id", organizationId)
        .single()

      resolvedPricing = resolveDefaultVariantPricingSync({
        price: readOptionalNumber(productPricing?.price) ?? data.price,
        sale_price: readOptionalNumber(productPricing?.sale_price) ?? data.sale_price,
      })

      return resolvedPricing
    }

    if (data.price !== undefined || data.sale_price !== undefined) {
      const pricing = await loadResolvedPricing()
      variantData.price = pricing.price
      variantData.compare_at_price = pricing.compare_at_price
    }
    if (data.stock !== undefined) variantData.stock_quantity = data.stock
    if (data.sku !== undefined) variantData.sku = data.sku || null
    if (data.image_url !== undefined) variantData.image_url = data.image_url || null
    if (data.is_active !== undefined) variantData.is_active = data.is_active
    if (data.name !== undefined) variantData.title = `${data.name} — Default`

    // Intentar actualizar variante default existente
    const { data: existing } = await supabase
      .from("product_variants")
      .select("id")
      .eq("product_id", productId)
      .eq("is_default", true)
      .single()

    if (existing) {
      await supabase
        .from("product_variants")
        .update(variantData)
        .eq("id", existing.id)
    } else {
      const pricing = await loadResolvedPricing()
      // Crear variante default si no existe (producto nuevo o backfill faltante)
      await supabase
        .from("product_variants")
        .insert({
          product_id: productId,
          organization_id: organizationId,
          title: data.name ? `${data.name} — Default` : "Default",
          sku: data.sku || null,
          position: 0,
          is_default: true,
          is_active: data.is_active ?? true,
          price: pricing.price,
          compare_at_price: pricing.compare_at_price,
          stock_quantity: data.stock ?? 0,
          image_url: data.image_url || null,
          option_values: [],
        })
    }
  } catch (error) {
    // No fallar la operación principal si la sync falla
    console.error("[syncDefaultVariant] Error syncing variant:", error)
  }
}

/**
 * Fetches all products for the current user's organization
 * @returns Array of products or empty array on error
 */
export async function getProducts(): Promise<ActionResult<ProductData[]>> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return failure("Unauthorized")
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single()

    if (!profile?.organization_id) {
      return failure("No organization found")
    }

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false })

    if (error) {
      return failure(error.message)
    }

    return success(data as ProductData[])
  } catch (err) {
    return failure(err instanceof Error ? err.message : "Unknown error fetching products")
  }
}


/**
 * Fetches a single product by ID
 * @param id - Product UUID
 * @returns Product data or null on error
 */
export async function getProductById(id: string): Promise<ActionResult<ProductData | null>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .single()

    if (error) {
      return failure(error.message)
    }

    return success(data as ProductData)
  } catch (err) {
    return failure(err instanceof Error ? err.message : "Unknown error fetching product")
  }
}

/**
 * Creates a new product with Zod validation
 * @param productData - Product data to create
 * @returns Created product data or error
 */
export async function createProduct(
  productData: CreateProductInput
): Promise<ActionResult<{ id: string; product: ProductData }>> {
  // 1. Validate input with Zod
  const parsed = createProductSchema.safeParse(productData)
  if (!parsed.success) {
    console.error("[createProduct] Zod validation failed:", JSON.stringify(parsed.error.flatten(), null, 2))
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  try {
    // 2. Auth check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return failure("Unauthorized")
    }

    // 3. Get org context
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single()

    if (!profile?.organization_id) {
      return failure("No organization found")
    }

    // 4. Verificar límite de productos del plan
    const resourceCheck = await canCreateResource(profile.organization_id, "product")
    if (!resourceCheck.allowed) {
      return failure(resourceCheck.message || "Has alcanzado el límite de productos de tu plan.")
    }

    // 5. Generate slug
    const baseSlug = generateSlug(parsed.data.name)
    const { data: existingSlugs } = await supabase
      .from("products")
      .select("slug")
      .eq("organization_id", profile.organization_id)
      .ilike("slug", `${baseSlug}%`)

    const slugs = existingSlugs?.map(p => p.slug) || []
    const slug = generateUniqueSlug(baseSlug, slugs)

    // 5. Insert product (spread parsed.data para incluir TODOS los campos validados)
    const { data, error } = await supabase
      .from("products")
      .insert({
        ...parsed.data,
        organization_id: profile.organization_id,
        slug,
      })
      .select()
      .single()

    if (error) {
      return failure(error.message)
    }

    // Sincronizar variante default en product_variants (Commerce Reset Fase 2)
    await syncDefaultVariant(supabase, data.id, profile.organization_id, {
      price: parsed.data.price,
      sale_price: parsed.data.sale_price,
      stock: parsed.data.stock,
      sku: parsed.data.sku,
      image_url: parsed.data.image_url,
      is_active: parsed.data.is_active,
      name: parsed.data.name,
    })

    revalidatePath("/dashboard/products")
    return success({ id: data.id, product: data as ProductData })
  } catch (err) {
    return failure(err instanceof Error ? err.message : "Unknown error creating product")
  }
}


/**
 * Updates an existing product with Zod validation
 * @param id - Product UUID
 * @param productData - Partial product data to update
 * @returns Success or error
 */
export async function updateProduct(
  id: string,
  productData: UpdateProductInput
): Promise<ActionResult<void>> {
  // 1. Validate input with Zod
  const parsed = updateProductSchema.safeParse(productData)
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  try {
    // 2. Auth check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return failure("Unauthorized")
    }

    // 3. Update product
    const { error } = await supabase
      .from("products")
      .update(parsed.data)
      .eq("id", id)

    if (error) {
      return failure(error.message)
    }

    // 4. Sincronizar variante default (Commerce Reset Fase 2)
    // Necesitamos el organization_id para la sync
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single()

    if (profile?.organization_id) {
      await syncDefaultVariant(supabase, id, profile.organization_id, {
        price: parsed.data.price,
        sale_price: parsed.data.sale_price,
        stock: parsed.data.stock,
        sku: parsed.data.sku,
        image_url: parsed.data.image_url,
        is_active: parsed.data.is_active,
        name: parsed.data.name,
      })
    }

    revalidatePath("/dashboard/products")
    revalidatePath(`/dashboard/products/${id}/edit`)
    return success(undefined)
  } catch (err) {
    return failure(err instanceof Error ? err.message : "Unknown error updating product")
  }
}

/**
 * Deletes a product by ID
 * @param id - Product UUID
 * @returns Success or error
 */
export async function deleteProduct(id: string): Promise<ActionResult<void>> {
  try {
    const supabase = await createClient()

    // 1. Verificar autenticación
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return failure("No autenticado")
    }

    // 2. Verificar que el producto pertenece a la org del usuario
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single()

    if (!profile?.organization_id) {
      return failure("No se encontró organización")
    }

    // 3. Eliminar con .select() para confirmar que realmente se borró
    const { data: deleted, error } = await supabase
      .from("products")
      .delete()
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .select("id")

    if (error) {
      return failure(error.message)
    }

    if (!deleted || deleted.length === 0) {
      return failure("No se pudo eliminar el producto. Verifica que tengas permisos.")
    }

    revalidatePath("/dashboard/products")
    return success(undefined)
  } catch (err) {
    return failure(err instanceof Error ? err.message : "Unknown error deleting product")
  }
}

/**
 * Quick inline update for a single product field (price, stock, sale_price)
 * @param id - Product UUID
 * @param field - Field to update
 * @param value - New value
 * @returns Success or error
 */
export async function quickUpdateProduct(
  id: string,
  field: "price" | "stock" | "sale_price",
  value: number
): Promise<ActionResult<void>> {
  try {
    if (value < 0) return failure("El valor no puede ser negativo")

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return failure("No autenticado")

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single()

    if (!profile?.organization_id) return failure("No se encontró organización")

    const updateData: Record<string, number | null> = { [field]: value }
    // Si el precio de venta es 0, limpiarlo
    if (field === "sale_price" && value === 0) {
      updateData.sale_price = null
    }

    const { error } = await supabase
      .from("products")
      .update(updateData)
      .eq("id", id)
      .eq("organization_id", profile.organization_id)

    if (error) return failure(error.message)

    // Sincronizar variante default (Commerce Reset Fase 2)
    const syncData: Record<string, unknown> = {}
    if (field === "price") syncData.price = value
    if (field === "sale_price") syncData.sale_price = value === 0 ? null : value
    if (field === "stock") syncData.stock = value
    await syncDefaultVariant(supabase, id, profile.organization_id, syncData)

    revalidatePath("/dashboard/products")
    return success(undefined)
  } catch (err) {
    return failure(err instanceof Error ? err.message : "Error updating product")
  }
}

/**
 * Toggles a product's active status
 * @param id - Product UUID
 * @param isActive - New active status
 * @returns Success or error
 */
export async function toggleProductStatus(
  id: string,
  isActive: boolean
): Promise<ActionResult<void>> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return failure("No autenticado")

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single()

    if (!profile?.organization_id) return failure("No se encontró organización")

    const { error } = await supabase
      .from("products")
      .update({ is_active: isActive })
      .eq("id", id)
      .eq("organization_id", profile.organization_id)

    if (error) return failure(error.message)

    // Sincronizar variante default (Commerce Reset Fase 2)
    await syncDefaultVariant(supabase, id, profile.organization_id, { is_active: isActive })

    revalidatePath("/dashboard/products")
    return success(undefined)
  } catch (err) {
    return failure(err instanceof Error ? err.message : "Error toggling product status")
  }
}

/**
 * Obtiene todas las categorías únicas de los productos de la organización
 * con el conteo de productos por categoría.
 * No requiere tabla dedicada — agrega desde el campo JSONB categories.
 */
export async function getOrganizationCategories(): Promise<
  ActionResult<Array<{ name: string; productCount: number }>>
> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return failure("Unauthorized")

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single()

    if (!profile?.organization_id) return failure("No organization found")

    const { data: products, error } = await supabase
      .from("products")
      .select("categories")
      .eq("organization_id", profile.organization_id)

    if (error) return failure(error.message)

    // Agregar categorías únicas con conteo
    const categoryMap = new Map<string, number>()
    for (const product of products || []) {
      const cats = (product.categories as string[]) || []
      for (const cat of cats) {
        categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1)
      }
    }

    const categories = Array.from(categoryMap.entries())
      .map(([name, productCount]) => ({ name, productCount }))
      .sort((a, b) => a.name.localeCompare(b.name))

    return success(categories)
  } catch (err) {
    return failure(err instanceof Error ? err.message : "Error fetching categories")
  }
}

/**
 * Renombra una categoría en todos los productos de la organización.
 * Actualiza el array JSONB in-place.
 */
export async function renameCategory(
  oldName: string,
  newName: string
): Promise<ActionResult<{ updated: number }>> {
  try {
    if (!oldName.trim() || !newName.trim()) return failure("Nombres inválidos")
    if (oldName === newName) return failure("El nombre es igual")

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return failure("Unauthorized")

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single()

    if (!profile?.organization_id) return failure("No organization found")

    // Buscar productos que tienen esta categoría
    const { data: products, error: fetchError } = await supabase
      .from("products")
      .select("id, categories")
      .eq("organization_id", profile.organization_id)
      .contains("categories", [oldName])

    if (fetchError) return failure(fetchError.message)

    let updated = 0
    for (const product of products || []) {
      const cats = (product.categories as string[]) || []
      const newCats = cats.map(c => c === oldName ? newName : c)
      // Eliminar duplicados en caso de que newName ya exista
      const uniqueCats = [...new Set(newCats)]

      const { error } = await supabase
        .from("products")
        .update({ categories: uniqueCats })
        .eq("id", product.id)

      if (!error) updated++
    }

    revalidatePath("/dashboard/products")
    revalidatePath("/dashboard/categories")
    return success({ updated })
  } catch (err) {
    return failure(err instanceof Error ? err.message : "Error renaming category")
  }
}

/**
 * Elimina una categoría de todos los productos de la organización.
 */
export async function deleteCategory(
  categoryName: string
): Promise<ActionResult<{ updated: number }>> {
  try {
    if (!categoryName.trim()) return failure("Nombre inválido")

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return failure("Unauthorized")

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single()

    if (!profile?.organization_id) return failure("No organization found")

    const { data: products, error: fetchError } = await supabase
      .from("products")
      .select("id, categories")
      .eq("organization_id", profile.organization_id)
      .contains("categories", [categoryName])

    if (fetchError) return failure(fetchError.message)

    let updated = 0
    for (const product of products || []) {
      const cats = (product.categories as string[]) || []
      const newCats = cats.filter(c => c !== categoryName)

      const { error } = await supabase
        .from("products")
        .update({ categories: newCats })
        .eq("id", product.id)

      if (!error) updated++
    }

    revalidatePath("/dashboard/products")
    revalidatePath("/dashboard/categories")
    return success({ updated })
  } catch (err) {
    return failure(err instanceof Error ? err.message : "Error deleting category")
  }
}

/**
 * Uploads a product image to storage
 * @param file - Image file to upload
 * @param organizationId - Organization UUID
 * @returns Public URL of uploaded image
 */
export async function uploadProductImage(
  file: File,
  organizationId: string
): Promise<ActionResult<{ url: string }>> {
  try {
    const supabase = await createClient()

    const fileExt = file.name.split('.').pop()
    const fileName = `${organizationId}/${Date.now()}.${fileExt}`

    const { data, error } = await supabase.storage
      .from('product-images')
      .upload(fileName, file)

    if (error) {
      return failure(`Failed to upload image: ${error.message}`)
    }

    const { data: { publicUrl } } = supabase.storage
      .from('product-images')
      .getPublicUrl(data.path)

    return success({ url: publicUrl })
  } catch (err) {
    return failure(err instanceof Error ? err.message : "Unknown error uploading image")
  }
}

/**
 * Updates display_order for multiple products at once
 * @param orderedIds - Array of product IDs in desired display order
 */
export async function updateProductOrder(orderedIds: string[]): Promise<ActionResult<void>> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return failure("Unauthorized")

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single()

    if (!profile?.organization_id) return failure("No organization found")

    // Update each product's display_order based on its position in the array
    const updates = orderedIds.map((id, index) =>
      supabase
        .from("products")
        .update({ display_order: index + 1 })
        .eq("id", id)
        .eq("organization_id", profile.organization_id)
    )

    const results = await Promise.all(updates)
    const firstError = results.find(r => r.error)
    if (firstError?.error) {
      return failure(firstError.error.message)
    }

    revalidatePath("/dashboard/products")
    return success(undefined)
  } catch (err) {
    return failure(err instanceof Error ? err.message : "Unknown error updating product order")
  }
}

// ============================================================================
// CSV Export / Import
// ============================================================================

const CSV_HEADERS = [
  "id",
  "name",
  "description",
  "price",
  "sale_price",
  "stock",
  "sku",
  "categories",
  "is_active",
] as const

function escapeCsvField(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return ""
  const str = String(value)
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Exports all products as CSV string
 */
export async function exportProductsCsv(): Promise<ActionResult<string>> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return failure("No autenticado")

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single()

    if (!profile?.organization_id) return failure("No se encontró organización")

    const { data: products, error } = await supabase
      .from("products")
      .select("id, name, description, price, sale_price, stock, sku, categories, is_active")
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false })

    if (error) return failure(error.message)

    const rows = (products || []).map((p) =>
      CSV_HEADERS.map((h) => {
        if (h === "categories") {
          return escapeCsvField(
            Array.isArray(p.categories) ? (p.categories as string[]).join("; ") : ""
          )
        }
        return escapeCsvField(p[h as keyof typeof p] as string | number | boolean | null)
      }).join(",")
    )

    // BOM para que Excel reconozca UTF-8
    const bom = "\uFEFF"
    const csv = bom + CSV_HEADERS.join(",") + "\n" + rows.join("\n")

    return success(csv)
  } catch (err) {
    return failure(err instanceof Error ? err.message : "Error exporting products")
  }
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ",") {
        fields.push(current.trim())
        current = ""
      } else {
        current += char
      }
    }
  }
  fields.push(current.trim())
  return fields
}

interface CsvImportResult {
  updated: number
  errors: string[]
}

/**
 * Imports products from CSV string, updating existing products by ID
 */
export async function importProductsCsv(csvContent: string): Promise<ActionResult<CsvImportResult>> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return failure("No autenticado")

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single()

    if (!profile?.organization_id) return failure("No se encontró organización")

    // Parse CSV
    const lines = csvContent
      .replace(/^\uFEFF/, "") // Remove BOM
      .split(/\r?\n/)
      .filter((l) => l.trim())

    if (lines.length < 2) return failure("El archivo CSV está vacío o no tiene datos")

    const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim())
    const idIndex = headers.indexOf("id")
    if (idIndex === -1) return failure("El CSV debe tener una columna 'id'")

    const result: CsvImportResult = { updated: 0, errors: [] }

    for (let i = 1; i < lines.length; i++) {
      const fields = parseCsvLine(lines[i])
      const id = fields[idIndex]
      if (!id) continue

      const updateData: Record<string, unknown> = {}

      headers.forEach((header, idx) => {
        const value = fields[idx] ?? ""
        switch (header) {
          case "id":
            break // Skip, used for matching
          case "name":
            if (value) updateData.name = value
            break
          case "description":
            updateData.description = value || null
            break
          case "price":
            if (value) {
              const n = parseFloat(value)
              if (!isNaN(n) && n >= 0) updateData.price = n
            }
            break
          case "sale_price":
            if (value) {
              const n = parseFloat(value)
              if (!isNaN(n) && n >= 0) updateData.sale_price = n
            } else {
              updateData.sale_price = null
            }
            break
          case "stock":
            if (value !== "") {
              const n = parseInt(value, 10)
              if (!isNaN(n) && n >= 0) updateData.stock = n
            }
            break
          case "sku":
            updateData.sku = value || null
            break
          case "categories":
            if (value) {
              updateData.categories = value.split(";").map((c: string) => c.trim()).filter(Boolean)
            } else {
              updateData.categories = []
            }
            break
          case "is_active":
            if (value.toLowerCase() === "false" || value === "0") {
              updateData.is_active = false
            } else if (value.toLowerCase() === "true" || value === "1") {
              updateData.is_active = true
            }
            break
        }
      })

      if (Object.keys(updateData).length === 0) continue

      const { error } = await supabase
        .from("products")
        .update(updateData)
        .eq("id", id)
        .eq("organization_id", profile.organization_id)

      if (error) {
        result.errors.push(`Fila ${i + 1} (${id}): ${error.message}`)
      } else {
        result.updated++
        // Sincronizar variante default (Commerce Reset Fase 2)
        await syncDefaultVariant(supabase, id, profile.organization_id, {
          price: updateData.price as number | undefined,
          sale_price: updateData.sale_price as number | null | undefined,
          stock: updateData.stock as number | undefined,
          sku: updateData.sku as string | null | undefined,
          is_active: updateData.is_active as boolean | undefined,
          name: updateData.name as string | undefined,
        })
      }
    }

    revalidatePath("/dashboard/products")
    return success(result)
  } catch (err) {
    return failure(err instanceof Error ? err.message : "Error importing products")
  }
}
