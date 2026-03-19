import type { ComponentProps } from "react"
import { MinimalTemplate } from "./minimal-template"
import { CompleteTemplate } from "./complete-template"
import { CompleteTemplateV2 } from "./CompleteTemplateV2"
import { SingleProductTemplate } from "./single-product-template"
import { ServicesTemplate } from "./services-template"
import { RealEstateTemplate } from "./real-estate-template"
import { RealEstateTemplateV2 } from "./RealEstateTemplateV2"
import { getSafeStorefrontTemplate } from "@/lib/storefront-templates"
import { normalizeStorefrontTemplateVersion, type StorefrontHeroSliderProduct, type StorefrontViewModel } from "@/types/storefront"

type CompleteTemplateProps = ComponentProps<typeof CompleteTemplate>
type RealEstateTemplateProps = ComponentProps<typeof RealEstateTemplate>

interface TemplateRendererProps {
    template: string
    organization: CompleteTemplateProps["organization"]
    products: CompleteTemplateProps["products"]
    heroSliderProducts?: StorefrontHeroSliderProduct[]
    storefrontViewModel?: StorefrontViewModel
    properties?: RealEstateTemplateProps["properties"]
    badges?: CompleteTemplateProps["badges"]
    pages?: Array<{ id: string; slug: string; title: string }>
    primaryColor: string
    heroSettings: CompleteTemplateProps["heroSettings"]
    onStartChat: (productId?: string) => void
    isSubdomain: boolean
}

export function TemplateRenderer({
    template,
    organization,
    products,
    heroSliderProducts = [],
    storefrontViewModel,
    properties = [],
    badges = [],
    pages = [],
    primaryColor,
    heroSettings,
    onStartChat,
    isSubdomain
}: TemplateRendererProps) {
    const safeTemplate = getSafeStorefrontTemplate(template, organization)
    const templateVersion = storefrontViewModel?.tenant.templateVersion
        ?? normalizeStorefrontTemplateVersion(organization?.settings?.storefront?.templateVersion)

    const templateProps = {
        organization,
        products,
        heroSliderProducts,
        badges,
        pages,
        primaryColor,
        heroSettings,
        onStartChat,
        isSubdomain
    }

    switch (safeTemplate) {
        case "minimal":
            return <MinimalTemplate {...templateProps} />
        case "complete":
            return templateVersion === "v2"
                ? <CompleteTemplateV2 {...templateProps} storefrontViewModel={storefrontViewModel} />
                : <CompleteTemplate {...templateProps} />
        case "single-product":
            return <SingleProductTemplate {...templateProps} />
        case "services":
            return <ServicesTemplate {...templateProps} />
        case "real-estate":
            return templateVersion === "v2"
                ? <RealEstateTemplateV2 organization={organization} properties={properties} onStartChat={onStartChat} storefrontViewModel={storefrontViewModel} />
                : <RealEstateTemplate organization={organization} properties={properties} onStartChat={onStartChat} />
        default:
            return <MinimalTemplate {...templateProps} />
    }
}
