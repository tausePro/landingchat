/**
 * Industry Templates & Modules Domain Types
 *
 * Define las estructuras para:
 * - Plantillas de industria (ecommerce, inmobiliaria, etc.)
 * - Módulos del dashboard (productos, pedidos, propiedades, etc.)
 * - Configuración de menú dinámico
 */

import { z } from "zod"

// ============================================
// Enums
// ============================================

/**
 * Slugs de industrias soportadas
 */
export const IndustrySlugEnum = z.enum([
    "ecommerce",
    "real_estate",
    "other",
])
export type IndustrySlug = z.infer<typeof IndustrySlugEnum>

/**
 * Slugs de módulos disponibles
 */
export const ModuleSlugEnum = z.enum([
    // Core (siempre activos)
    "conversations",
    "customers",
    "agent",
    "settings",
    // Ecommerce
    "products",
    "orders",
    "shipping",
    "coupons",
    "payments",
    // Inmobiliaria
    "properties",
    "leads",
    "appointments",
    "documents",
])
export type ModuleSlug = z.infer<typeof ModuleSlugEnum>

// ============================================
// Schemas
// ============================================

/**
 * Plantilla de industria
 */
export const IndustryTemplateSchema = z.object({
    id: z.string().uuid(),
    slug: IndustrySlugEnum,
    name: z.string(),
    description: z.string().nullable(),
    icon: z.string().nullable(), // Lucide icon name
    default_modules: z.array(z.string()),
    agent_system_prompt: z.string().nullable(),
    sample_products: z.any().nullable(), // JSONB
    is_active: z.boolean(),
    display_order: z.number(),
    created_at: z.string(),
    updated_at: z.string(),
})
export type IndustryTemplate = z.infer<typeof IndustryTemplateSchema>

/**
 * Definición de un módulo
 */
export const ModuleDefinitionSchema = z.object({
    id: z.string().uuid(),
    slug: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    icon: z.string().nullable(), // Lucide icon name
    menu_path: z.string().nullable(),
    menu_order: z.number(),
    is_core: z.boolean(),
    created_at: z.string(),
})
export type ModuleDefinition = z.infer<typeof ModuleDefinitionSchema>

/**
 * Item del menú del dashboard (para renderizado)
 */
export const DashboardMenuItemSchema = z.object({
    slug: z.string(),
    name: z.string(),
    icon: z.string(),
    path: z.string(),
    order: z.number(),
    isCore: z.boolean(),
})
export type DashboardMenuItem = z.infer<typeof DashboardMenuItemSchema>

// ============================================
// Input Schemas
// ============================================

/**
 * Input para seleccionar industria en onboarding
 */
export const SelectIndustryInputSchema = z.object({
    industry_slug: IndustrySlugEnum,
})
export type SelectIndustryInput = z.infer<typeof SelectIndustryInputSchema>

/**
 * Input para actualizar módulos activos
 */
export const UpdateEnabledModulesInputSchema = z.object({
    enabled_modules: z.array(z.string()),
})
export type UpdateEnabledModulesInput = z.infer<typeof UpdateEnabledModulesInputSchema>

// ============================================
// Helpers
// ============================================

/**
 * Módulos core que siempre están activos
 */
export const CORE_MODULES: ModuleSlug[] = [
    "conversations",
    "customers",
    "agent",
    "settings",
]

/**
 * Módulos por industria
 */
export const INDUSTRY_MODULES: Record<IndustrySlug, ModuleSlug[]> = {
    ecommerce: ["products", "orders", "shipping", "coupons", "payments"],
    real_estate: ["properties", "leads", "appointments", "documents"],
    other: ["products", "customers"],
}

/**
 * Íconos por módulo (Lucide icon names)
 */
export const MODULE_ICONS: Record<string, string> = {
    conversations: "MessageSquare",
    customers: "Users",
    agent: "Bot",
    settings: "Settings",
    products: "Package",
    orders: "ShoppingCart",
    shipping: "Truck",
    coupons: "Ticket",
    payments: "CreditCard",
    properties: "Building2",
    leads: "UserPlus",
    appointments: "Calendar",
    documents: "FileText",
}

/**
 * Paths del dashboard por módulo
 */
export const MODULE_PATHS: Record<string, string> = {
    conversations: "/dashboard/inbox",
    customers: "/dashboard/customers",
    agent: "/dashboard/agent",
    settings: "/dashboard/settings",
    products: "/dashboard/products",
    orders: "/dashboard/orders",
    shipping: "/dashboard/marketing/shipping",
    coupons: "/dashboard/marketing/coupons",
    payments: "/dashboard/settings/payments",
    properties: "/dashboard/properties",
    leads: "/dashboard/leads",
    appointments: "/dashboard/appointments",
    documents: "/dashboard/documents",
}

/**
 * Nombres legibles por módulo
 */
export const MODULE_NAMES: Record<string, string> = {
    conversations: "Conversaciones",
    customers: "Clientes",
    agent: "Agente IA",
    settings: "Configuración",
    products: "Productos",
    orders: "Pedidos",
    shipping: "Envíos",
    coupons: "Cupones",
    payments: "Pagos",
    properties: "Propiedades",
    leads: "Leads",
    appointments: "Citas",
    documents: "Documentos",
}

/**
 * Construye el menú del dashboard según los módulos activos
 */
export function buildDashboardMenu(
    enabledModules: string[],
    moduleDefinitions?: ModuleDefinition[]
): DashboardMenuItem[] {
    // Combinar core + enabled
    const allModules = [...new Set([...CORE_MODULES, ...enabledModules])]

    // Si tenemos definiciones de BD, usarlas
    if (moduleDefinitions && moduleDefinitions.length > 0) {
        return moduleDefinitions
            .filter(m => allModules.includes(m.slug as ModuleSlug))
            .map(m => ({
                slug: m.slug,
                name: m.name,
                icon: m.icon || MODULE_ICONS[m.slug] || "Circle",
                path: m.menu_path || MODULE_PATHS[m.slug] || `/dashboard/${m.slug}`,
                order: m.menu_order,
                isCore: m.is_core,
            }))
            .sort((a, b) => a.order - b.order)
    }

    // Fallback a constantes
    return allModules
        .map((slug, idx) => ({
            slug,
            name: MODULE_NAMES[slug] || slug,
            icon: MODULE_ICONS[slug] || "Circle",
            path: MODULE_PATHS[slug] || `/dashboard/${slug}`,
            order: CORE_MODULES.includes(slug as ModuleSlug) ? idx : idx + 10,
            isCore: CORE_MODULES.includes(slug as ModuleSlug),
        }))
        .sort((a, b) => a.order - b.order)
}

/**
 * Obtiene los módulos por defecto para una industria
 */
export function getDefaultModulesForIndustry(industrySlug: IndustrySlug): string[] {
    return [...CORE_MODULES, ...INDUSTRY_MODULES[industrySlug]]
}
