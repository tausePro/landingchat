import { createServiceClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { Metadata } from "next"
import { StoreLayoutClient } from "../store-layout-client"
import { PageTemplateRenderer } from "@/components/store/page-templates/page-template-renderer"
import { parsePageContent } from "@/lib/page-content-parser"

interface PageProps {
    params: Promise<{ slug: string; pageSlug: string }>
}

// Fetch page data
async function getPageData(orgSlug: string, pageSlug: string) {
    const supabase = createServiceClient()

    // Get organization with complete data
    const { data: org } = await supabase
        .from("organizations")
        .select("id, name, slug, logo_url, favicon_url, seo_title, seo_description, seo_keywords, storefront_config, storefront_template, primary_color, secondary_color, contact_email, settings, tracking_config, custom_domain")
        .eq("slug", orgSlug)
        .single()

    if (!org) return null

    // Get page
    const { data: page } = await supabase
        .from("store_pages")
        .select("*")
        .eq("organization_id", org.id)
        .eq("slug", pageSlug)
        .eq("is_published", true)
        .single()

    if (!page) return null

    // Get published pages for footer
    const { data: pages } = await supabase
        .from("store_pages")
        .select("id, slug, title")
        .eq("organization_id", org.id)
        .eq("is_published", true)
        .order("title", { ascending: true })

    return { org, page, pages: pages || [] }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug, pageSlug } = await params
    const data = await getPageData(slug, pageSlug)

    if (!data) {
        return {
            title: "Página no encontrada"
        }
    }

    const { org, page } = data

    return {
        title: page.seo_title || `${page.title} | ${org.name}`,
        description: page.seo_description || `${page.title} - ${org.name}`,
        openGraph: {
            title: page.seo_title || page.title,
            description: page.seo_description || "",
            images: org.logo_url ? [org.logo_url] : []
        }
    }
}

export default async function StorePageComponent({ params }: PageProps) {
    const { slug, pageSlug } = await params

    // Skip reserved routes
    const reservedRoutes = ["producto", "productos", "checkout", "order", "profile", "chat", "maintenance"]
    if (reservedRoutes.includes(pageSlug)) {
        notFound()
    }

    const data = await getPageData(slug, pageSlug)

    if (!data) {
        notFound()
    }

    const { org, page, pages } = data

    // Parse content with automatic fallback (content_jsonb -> content)
    const content = parsePageContent(page)

    // Use the same primaryColor logic as StoreLayoutClient
    const primaryColor = org.settings?.branding?.primaryColor || "#2b7cee"
    const whatsappNumber = org.settings?.storefront?.footer?.whatsappNumber

    return (
        <StoreLayoutClient
            slug={slug}
            organization={org}
            products={[]}
            pages={pages}
        >
            <PageTemplateRenderer
                content={content}
                organizationSlug={slug}
                primaryColor={primaryColor}
                whatsappNumber={whatsappNumber}
            />
        </StoreLayoutClient>
    )
}
