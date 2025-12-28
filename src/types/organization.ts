/**
 * Organization domain types and Zod schemas
 * Defines validation schemas and TypeScript types for organization-related operations
 */

import { z } from "zod"

// ============================================================================
// Organization Details Schema (for onboarding)
// ============================================================================

export const organizationDetailsSchema = z.object({
  name: z.string()
    .min(1, "Organization name is required")
    .max(200, "Organization name must be 200 characters or less")
    .refine((val) => val.trim().length > 0, "Organization name cannot be empty or whitespace only"),
  subdomain: z.string()
    .min(2, "Subdomain must be at least 2 characters")
    .max(50, "Subdomain must be 50 characters or less")
    .regex(/^[a-z0-9-]+$/, "Subdomain can only contain lowercase letters, numbers, and hyphens")
    .refine((val) => !val.startsWith("-") && !val.endsWith("-"), "Subdomain cannot start or end with a hyphen"),
  contactEmail: z.string()
    .email("Invalid email address"),
  industry: z.string()
    .min(1, "Industry is required"),
  logoUrl: z.string()
    .url("Invalid logo URL")
    .optional()
    .or(z.literal("")),
})

// ============================================================================
// Agent Data Schema (for onboarding)
// ============================================================================

export const agentDataSchema = z.object({
  type: z.enum(["sales", "support", "custom"]),
  name: z.string()
    .min(1, "Agent name is required")
    .max(100, "Agent name must be 100 characters or less")
    .refine((val) => val.trim().length > 0, "Agent name cannot be empty or whitespace only"),
})

// ============================================================================
// Update Organization Schema
// ============================================================================

export const updateOrganizationSchema = organizationDetailsSchema.partial()

// ============================================================================
// Inferred Types
// ============================================================================

export type OrganizationDetailsInput = z.infer<typeof organizationDetailsSchema>
export type AgentDataInput = z.infer<typeof agentDataSchema>
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>

// ============================================================================
// Organization Data Interface (full organization from database)
// ============================================================================

export interface Organization {
  id: string
  name: string
  slug: string
  subdomain?: string
  contact_email?: string
  industry?: string
  logo_url?: string | null
  onboarding_completed: boolean
  onboarding_step: number
  created_at: string
  updated_at?: string
  // Storefront settings
  storefront_template?: string
  storefront_config?: Record<string, unknown>
  primary_color?: string
  secondary_color?: string
  // SEO fields
  meta_title?: string
  meta_description?: string
  favicon_url?: string | null
}

// ============================================================================
// Organization Settings Interface
// ============================================================================

export interface OrganizationSettings {
  storefront_template: string
  storefront_config: Record<string, unknown>
  primary_color: string
  secondary_color: string
  customer_gate_enabled: boolean
  customer_gate_fields: string[]
}

// ============================================================================
// Dashboard Tracking & Settings Helpers
// ============================================================================

export interface OrganizationTrackingConfig {
  meta_pixel_id?: string
  google_analytics_id?: string
  tiktok_pixel_id?: string
  posthog_enabled?: boolean
  [key: string]: unknown
}

export interface OrganizationBrandingSettings {
  primaryColor?: string
  [key: string]: unknown
}

export interface OrganizationSettingsOverrides {
  branding?: OrganizationBrandingSettings
  shipping?: {
    free_shipping_threshold?: number
    [key: string]: unknown
  }
  [key: string]: unknown
}
