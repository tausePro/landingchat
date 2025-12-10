"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { generateSlug, generateUniqueSlug } from "@/lib/utils/slug"
import {
  createProductSchema,
  updateProductSchema,
  type CreateProductInput,
  type UpdateProductInput,
  type ProductData,
} from "@/types/product"
import { type ActionResult, success, failure } from "@/types/common"

// Re-export types for backward compatibility
export type {
  CreateProductInput,
  UpdateProductInput,
  ProductData,
} from "@/types/product"

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

    // 4. Generate slug
    const baseSlug = generateSlug(parsed.data.name)
    const { data: existingSlugs } = await supabase
      .from("products")
      .select("slug")
      .eq("organization_id", profile.organization_id)
      .ilike("slug", `${baseSlug}%`)

    const slugs = existingSlugs?.map(p => p.slug) || []
    const slug = generateUniqueSlug(baseSlug, slugs)

    // 5. Insert product
    const { data, error } = await supabase
      .from("products")
      .insert({
        organization_id: profile.organization_id,
        name: parsed.data.name,
        slug: slug,
        description: parsed.data.description,
        price: parsed.data.price,
        image_url: parsed.data.image_url,
        stock: parsed.data.stock ?? 0,
        sku: parsed.data.sku,
        categories: parsed.data.categories ?? [],
        images: parsed.data.images ?? [],
        variants: parsed.data.variants ?? [],
        options: parsed.data.options ?? [],
        is_active: parsed.data.is_active ?? true,
        is_subscription: parsed.data.is_subscription ?? false,
        is_configurable: parsed.data.is_configurable ?? false,
        subscription_config: parsed.data.subscription_config ?? null,
        configurable_options: parsed.data.configurable_options ?? null,
        sale_price: parsed.data.sale_price ?? null,
        badge_id: parsed.data.badge_id ?? null,
        // Bundle fields
        is_bundle: parsed.data.is_bundle ?? false,
        bundle_items: parsed.data.bundle_items ?? [],
        bundle_discount_type: parsed.data.bundle_discount_type ?? null,
        bundle_discount_value: parsed.data.bundle_discount_value ?? 0,
      })
      .select()
      .single()

    if (error) {
      return failure(error.message)
    }

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

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", id)

    if (error) {
      return failure(error.message)
    }

    revalidatePath("/dashboard/products")
    return success(undefined)
  } catch (err) {
    return failure(err instanceof Error ? err.message : "Unknown error deleting product")
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
