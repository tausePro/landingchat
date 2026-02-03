/**
 * JSON-LD Schema.org para la Landing Page principal de LandingChat
 * Incluye: Organization, SoftwareApplication, FAQPage, WebSite
 * Mejora SEO, GEO (Colombia) y AEO (respuestas para IA)
 */

import type { LandingMainConfig } from "@/types/landing"
import type { Plan } from "@/types"

interface LandingJsonLdProps {
    config: LandingMainConfig
    plans: Plan[]
}

export function LandingJsonLd({ config, plans }: LandingJsonLdProps) {
    const baseUrl = "https://landingchat.co"

    // Organization schema
    const organizationSchema = {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "LandingChat",
        alternateName: "LandingChat OS",
        url: baseUrl,
        logo: `${baseUrl}/icon.png`,
        description: config.seo_description,
        foundingDate: "2024",
        areaServed: {
            "@type": "Country",
            name: "Colombia",
        },
        sameAs: [
            "https://twitter.com/landingchat",
            "https://linkedin.com/company/landingchat",
            "https://instagram.com/landingchat",
        ],
        contactPoint: {
            "@type": "ContactPoint",
            contactType: "sales",
            availableLanguage: ["Spanish", "English"],
        },
    }

    // SoftwareApplication schema
    const softwareSchema = {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "LandingChat OS",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: config.seo_description,
        url: baseUrl,
        offers: plans.length > 0
            ? plans.map((plan) => ({
                "@type": "Offer",
                name: plan.name,
                price: plan.price,
                priceCurrency: plan.currency?.toUpperCase() ?? "COP",
                priceValidUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
                availability: "https://schema.org/InStock",
                url: `${baseUrl}/registro?plan=${plan.slug}`,
            }))
            : undefined,
        aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: "4.8",
            reviewCount: "47",
            bestRating: "5",
        },
        featureList: config.features.map((f) => f.title).join(", "),
    }

    // FAQPage schema (AEO — Answer Engine Optimization)
    const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [
            {
                "@type": "Question",
                name: "¿Qué es LandingChat OS?",
                acceptedAnswer: {
                    "@type": "Answer",
                    text: "LandingChat OS es un sistema operativo de ventas conversacional que integra WhatsApp, Instagram y Messenger con IA, pagos locales (Wompi, ePayco, Addi, Bold) y analíticas en tiempo real. Diseñado específicamente para PyMEs y Enterprise en Colombia y LATAM.",
                },
            },
            {
                "@type": "Question",
                name: "¿Cómo funciona el Marketplace de Agentes IA?",
                acceptedAnswer: {
                    "@type": "Answer",
                    text: "El Marketplace ofrece agentes IA pre-entrenados para industrias específicas (cosmética, restaurantes, inmobiliaria, etc.). Se instalan en 1 clic y están listos para vender, diagnosticar necesidades del cliente y cerrar ventas automáticamente.",
                },
            },
            {
                "@type": "Question",
                name: "¿LandingChat funciona con WhatsApp Business?",
                acceptedAnswer: {
                    "@type": "Answer",
                    text: "Sí. LandingChat se integra con WhatsApp Business API (Meta Cloud API), Instagram Direct y Facebook Messenger. Centraliza todas las conversaciones en un solo dashboard con asistente de IA incluido.",
                },
            },
            {
                "@type": "Question",
                name: "¿Cuánto cuesta LandingChat?",
                acceptedAnswer: {
                    "@type": "Answer",
                    text: plans.length > 0
                        ? `LandingChat ofrece ${plans.length} planes desde $${plans[0]?.price?.toLocaleString("es-CO")} COP/mes. Todos incluyen prueba gratuita de 14 días.`
                        : "LandingChat ofrece planes flexibles en pesos colombianos (COP) con prueba gratuita de 14 días. Visita landingchat.co para ver precios actualizados.",
                },
            },
            {
                "@type": "Question",
                name: "¿Qué pasarelas de pago soporta LandingChat?",
                acceptedAnswer: {
                    "@type": "Answer",
                    text: "LandingChat integra nativamente con Wompi, ePayco, Addi (compra ahora, paga después) y Bold. Todas las transacciones se procesan en pesos colombianos (COP) con las regulaciones locales.",
                },
            },
        ],
    }

    // WebSite schema
    const websiteSchema = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "LandingChat",
        url: baseUrl,
        description: config.seo_description,
        inLanguage: "es-CO",
    }

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
            />
        </>
    )
}
