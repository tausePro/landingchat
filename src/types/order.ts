/**
 * Order domain types and Zod schemas
 * Defines validation schemas and TypeScript types for order-related operations
 */

import { z } from "zod"

// ============================================================================
// Order Status Enum
// ============================================================================

export const orderStatusSchema = z.enum([
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
])

export type OrderStatus = z.infer<typeof orderStatusSchema>

// ============================================================================
// Order Item Schema
// ============================================================================

export const orderItemSchema = z.object({
  product_id: z.string().uuid(),
  product_name: z.string(),
  quantity: z.number().int().positive(),
  unit_price: z.number().positive(),
  total_price: z.number().positive(),
  variant: z.string().optional(),
  options: z.record(z.string(), z.string()).optional(),
})

export type OrderItem = z.infer<typeof orderItemSchema>

// ============================================================================
// Order Customer Info (embedded in order)
// ============================================================================

export const orderCustomerSchema = z.object({
  full_name: z.string(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
})

export type OrderCustomer = z.infer<typeof orderCustomerSchema>

// ============================================================================
// Create Order Schema
// ============================================================================

export const createOrderSchema = z.object({
  customer_id: z.string().uuid().optional(),
  items: z.array(orderItemSchema).min(1, "Order must have at least one item"),
  total: z.number().positive("Total must be positive"),
  currency: z.string().default("COP"),
  status: orderStatusSchema.default("pending"),
  shipping_address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postal_code: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  notes: z.string().max(1000).optional(),
})

// ============================================================================
// Update Order Schema
// ============================================================================

export const updateOrderSchema = z.object({
  status: orderStatusSchema.optional(),
  notes: z.string().max(1000).optional(),
  shipping_address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postal_code: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
})

// ============================================================================
// Inferred Types
// ============================================================================

export type CreateOrderInput = z.infer<typeof createOrderSchema>
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>

// ============================================================================
// Order Data Interface (full order from database)
// ============================================================================

export interface Order {
  id: string
  organization_id?: string
  customer_id?: string
  created_at: string
  updated_at?: string
  status: OrderStatus
  total: number
  total_amount?: number // Alias for compatibility
  currency: string
  customer: OrderCustomer | null
  items: OrderItem[]
  items_count?: number
  shipping_address?: {
    street?: string
    city?: string
    state?: string
    postal_code?: string
    country?: string
  }
  notes?: string
}

// ============================================================================
// Query Parameters
// ============================================================================

export interface GetOrdersParams {
  page?: number
  limit?: number
  status?: string
  search?: string
}
