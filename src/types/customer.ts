/**
 * Customer domain types and Zod schemas
 * Defines validation schemas and TypeScript types for customer-related operations
 */

import { z } from "zod"

// ============================================================================
// Sub-schemas for complex customer fields
// ============================================================================

export const customerAddressSchema = z.object({
  city: z.string().optional(),
  neighborhood: z.string().optional(),
  zone: z.string().optional(),
  street: z.string().optional(),
  postal_code: z.string().optional(),
})

// ============================================================================
// Create Customer Schema
// ============================================================================

export const createCustomerSchema = z.object({
  full_name: z.string()
    .min(1, "Full name is required")
    .max(200, "Full name must be 200 characters or less")
    .refine((val) => val.trim().length > 0, "Full name cannot be empty or whitespace only"),
  email: z.string().email("Invalid email address").optional().nullable(),
  phone: z.string().max(50, "Phone must be 50 characters or less").optional().nullable(),
  category: z.enum(["nuevo", "recurrente", "vip", "inactivo"]).default("nuevo"),
  acquisition_channel: z.enum(["web", "chat", "referido", "importado", "manual"]).default("web"),
  address: customerAddressSchema.optional(),
  tags: z.array(z.string()).default([]),
})

// ============================================================================
// Update Customer Schema (all fields optional)
// ============================================================================

export const updateCustomerSchema = createCustomerSchema.partial()

// ============================================================================
// Inferred Types
// ============================================================================

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>
export type CustomerAddress = z.infer<typeof customerAddressSchema>

// ============================================================================
// Customer Data Interface (full customer from database)
// ============================================================================

export interface Customer {
  id: string
  organization_id?: string
  full_name: string
  email: string | null
  phone: string | null
  tags: string[]
  category: string | null
  acquisition_channel: string | null
  total_orders: number
  total_spent: number
  created_at: string
  last_interaction_at?: string
  address?: CustomerAddress
}

// ============================================================================
// Query Parameters
// ============================================================================

export interface GetCustomersParams {
  page?: number
  limit?: number
  search?: string
  category?: string
  channel?: string
  zone?: string
  tags?: string[]
}
