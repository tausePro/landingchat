/**
 * JSON-LD Schema.org para Organization/LocalBusiness
 * Mejora SEO y permite que motores de búsqueda e IA entiendan la tienda
 */

interface OrganizationJsonLdProps {
    organization: {
        name: string
        slug: string
        logo_url?: string | null
        custom_domain?: string | null
        settings?: {
            contact?: {
                phone?: string
                email?: string
                address?: string
            }
            social?: {
                instagram?: string
                facebook?: string
                twitter?: string
            }
        }
        seo_description?: string | null
    }
    url: string
}

export function OrganizationJsonLd({ organization, url }: OrganizationJsonLdProps) {
    const contact = organization.settings?.contact
    const social = organization.settings?.social

    const sameAs: string[] = []
    if (social?.instagram) sameAs.push(`https://instagram.com/${social.instagram.replace('@', '')}`)
    if (social?.facebook) sameAs.push(social.facebook.startsWith('http') ? social.facebook : `https://facebook.com/${social.facebook}`)
    if (social?.twitter) sameAs.push(`https://twitter.com/${social.twitter.replace('@', '')}`)

    const organizationSchema = {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: organization.name,
        url: url,
        ...(organization.logo_url && { logo: organization.logo_url }),
        ...(organization.seo_description && { description: organization.seo_description }),
        ...(contact?.email && { email: contact.email }),
        ...(contact?.phone && { telephone: contact.phone }),
        ...(contact?.address && {
            address: {
                "@type": "PostalAddress",
                streetAddress: contact.address
            }
        }),
        ...(sameAs.length > 0 && { sameAs })
    }

    // WebSite schema para búsqueda interna
    const websiteSchema = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: organization.name,
        url: url,
        potentialAction: {
            "@type": "SearchAction",
            target: {
                "@type": "EntryPoint",
                urlTemplate: `${url}/productos?q={search_term_string}`
            },
            "query-input": "required name=search_term_string"
        }
    }

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
            />
        </>
    )
}
