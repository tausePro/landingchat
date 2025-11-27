"use client"

import { HeroEditor } from "./hero-editor"
import { TypographySelector } from "./typography-selector"
import { TemplateSelector } from "./template-selector"
import { LivePreview } from "./live-preview"

interface StorefrontFormProps {
    organization: {
        id: string
        name: string
        slug: string
        settings: any
    }
}

export function StorefrontForm({ organization }: StorefrontFormProps) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Configuration (2/3) */}
            <div className="lg:col-span-2 space-y-8">
                <TemplateSelector organization={organization} />
                <HeroEditor organization={organization} />
                <TypographySelector organization={organization} />
            </div>

            {/* Right Column: Live Preview (1/3) */}
            <div className="lg:col-span-1">
                <LivePreview slug={organization.slug} />
            </div>
        </div>
    )
}
