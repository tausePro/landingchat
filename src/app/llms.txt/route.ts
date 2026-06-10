import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { stripHtml } from "@/lib/utils/stripHtml"
import {
    PLATFORM_BASE_URL,
    buildOrganizationBaseUrl,
    buildProductPublicUrl,
    listDiscoveryProducts,
    resolveBaseUrlFromHost,
    resolveDiscoveryOrganization,
} from "@/lib/seo/site-discovery"
import type { DiscoveryOrganization, DiscoveryProduct } from "@/lib/seo/site-discovery"

export const dynamic = "force-dynamic"

function cleanMarkdownText(value: string | null | undefined): string | null {
    const clean = stripHtml(value).replace(/\s+/g, " ").trim()
    return clean.length > 0 ? clean : null
}

function truncateText(value: string, maxLength: number): string {
    if (value.length <= maxLength) return value
    return `${value.slice(0, maxLength - 1).trim()}…`
}

function buildTextResponse(content: string) {
    return new NextResponse(content, {
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
        },
    })
}

function buildPlatformLlmsTxt(baseUrl: string) {
    const canonicalBaseUrl = baseUrl.includes("localhost") ? baseUrl : PLATFORM_BASE_URL

    return [
        "# LandingChat",
        "",
        "> Plataforma de comercio conversacional para LATAM: storefronts, chat AI, WhatsApp, pagos locales y analítica para negocios que venden con agentes de IA.",
        "",
        "LandingChat no es solo un ecommerce. Su capa pública combina tiendas, catálogo, PDPs, chat de ventas y checkout; las acciones privadas viven detrás de autenticación y no deben inferirse desde discovery público.",
        "",
        "## Main",
        `- [Home](${canonicalBaseUrl}/): Página principal de LandingChat`,
        `- [Founding](${canonicalBaseUrl}/founding): Oferta founding pública si está activa`,
        `- [Registro](${canonicalBaseUrl}/registro): Inicio de alta para nuevos negocios`,
        `- [Privacidad](${canonicalBaseUrl}/privacidad): Política de privacidad`,
        `- [Términos](${canonicalBaseUrl}/terminos): Términos del servicio`,
        "",
        "## Discovery",
        `- [Sitemap](${canonicalBaseUrl}/sitemap.xml): URLs públicas indexables`,
        `- [Robots](${canonicalBaseUrl}/robots.txt): Política de acceso para crawlers`,
    ].join("\n")
}

function buildStoreLlmsTxt(organization: DiscoveryOrganization, products: DiscoveryProduct[]) {
    const baseUrl = buildOrganizationBaseUrl(organization)
    const summary = cleanMarkdownText(organization.seo_description)
        ?? `${organization.name} es una tienda pública alojada en LandingChat con catálogo, chat de ventas y checkout conversacional.`
    const productLines = products
        .map((product) => {
            const description = cleanMarkdownText(product.description)
            const suffix = description ? `: ${truncateText(description, 140)}` : ""
            return `- [${product.name}](${buildProductPublicUrl(baseUrl, product)})${suffix}`
        })

    return [
        `# ${organization.name}`,
        "",
        `> ${summary}`,
        "",
        "Este sitio es un storefront público de LandingChat. La información de catálogo debe interpretarse desde las páginas públicas, JSON-LD, sitemap y datos visibles; carrito, checkout, órdenes, datos de cliente y WhatsApp requieren flujos explícitos dentro de la tienda.",
        "",
        "## Main",
        `- [Storefront](${baseUrl}/): Página principal de la tienda`,
        `- [Catálogo](${baseUrl}/productos): Listado público de productos`,
        `- [Chat de ventas](${baseUrl}/chat): Chat público de ventas con agente AI`,
        "",
        ...(productLines.length > 0 ? ["## Products", ...productLines, ""] : []),
        "## Discovery",
        `- [Sitemap](${baseUrl}/sitemap.xml): URLs públicas indexables de la tienda`,
        `- [Robots](${baseUrl}/robots.txt): Política de acceso para crawlers`,
    ].join("\n")
}

export async function GET(request: NextRequest) {
    const host = request.headers.get("host")
    const slug = request.nextUrl.searchParams.get("store")
    const supabase = createServiceClient()
    const organization = await resolveDiscoveryOrganization(supabase, { host, slug })

    if (!organization) {
        return buildTextResponse(buildPlatformLlmsTxt(resolveBaseUrlFromHost(host)))
    }

    // Paridad con el sitemap (500): los AI engines deben ver el catálogo
    // completo, no una muestra (antes 25 → catálogos truncados en llms.txt)
    const products = await listDiscoveryProducts(supabase, organization.id, 500)
    return buildTextResponse(buildStoreLlmsTxt(organization, products))
}
