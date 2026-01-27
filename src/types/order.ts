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
// Document Type Enum (for tax/invoicing)
// ============================================================================

export const documentTypeSchema = z.enum([
  "CC",      // Cédula de Ciudadanía
  "NIT",     // Número de Identificación Tributaria
  "CE",      // Cédula de Extranjería
  "Passport", // Pasaporte
  "TI",      // Tarjeta de Identidad
])

export type DocumentType = z.infer<typeof documentTypeSchema>

// ============================================================================
// Person Type Enum (for tax/invoicing)
// ============================================================================

export const personTypeSchema = z.enum([
  "Natural",   // Individual person
  "Jurídica",  // Business entity
])

export type PersonType = z.infer<typeof personTypeSchema>

// ============================================================================
// Order Customer Info (embedded in order)
// ============================================================================

export const orderCustomerSchema = z.object({
  full_name: z.string(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional(),
  city: z.string().optional(),
  // Tax/Invoicing fields
  document_type: documentTypeSchema,
  document_number: z.string(),
  person_type: personTypeSchema,
  business_name: z.string().optional(), // Required when person_type is "Jurídica"
  payment_method_fee: z.number().optional(), // Fee for specific payment methods (e.g. COD)
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
// Invoice Data Interface (for future electronic invoicing)
// ============================================================================

export interface InvoiceData {
  invoice_number?: string
  invoice_date?: string
  invoice_url?: string
  provider?: string // e.g., "alegra", "siigo", "facturama"
  status?: "pending" | "issued" | "cancelled" | "error"
  error_message?: string
}

// ============================================================================
// Order Data Interface (full order from database)
// ============================================================================

export interface Order {
  id: string
  organization_id?: string
  customer_id?: string
  order_number?: string
  created_at: string
  updated_at?: string
  status: OrderStatus
  payment_status?: "pending" | "paid" | "failed" | "refunded"
  total: number
  total_amount?: number // Alias for compatibility
  currency: string
  customer: OrderCustomer | null
  customer_info?: OrderCustomer // JSONB field in database
  items: OrderItem[]
  items_count?: number
  shipping_address?: {
    street?: string
    city?: string
    state?: string
    postal_code?: string
    country?: string
  }
  invoice_data?: InvoiceData
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
