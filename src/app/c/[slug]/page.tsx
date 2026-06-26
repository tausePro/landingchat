import { headers } from "next/headers"
import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import type { Metadata } from "next"
import { Sparkles, Truck, Tag, MessageCircle } from "lucide-react"
import { getStoreProducts } from "@/app/chat/[slug]/actions"
import { getStoreLink, isSubdomain } from "@/lib/utils/store-urls"
import { getTenantLocale } from "@/lib/i18n/tenant-locale"
import { formatCurrency } from "@/lib/utils"

/**
 * ChatLink (Visual-First) — landing de bio conversacional para IG/TikTok.
 *
 * Spec: .kiro/specs/chatlink/. Reusa el catálogo + branding existentes y los
 * quick-reply chips (Smart Triggers) que abren el chat con contexto vía el flujo
 * `?action=chat` (gate post-intención). Es host-aware: funciona en
 * `landingchat.co/c/{slug}` (tier compartido) y, vía proxy, en
 * `{custom_domain}/insta` (premium white-label).
 */

interface OrgBrandingSettings {
    branding?: { primaryColor?: string | null }
}

async function loadChatLink(slug: string) {
    const { products, organization, agent } = await getStoreProducts(slug)
    return { products, organization, agent }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params
    const { organization } = await loadChatLink(slug)
    if (!organization) return { title: "ChatLink" }
    const name = (organization.name as string) || "Tienda"
    const logo = (organization.logo_url as string) || undefined
    const description = `Habla con ${name} y encuentra lo que buscas.`
    return {
        title: name,
        description,
        openGraph: {
            title: name,
            description,
            images: logo ? [{ url: logo }] : undefined,
        },
    }
}

export default async function ChatLinkPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const { products, organization, agent } = await loadChatLink(slug)
    if (!organization) notFound()

    const h = await headers()
    const host = h.get("host") || ""
    const isSub = isSubdomain(host)

    const settings = (organization.settings ?? {}) as OrgBrandingSettings
    const primary = settings.branding?.primaryColor || "#0f172a"
    const orgName = (organization.name as string) || "Tienda"
    const logo = (organization.logo_url as string) || null
    const agentName = (agent?.name as string) || null
    const tenantLocale = getTenantLocale(organization)

    const greeting = agentName
        ? `Hola, soy ${agentName} de ${orgName}. ¿En qué te ayudo?`
        : `Bienvenido a ${orgName}. ¿En qué te ayudo?`

    // Smart Triggers → abren el chat con contexto (flujo ?action=chat existente).
    const chatHref = (context: string) =>
        getStoreLink(
            `/?action=chat&context=${encodeURIComponent(context)}&utm_medium=chatlink`,
            isSub,
            slug,
        )

    const triggers = [
        { Icon: Sparkles, label: "¿Qué me recomiendas?", context: "¿Qué me recomiendas?" },
        { Icon: Truck, label: "Envíos y pagos", context: "¿Cómo son los envíos y las formas de pago?" },
        { Icon: Tag, label: "¿Tienen ofertas?", context: "¿Tienen ofertas o promociones?" },
    ]

    const bento = products.slice(0, 6)
    const fmt = (n: number) => formatCurrency(n, { locale: tenantLocale.locale, currency: tenantLocale.currency })

    return (
        <main className="min-h-screen bg-stone-50">
            <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-8">
                {/* Marca + saludo */}
                <header className="flex flex-col items-center text-center">
                    {logo ? (
                        <Image
                            src={logo}
                            alt={orgName}
                            width={64}
                            height={64}
                            className="h-16 w-16 rounded-2xl object-cover ring-1 ring-slate-200"
                        />
                    ) : (
                        <span
                            className="flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-bold text-white"
                            style={{ backgroundColor: primary }}
                        >
                            {orgName.charAt(0).toUpperCase()}
                        </span>
                    )}
                    <h1 className="mt-4 text-xl font-semibold text-slate-900">{orgName}</h1>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">{greeting}</p>
                </header>

                {/* Smart Triggers (abren el chat con intención) */}
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                    {triggers.map(({ Icon, label, context }) => (
                        <Link
                            key={label}
                            href={chatHref(context)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-[0_1px_3px_rgba(2,6,23,0.04)] transition-transform active:scale-[0.97]"
                            style={{ transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)" }}
                        >
                            <Icon className="h-3.5 w-3.5" strokeWidth={1.75} style={{ color: primary }} aria-hidden="true" />
                            {label}
                        </Link>
                    ))}
                </div>

                {/* Catálogo visual (bento) — cada producto abre el chat sobre ese item */}
                {bento.length > 0 && (
                    <div className="mt-6 grid grid-cols-2 gap-3">
                        {bento.map((product) => {
                            const name = (product.name as string) || "Producto"
                            const rawPrice = typeof product.sale_price === "number" && product.sale_price
                                ? product.sale_price
                                : (product.price as number)
                            const image = (product.image_url as string) || null
                            return (
                                <Link
                                    key={product.id as string}
                                    href={chatHref(`Quiero información de ${name}`)}
                                    className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_2px_8px_rgba(2,6,23,0.04)] transition-transform active:scale-[0.98]"
                                    style={{ transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)" }}
                                >
                                    <div className="relative aspect-square w-full bg-slate-100">
                                        {image ? (
                                            <Image src={image} alt={name} fill className="object-cover" sizes="(max-width: 448px) 50vw, 224px" />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center text-slate-300">
                                                <MessageCircle className="h-8 w-8" strokeWidth={1.5} aria-hidden="true" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-3">
                                        <p className="truncate text-sm font-medium text-slate-900">{name}</p>
                                        {typeof rawPrice === "number" && (
                                            <p className="mt-0.5 text-sm font-semibold" style={{ color: primary }}>{fmt(rawPrice)}</p>
                                        )}
                                    </div>
                                </Link>
                            )
                        })}
                    </div>
                )}

                {/* CTA principal al chat */}
                <Link
                    href={chatHref("Hola, quiero ayuda")}
                    className="mt-6 inline-flex items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold text-white shadow-sm transition-transform active:scale-[0.98]"
                    style={{ backgroundColor: primary, transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)" }}
                >
                    <MessageCircle className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                    {agentName ? `Hablar con ${agentName}` : "Hablar con la tienda"}
                </Link>

                <p className="mt-auto pt-8 text-center text-[11px] text-slate-400">
                    Powered by LandingChat
                </p>
            </div>
        </main>
    )
}
