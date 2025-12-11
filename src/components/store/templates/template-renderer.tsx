import { MinimalTemplate } from "./minimal-template"
import { CompleteTemplate } from "./complete-template"
import { SingleProductTemplate } from "./single-product-template"
import { ServicesTemplate } from "./services-template"

interface TemplateRendererProps {
    template: string
    organization: any
    products: any[]
    primaryColor: string
    heroSettings: any
    onStartChat: (productId?: string) => void
    isSubdomain: boolean
}

export function TemplateRenderer({
    template,
    organization,
    products,
    primaryColor,
    heroSettings,
    onStartChat,
    isSubdomain
}: TemplateRendererProps) {
    const templateProps = {
        organization,
        products,
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
        default:
            return <MinimalTemplate {...templateProps} />
    }
}
