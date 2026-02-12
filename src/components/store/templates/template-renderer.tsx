import { MinimalTemplate } from "./minimal-template"
import { CompleteTemplate } from "./complete-template"
import { SingleProductTemplate } from "./single-product-template"
import { ServicesTemplate } from "./services-template"
import { RealEstateTemplate } from "./real-estate-template"

interface TemplateRendererProps {
    template: string
    organization: any
    products: any[]
    properties?: any[]
    pages?: Array<{ id: string; slug: string; title: string }>
    primaryColor: string
    heroSettings: any
    onStartChat: (productId?: string) => void
    isSubdomain: boolean
}

export function TemplateRenderer({
    template,
    organization,
    products,
    properties = [],
    pages = [],
    primaryColor,
    heroSettings,
    onStartChat,
    isSubdomain
}: TemplateRendererProps) {
    const templateProps = {
        organization,
        products,
        pages,
        primaryColor,
        heroSettings,
        onStartChat,
        isSubdomain
    }

    switch (template) {
        case "minimal":
            return <MinimalTemplate {...templateProps} />
        case "complete":
            return <CompleteTemplate {...templateProps} />
        case "single-product":
            return <SingleProductTemplate {...templateProps} />
        case "services":
            return <ServicesTemplate {...templateProps} />
        case "real-estate":
            return <RealEstateTemplate organization={organization} properties={properties} onStartChat={onStartChat} />
        default:
            return <MinimalTemplate {...templateProps} />
    }
}
