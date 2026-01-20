import { PageContent, isFAQContent, isLegalContent, isAboutContent, isHTMLContent } from "@/types/page-content"
import { FAQTemplate } from "./faq-template"
import { LegalTemplate } from "./legal-template"
import { AboutTemplate } from "./about-template"

interface PageTemplateRendererProps {
    content: PageContent
    organizationSlug: string
    primaryColor?: string
    whatsappNumber?: string
}

export function PageTemplateRenderer({
    content,
    organizationSlug,
    primaryColor = '#2563EB',
    whatsappNumber
}: PageTemplateRendererProps) {
    switch (content.type) {
        case 'faq':
            return <FAQTemplate content={content} organizationSlug={organizationSlug} primaryColor={primaryColor} whatsappNumber={whatsappNumber} />

        case 'legal':
            return <LegalTemplate content={content} organizationSlug={organizationSlug} primaryColor={primaryColor} />

        case 'about':
            return <AboutTemplate content={content} organizationSlug={organizationSlug} primaryColor={primaryColor} whatsappNumber={whatsappNumber} />

        case 'html':
            return <div dangerouslySetInnerHTML={{ __html: content.html }} />

        default:
            return (
                <div className="p-8 text-center">
                    <p className="text-gray-500">Tipo de contenido no soportado</p>
                </div>
            )
    }
}
