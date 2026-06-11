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
  // Tax settings
  tax_enabled: z.boolean().optional(),
  tax_rate: z.number().min(0).max(100).optional(),
  prices_include_tax: z.boolean().optional(),
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
// i18n / Localization (Fase 1 — single-locale-per-tenant)
// ============================================================================

/**
 * ISO 4217 currency codes soportados en Fase 1.
 *
 * Ampliar a 'EUR' | 'MXN' | 'BRL' cuando aparezcan tenants concretos,
 * sincronizando el CHECK constraint en `organizations.currency_code`.
 */
export type SupportedCurrency = "COP" | "USD"

/**
 * BCP 47 locale codes soportados en Fase 1.
 *
 * Ampliar a 'es-MX' | 'es-ES' | 'pt-BR' cuando aparezcan tenants concretos,
 * sincronizando el CHECK constraint en `organizations.locale`.
 */
export type SupportedLocale = "es-CO" | "en-US"

/**
 * ISO 3166-1 alpha-2 country codes soportados en Fase 1.
 *
 * Drives el shape de formularios country-aware (departamento/ciudad para CO,
 * state/zip para US). Ampliar junto con `SupportedLocale`.
 */
export type SupportedCountry = "CO" | "US"

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
  favicon_url?: string | null
  // SEO fields
  seo_title?: string | null
  seo_description?: string | null
  seo_keywords?: string | null
  // Settings & Config
  tracking_config?: OrganizationTrackingConfig | null
  settings?: OrganizationSettingsOverrides | null
  custom_domain?: string | null
  // Maintenance
  maintenance_mode?: boolean
  maintenance_message?: string | null
  maintenance_bypass_token?: string | null
  // Tax settings
  tax_enabled?: boolean
  tax_rate?: number
  prices_include_tax?: boolean
  // i18n / Localization (Fase 1)
  currency_code?: SupportedCurrency
  locale?: SupportedLocale
  country_code?: SupportedCountry
  // Copilot Merchant Loop v0 — nivel de autonomía declarativo
  copilot_autonomy_level?: CopilotAutonomyLevel
}

/**
 * Nivel de autonomía del copilot por organización. Default level_1_propose.
 * v0 ejecuta level_3 como level_2 (reservado por contrato).
 * Fuente canónica de valores: src/lib/copilot/types.ts (COPILOT_AUTONOMY_LEVELS).
 */
export type CopilotAutonomyLevel =
  | "level_1_propose"
  | "level_2_act_with_whitelist"
  | "level_3_full_autonomy"

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
  meta_access_token?: string
  meta_capi_access_token?: string
  meta_marketing_access_token?: string
  meta_ad_account_id?: string
  google_analytics_id?: string
  tiktok_pixel_id?: string
  posthog_enabled?: boolean
  [key: string]: unknown
}

export interface OrganizationBrandingSettings {
  primaryColor?: string
  [key: string]: unknown
}

/**
 * Configuración del comportamiento del operador humano vía WhatsApp.
 *
 * Aplica al flujo del webhook cuando el operador responde un chat desde su
 * WhatsApp directo (mensaje `fromMe = true`) sin usar un comando slash.
 */
export interface OrganizationWhatsAppOperatorSettings {
  /**
   * Duración (minutos) de la pausa suave automática que se aplica al chat
   * cuando el operador responde sin comando.
   *
   * Rango válido: 0-240 minutos.
   *   - `0` desactiva la pausa automática (la IA siempre responde aunque
   *     el operador haya respondido). Útil para tenants donde IA y humano
   *     deben coexistir libremente.
   *   - `30` (default) es el comportamiento clásico introducido en v1.12.5.
   *   - `240` (4 h) es el máximo permitido.
   *
   * Si la propiedad está ausente, se usa el default 30.
   */
  softPauseDurationMin?: number
  [key: string]: unknown
}

/**
 * Override manual del número WhatsApp que se muestra en el storefront público
 * (botón flotante). Tiene prioridad sobre `whatsapp_instances` y permite al
 * merchant exponer un número distinto al que usa para recibir mensajes
 * automatizados (e.g. cuando la instancia corporate está disconnected pero
 * tiene un personal connected, o cuando quiere desviar leads del storefront
 * a un asesor humano específico).
 */
export interface OrganizationStorefrontWhatsAppSettings {
  phone?: string | null
  [key: string]: unknown
}

export interface OrganizationSettingsOverrides {
  branding?: OrganizationBrandingSettings
  shipping?: {
    free_shipping_threshold?: number
    [key: string]: unknown
  }
  /** Solicitud de reseñas post-compra (opt-in del merchant). */
  reviews?: {
    request_enabled?: boolean
    request_delay_days?: number
    [key: string]: unknown
  }
  /** Horario de atención para booking de citas/servicios. */
  booking?: {
    day_start_hour?: number
    day_end_hour?: number
    skip_sundays?: boolean
    [key: string]: unknown
  }
  whatsapp?: OrganizationStorefrontWhatsAppSettings
  whatsapp_operator?: OrganizationWhatsAppOperatorSettings
  [key: string]: unknown
}
