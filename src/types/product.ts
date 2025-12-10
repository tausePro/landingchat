/**
 * Product domain types and Zod schemas
 * Defines validation schemas and TypeScript types for product-related operations
 */

import { z } from "zod"

// ============================================================================
// Sub-schemas for complex product fields
// ============================================================================

export const subscriptionConfigSchema = z.object({
  enabled: z.boolean(),
  price: z.number().positive("Subscription price must be positive"),
  interval: z.enum(["day", "week", "month", "year"]),
  interval_count: z.number().int().positive(),
  trial_days: z.number().int().min(0).optional(),
  discount_percentage: z.number().min(0).max(100).optional(),
})

export const configOptionSchema = z.object({
  name: z.string().min(1, "Option name is required"),
  type: z.enum(["text", "select", "number", "color"]),
  required: z.boolean(),
  placeholder: z.string().optional(),
  max_length: z.number().int().positive().optional(),
  choices: z.array(z.string()).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  default: z.any().optional(),
  affects_preview: z.boolean().optional(),
})

export const variantSchema = z.object({
  type: z.string().min(1),
  values: z.array(z.string()),
  priceAdjustment: z.number().optional(), // Legacy field
  hasPriceAdjustment: z.boolean().optional().default(false),
  priceAdjustments: z.record(z.string(), z.number()).optional(), // { "XL": 5000, "XXL": 10000 }
})

export const optionSchema = z.object({
  name: z.string().min(1),
  values: z.array(z.string()),
})

// Schema para items de un bundle (combo)
export const bundleItemSchema = z.object({
  product_id: z.string().uuid("ID de producto inválido"),
  quantity: z.number().int().positive("La cantidad debe ser positiva").default(1),
  variant: z.string().optional(), // Variante específica si aplica
})

// ============================================================================
// Create Product Schema
// ============================================================================

export const createProductSchema = z.object({
  name: z.string()
    .min(1, "Name is required")
    .max(200, "Name must be 200 characters or less")
    .refine((val) => val.trim().length > 0, "Name cannot be empty or whitespace only"),
  description: z.string().optional(),
  price: z.number().positive("Price must be positive"),
  sale_price: z.number().positive("Sale price must be positive").optional().nullable(),
  image_url: z.string().url("Invalid image URL").optional().nullable(),
  stock: z.number().int().min(0, "Stock cannot be negative").default(0),
  sku: z.string().max(100).optional().nullable(),
  categories: z.array(z.string()).default([]),
  images: z.array(z.string().url()).default([]),
  variants: z.array(variantSchema).default([]),
  options: z.array(optionSchema).default([]),
  is_active: z.boolean().default(true),
  is_subscription: z.boolean().default(false),
  is_configurable: z.boolean().default(false),
  subscription_config: subscriptionConfigSchema.optional().nullable(),
  configurable_options: z.array(configOptionSchema).optional().nullable(),
  // Marketing fields
  badge_id: z.string().uuid().optional().nullable(),
  free_shipping_enabled: z.boolean().optional(),
  free_shipping_min_amount: z.number().positive().optional().nullable(),
  free_shipping_conditions: z.string().optional().nullable(),
  meta_title: z.string().max(70).optional().nullable(),
  meta_description: z.string().max(160).optional().nullable(),
  keywords: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  is_featured: z.boolean().optional(),
  max_quantity_per_customer: z.number().int().positive().optional().nullable(),
  // Bundle/Combo fields
  is_bundle: z.boolean().default(false),
  bundle_items: z.array(bundleItemSchema).default([]),
  bundle_discount_type: z.enum(['fixed', 'percentage']).optional().nullable(),
  bundle_discount_value: z.number().min(0).default(0),
})

// ============================================================================
// Update Product Schema (all fields optional except id)
// ============================================================================

export const updateProductSchema = createProductSchema.partial()

// ============================================================================
// Inferred Types
// ============================================================================

export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
export type SubscriptionConfig = z.infer<typeof subscriptionConfigSchema>
export type ConfigOption = z.infer<typeof configOptionSchema>
export type ProductVariant = z.infer<typeof variantSchema>
export type ProductOption = z.infer<typeof optionSchema>
export type BundleItem = z.infer<typeof bundleItemSchema>

// ============================================================================
// Product Data Interface (full product from database)
// ============================================================================

export interface ProductData {
  id: string
  organization_id: string
  name: string
  slug?: string
  description?: string
  price: number
  sale_price?: number | null
  image_url?: string | null
  stock: number
  sku?: string | null
  categories?: string[]
  images?: string[]
  variants?: ProductVariant[]
  options?: ProductOption[]
  is_active?: boolean
  is_subscription?: boolean
  is_configurable?: boolean
  subscription_config?: SubscriptionConfig | null
  configurable_options?: ConfigOption[] | null
  // Marketing fields
  badge_id?: string | null
  free_shipping_enabled?: boolean
  free_shipping_min_amount?: number | null
  free_shipping_conditions?: string | null
  meta_title?: string | null
  meta_description?: string | null
  keywords?: string[]
  tags?: string[]
  is_featured?: boolean
  max_quantity_per_customer?: number | null
  // Bundle/Combo fields
  is_bundle?: boolean
  bundle_items?: BundleItem[]
  bundle_discount_type?: 'fixed' | 'percentage' | null
  bundle_discount_value?: number
  created_at: string
}
