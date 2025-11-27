"use client"

import { HeroEditor } from "./hero-editor"
import { TypographySelector } from "./typography-selector"
import { TemplateSelector } from "./template-selector"
import { LivePreview } from "./live-preview"
import { CompleteTemplateEditor } from "./complete-template-editor"
import { ServicesTemplateEditor } from "./services-template-editor"
import { SingleProductTemplateEditor } from "./single-product-template-editor"

interface StorefrontFormProps {
    organization: {
        id: string
        name: string
        slug: string
        settings: any
    }
}

export function StorefrontForm({ organization }: StorefrontFormProps) {
    const selectedTemplate = organization.settings?.storefront?.template || "minimal"

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Configuration (2/3) */}
            <div className="lg:col-span-2 space-y-8">
                <TemplateSelector organization={organization} />

                <HeroEditor organization={organization} />

                {/* Dynamic Template Configuration */}
                {selectedTemplate === "complete" && (
                    <CompleteTemplateEditor organization={organization} />
                )}
                {selectedTemplate === "services" && (
                    <ServicesTemplateEditor organization={organization} />
                )}
                {selectedTemplate === "single-product" && (
                    <SingleProductTemplateEditor organization={organization} />
                )}

                <TypographySelector organization={organization} />
            </div>

            {/* Right Column: Live Preview (1/3) */}
            <div className="lg:col-span-1">
                <LivePreview slug={organization.slug} />
            </div>
        </div>
    )
}
