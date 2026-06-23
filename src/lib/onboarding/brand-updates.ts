/**
 * Construye el update de marca para la organización a partir de lo que el
 * scraping del onboarding mágico extrajo (color + moneda). Puro y testeable
 * (vive fuera de "use server" para poder importarse en tests).
 *
 * Solo aplica un color hex válido (con merge en settings.branding para no pisar
 * otras llaves) y una moneda soportada; si no hay nada válido devuelve null.
 */

const SUPPORTED_CURRENCIES = ["COP", "USD"]

export interface ImportedBrand {
    primaryColor?: string | null
    currency?: string | null
}

export interface OrgBrandCurrent {
    primary_color?: string | null
    settings?: Record<string, unknown> | null
}

export function buildBrandUpdates(brand: ImportedBrand, current: OrgBrandCurrent): Record<string, unknown> | null {
    const updates: Record<string, unknown> = {}

    const hex = typeof brand.primaryColor === "string" && /^#[0-9a-fA-F]{6}$/.test(brand.primaryColor)
        ? brand.primaryColor
        : null
    if (hex) {
        updates.primary_color = hex
        const settings = (current.settings ?? {}) as Record<string, unknown>
        const branding = (settings.branding ?? {}) as Record<string, unknown>
        updates.settings = { ...settings, branding: { ...branding, primaryColor: hex } }
    }

    if (typeof brand.currency === "string" && SUPPORTED_CURRENCIES.includes(brand.currency)) {
        updates.currency_code = brand.currency
    }

    return Object.keys(updates).length > 0 ? updates : null
}
