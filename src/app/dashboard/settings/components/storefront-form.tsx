"use client"

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
import { ServicesTemplateEditor } from "./services-template-editor"
import { SingleProductTemplateEditor } from "./single-product-template-editor"
import { TestimonialsEditor } from "./testimonials-editor"
import { VideoSectionEditor } from "./video-section-editor"
import { ProductDetailCROEditor } from "./product-detail-cro-editor"
import { getSafeStorefrontTemplate } from "@/lib/storefront-templates"

interface StorefrontFormSettings {
    storefront?: {
        template?: string
        [key: string]: unknown
    }
    [key: string]: unknown
}

interface StorefrontFormProps {
    organization: {
        id: string
        name: string
        slug: string
        industry?: string | null
        settings?: StorefrontFormSettings | null
    }
}

export function StorefrontForm({ organization }: StorefrontFormProps) {
    const selectedTemplate = getSafeStorefrontTemplate(organization.settings?.storefront?.template, organization)
    const organizationWithSettings = {
        ...organization,
        settings: organization.settings ?? {},
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Configuration (2/3) */}
            <div className="lg:col-span-2 space-y-8">
                <TemplateSelector organization={organizationWithSettings} />

                <HeaderEditor organization={organizationWithSettings} />

                <ProductDetailCROEditor organization={organizationWithSettings} />

                <HeroEditor organization={organizationWithSettings} />

                {/* Dynamic Template Configuration */}
                {selectedTemplate === "complete" && (
                    <>
                        <CompleteTemplateEditor organization={organization} />
                        <VideoSectionEditor organization={organizationWithSettings} />
                        <ProductFeaturesEditor organization={organizationWithSettings} />
                        <TestimonialsEditor organization={organizationWithSettings} />
                        <ProductSectionEditor organization={organizationWithSettings} />
                    </>
                )}
                {selectedTemplate === "services" && (
                    <>
                        <ServicesTemplateEditor organization={organizationWithSettings} />
                        <ServicesSectionEditor organization={organizationWithSettings} />
                    </>
                )}
                {selectedTemplate === "single-product" && (
                    <>
                        <SingleProductTemplateEditor organization={organizationWithSettings} />
                        <ProductFeaturesEditor organization={organizationWithSettings} />
                    </>
                )}

                <TypographySelector organization={organizationWithSettings} />

                <FooterEditor organization={organizationWithSettings} />
            </div>

            {/* Right Column: Live Preview (1/3) */}
            <div className="lg:col-span-1">
                <LivePreview slug={organization.slug} />
            </div>
        </div>
    )
}
