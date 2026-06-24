import { z } from "zod"
import {
    STOREFRONT_TEMPLATE_IDS,
    type StorefrontTemplateId,
    isStorefrontTemplateAllowed,
} from "@/lib/storefront-templates"

/**
 * Contrato de marca por tenant ("DESIGN.md"). Representación estructurada y
 * validada de la intención de diseño del storefront que:
 *   1. el onboarding rellena desde la marca extraída (scraping) + 1-2 elecciones,
 *   2. se mapea a la config concreta que las plantillas YA consumen
 *      (settings.branding.primaryColor + settings.storefront.{template,typography}).
 *
 * NO introduce un sistema de render paralelo: es el nivel alto que GENERA la
 * config existente. Por eso los enums DEBEN coincidir con los selectores reales
 * del dashboard (typography-selector, template-selector).
 */

/** Dirección visual de alto nivel; informa tipografía/colores por defecto. */
export const DESIGN_VIBES = ["editorial", "minimal", "warm", "tech", "bold"] as const
export type DesignVibe = (typeof DESIGN_VIBES)[number]

/** Fuentes — DEBEN coincidir con FONT_OPTIONS de typography-selector.tsx. */
export const DESIGN_FONTS = ["Inter", "Poppins", "Roboto", "Montserrat", "Playfair Display", "Cinzel"] as const
export type DesignFont = (typeof DESIGN_FONTS)[number]

/** Presets de color de texto — DEBEN coincidir con TEXT_COLOR_OPTIONS. */
export const DESIGN_TEXT_COLORS = ["default", "warm", "cool", "elegant", "modern", "soft"] as const
export type DesignTextColor = (typeof DESIGN_TEXT_COLORS)[number]

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color hex inválido (#rrggbb)")

export const designSystemSchema = z.object({
    palette: z.object({
        primary: hexColorSchema,
        secondary: hexColorSchema.optional(),
    }),
    typography: z.object({
        fontFamily: z.enum(DESIGN_FONTS),
        textColor: z.enum(DESIGN_TEXT_COLORS),
    }),
    vibe: z.enum(DESIGN_VIBES),
    template: z.enum(STOREFRONT_TEMPLATE_IDS),
})

export type DesignSystem = z.infer<typeof designSystemSchema>

/** Tipografía por vibe (determinística). */
const VIBE_TYPOGRAPHY: Record<DesignVibe, { fontFamily: DesignFont; textColor: DesignTextColor }> = {
    editorial: { fontFamily: "Playfair Display", textColor: "elegant" },
    minimal: { fontFamily: "Inter", textColor: "modern" },
    warm: { fontFamily: "Poppins", textColor: "warm" },
    tech: { fontFamily: "Roboto", textColor: "cool" },
    bold: { fontFamily: "Montserrat", textColor: "default" },
}

const DEFAULT_VIBE: DesignVibe = "minimal"
/** Fallback de color de marca cuando el scraping no detectó uno (slate-900). */
const DEFAULT_PRIMARY = "#0F172A"
/** Default del storefront generado: la plantilla premium (visión del producto). */
const DEFAULT_TEMPLATE: StorefrontTemplateId = "premium"

function isHex(value: string | null | undefined): value is string {
    return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)
}

function pickTemplate(
    template: StorefrontTemplateId | undefined,
    industry: string | null | undefined,
): StorefrontTemplateId {
    // Inmobiliaria fuerza su plantilla; las demás no la pueden usar.
    if (industry === "real_estate") return "real-estate"
    if (template && isStorefrontTemplateAllowed(template, { industry })) return template
    return DEFAULT_TEMPLATE
}

export interface DesignSystemInput {
    primaryColor?: string | null
    secondaryColor?: string | null
    vibe?: DesignVibe
    template?: StorefrontTemplateId
    industry?: string | null
}

/**
 * Genera el contrato de marca desde lo extraído por el scraping + elecciones
 * opcionales del merchant. Determinístico y seguro (color hex válido o fallback).
 */
export function buildDesignSystem(input: DesignSystemInput = {}): DesignSystem {
    const vibe = input.vibe ?? DEFAULT_VIBE
    const palette: DesignSystem["palette"] = {
        primary: isHex(input.primaryColor) ? input.primaryColor : DEFAULT_PRIMARY,
    }
    if (isHex(input.secondaryColor)) {
        palette.secondary = input.secondaryColor
    }
    return {
        palette,
        typography: { ...VIBE_TYPOGRAPHY[vibe] },
        vibe,
        template: pickTemplate(input.template, input.industry),
    }
}

export interface OrgSettingsFromDesign {
    primary_color: string
    secondary_color?: string
    settings: Record<string, unknown>
}

/**
 * Mapea el contrato a la config concreta que las plantillas consumen, haciendo
 * merge con la config actual (sin pisar otras llaves de settings).
 */
export function designSystemToOrgSettings(
    ds: DesignSystem,
    currentSettings?: Record<string, unknown> | null,
): OrgSettingsFromDesign {
    const settings = (currentSettings ?? {}) as Record<string, unknown>
    const branding = (settings.branding ?? {}) as Record<string, unknown>
    const storefront = (settings.storefront ?? {}) as Record<string, unknown>

    const result: OrgSettingsFromDesign = {
        primary_color: ds.palette.primary,
        settings: {
            ...settings,
            branding: { ...branding, primaryColor: ds.palette.primary },
            storefront: {
                ...storefront,
                template: ds.template,
                typography: { fontFamily: ds.typography.fontFamily, textColor: ds.typography.textColor },
            },
        },
    }
    if (ds.palette.secondary) {
        result.secondary_color = ds.palette.secondary
    }
    return result
}
