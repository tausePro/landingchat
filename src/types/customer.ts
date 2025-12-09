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
// Tax/Invoicing Enums
// ============================================================================

export const documentTypeSchema = z.enum([
  "CC",      // Cédula de Ciudadanía
  "NIT",     // Número de Identificación Tributaria
  "CE",      // Cédula de Extranjería
  "Passport", // Pasaporte
  "TI",      // Tarjeta de Identidad
])

export const personTypeSchema = z.enum([
  "Natural",   // Individual person
  "Jurídica",  // Business entity
])

export type DocumentType = z.infer<typeof documentTypeSchema>
export type PersonType = z.infer<typeof personTypeSchema>

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
  // Tax/Invoicing fields
  document_type: documentTypeSchema.optional(),
  document_number: z.string().max(50).optional(),
  person_type: personTypeSchema.optional(),
  business_name: z.string().max(200).optional(),
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
  // Tax/Invoicing fields
  document_type?: DocumentType
  document_number?: string
  person_type?: PersonType
  business_name?: string
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
