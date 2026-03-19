"use client"

import Link from "next/link"
import { HeroEditor } from "./hero-editor"
import { TypographySelector } from "./typography-selector"
import { TemplateSelector } from "./template-selector"
import { LivePreview } from "./live-preview"
import { HeaderEditor } from "./header-editor"
import { FooterEditor } from "./footer-editor"
import { ProductFeaturesEditor } from "./product-features-editor"
import { ProductSectionEditor } from "./product-section-editor"
import { ServicesSectionEditor } from "./services-section-editor"
import { CompleteTemplateEditor } from "./complete-template-editor"
import { HeroSliderEditor } from "./hero-slider-editor"
import { ServicesTemplateEditor } from "./services-template-editor"
import { SingleProductTemplateEditor } from "./single-product-template-editor"
import { TestimonialsEditor } from "./testimonials-editor"
import { getSafeStorefrontTemplate } from "@/lib/storefront-templates"
import type { OrganizationSettingsOverrides } from "@/types/organization"
import { normalizeStorefrontTemplateVersion } from "@/types/storefront"

interface StorefrontFormProps {
    organization: {
        id: string
        name: string
        slug: string
        industry?: string | null
        custom_domain?: string | null
        maintenance_mode?: boolean
        settings: OrganizationSettingsOverrides | null
    }
}

export function StorefrontForm({ organization }: StorefrontFormProps) {
    const selectedTemplate = getSafeStorefrontTemplate(organization.settings?.storefront?.template, organization)
    const selectedTemplateVersion = normalizeStorefrontTemplateVersion(organization.settings?.storefront?.templateVersion)
    const templateLabels: Record<string, string> = {
        minimal: "Base",
        complete: "Catálogo completo",
        services: "Servicios",
        "single-product": "Producto único",
    }
    const currentTemplateLabel = templateLabels[selectedTemplate] ?? "Base"
    const currentTemplateVersionLabel = selectedTemplateVersion === "v2" ? "V2 preview" : "V1 estable"
    const publicStoreUrl = organization.custom_domain || `${organization.slug}.landingchat.co`
    const storefrontStatus = organization.maintenance_mode ? "Mantenimiento" : "Activa"

    return (
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
            {/* Left Column: Configuration (2/3) */}
            <div className="space-y-6">
                <div className="rounded-2xl border border-border-light bg-card-light p-6 shadow-sm dark:border-border-dark dark:bg-card-dark">
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-lg font-semibold text-text-light-primary dark:text-text-dark-primary">Diseño</h3>
                            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                                Template activo: {currentTemplateLabel}
                            </span>
                            <span className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-semibold text-secondary-foreground">
                                Motor visual: {currentTemplateVersionLabel}
                            </span>
                        </div>
                        <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary">
                            Ajusta la experiencia visual de tu tienda: template, header, hero, secciones, tipografía y footer.
                        </p>
                    </div>

                    <div className="mt-6 space-y-8">
                        <TemplateSelector key={`${organization.id}:${selectedTemplate}:${selectedTemplateVersion}`} organization={organization} />

                        <HeaderEditor organization={organization} />

                        <HeroEditor organization={organization} />

                        {/* Dynamic Template Configuration */}
                        {selectedTemplate === "complete" && (
                            <>
                                <HeroSliderEditor organization={organization} />
                                <CompleteTemplateEditor organization={organization} />
                                <ProductFeaturesEditor organization={organization} />
                                <TestimonialsEditor organization={organization} />
                                <ProductSectionEditor organization={organization} />
                            </>
                        )}
                        {selectedTemplate === "services" && (
                            <>
                                <ServicesTemplateEditor organization={organization} />
                                <ServicesSectionEditor organization={organization} />
                            </>
                        )}
                        {selectedTemplate === "single-product" && (
                            <>
                                <SingleProductTemplateEditor organization={organization} />
                                <ProductFeaturesEditor organization={organization} />
                            </>
                        )}

                        <TypographySelector organization={organization} />

                        <FooterEditor organization={organization} />
                    </div>
                </div>
            </div>

            {/* Right Column: Live Preview (1/3) */}
            <div className="space-y-6">
                <div className="rounded-2xl border border-border-light bg-card-light p-5 shadow-sm dark:border-border-dark dark:bg-card-dark">
                    <h3 className="text-lg font-semibold text-text-light-primary dark:text-text-dark-primary">Preview</h3>
                    <p className="mt-2 text-sm text-text-light-secondary dark:text-text-dark-secondary">
                        Revisa cómo se ve tu storefront en desktop o móvil y valida el template junto con el rail visual activo.
                    </p>
                </div>

                <LivePreview slug={organization.slug} previewToken={`${selectedTemplate}:${selectedTemplateVersion}`} />

                <div className="rounded-2xl border border-border-light bg-card-light p-5 shadow-sm dark:border-border-dark dark:bg-card-dark">
                    <h3 className="text-lg font-semibold text-text-light-primary dark:text-text-dark-primary">Configuración general</h3>
                    <p className="mt-2 text-sm text-text-light-secondary dark:text-text-dark-secondary">
                        Dominio, mantenimiento, impuestos, pagos y canales siguen agrupados en la configuración general de la organización.
                    </p>

                    <div className="mt-5 space-y-3">
                        <div className="rounded-xl bg-background-light px-4 py-3 dark:bg-background-dark">
                            <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-light-secondary dark:text-text-dark-secondary">
                                URL pública
                            </p>
                            <p className="mt-1 text-sm font-medium text-text-light-primary dark:text-text-dark-primary">
                                {publicStoreUrl}
                            </p>
                        </div>

                        <div className="rounded-xl bg-background-light px-4 py-3 dark:bg-background-dark">
                            <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-light-secondary dark:text-text-dark-secondary">
                                Estado del sitio
                            </p>
                            <p className="mt-1 text-sm font-medium text-text-light-primary dark:text-text-dark-primary">
                                {storefrontStatus}
                            </p>
                        </div>
                    </div>

                    <Link
                        href="/dashboard/settings"
                        className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                        Abrir configuración general
                    </Link>
                </div>
            </div>
        </div>
    )
}
