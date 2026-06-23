import { buildDesignSystem, designSystemToOrgSettings } from "@/lib/design/design-system"

/**
 * Updates de organización al importar el catálogo en onboarding.
 *
 * Genera el contrato de marca (designSystem) desde lo que el scraping extrajo
 * (color) + el rubro, y lo mapea a la config concreta que las plantillas YA
 * consumen: color (primary_color + settings.branding.primaryColor), plantilla
 * (premium por default) y tipografía. Suma la moneda detectada. Merge seguro
 * (no pisa otras llaves de settings).
 */

const SUPPORTED_CURRENCIES = ["COP", "USD"]

export interface ImportedBrand {
    primaryColor?: string | null
    currency?: string | null
}

export interface OrgBrandCurrent {
    settings?: Record<string, unknown> | null
    industry?: string | null
}

export function buildOnboardingOrgUpdates(brand: ImportedBrand, current: OrgBrandCurrent): Record<string, unknown> {
    const ds = buildDesignSystem({ primaryColor: brand.primaryColor, industry: current.industry })
    const mapped = designSystemToOrgSettings(ds, current.settings)

    const updates: Record<string, unknown> = {
        primary_color: mapped.primary_color,
        settings: mapped.settings,
    }
    if (mapped.secondary_color) {
        updates.secondary_color = mapped.secondary_color
    }
    if (typeof brand.currency === "string" && SUPPORTED_CURRENCIES.includes(brand.currency)) {
        updates.currency_code = brand.currency
    }
    return updates
}
