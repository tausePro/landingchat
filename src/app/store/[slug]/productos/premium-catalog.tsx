import type { ComponentProps, ReactNode } from "react"
import { ArrowRight, MessageCircle } from "lucide-react"
import { ProductCard } from "@/components/store/product-card"
import { ProductFiltersPanel } from "./product-filters-panel"
import { getStoreLink } from "@/lib/utils/store-urls"
import { getContrastTextColor } from "@/lib/utils"
import { t } from "@/lib/i18n/storefront-strings"
import type { TenantLocaleContext } from "@/lib/i18n/tenant-locale"
import type { StorefrontProduct } from "@/lib/commerce/storefrontProduct"

const EASE = "cubic-bezier(0.16,1,0.3,1)"

interface CatalogFacets {
    categories: string[]
    minPrice: number | null
    maxPrice: number | null
    productCount: number
}

interface PremiumCatalogProps {
    slug: string
    isSub: boolean
    locale: TenantLocaleContext["locale"]
    primaryColor: string
    currencyCode: string
    agentName: string | null
    chatUrl: string
    products: StorefrontProduct[]
    badges: ComponentProps<typeof ProductCard>["badges"]
    facets: CatalogFacets
    activeCategories: string[]
    activeSearch: string
    activeMinPrice: number | null
    activeMaxPrice: number | null
    headingTitle: string
    headingSubtitle: string
}

// Acento editorial sobre la última palabra del título (tokenizado por tenant).
function accentLastWord(title: string, accentColor: string): ReactNode {
    const trimmed = title.trim()
    const lastSpace = trimmed.lastIndexOf(" ")
    if (lastSpace < 0) return trimmed
    return (
        <>
            {trimmed.slice(0, lastSpace + 1)}
            <span style={{ color: accentColor }} className="italic">{trimmed.slice(lastSpace + 1)}</span>
        </>
    )
}

function tabClass(active: boolean): string {
    return active
        ? "rounded-full bg-slate-900 px-4 py-1.5 text-sm font-medium text-white"
        : "rounded-full border border-slate-200 px-4 py-1.5 text-sm text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
}

/**
 * Catálogo premium (server). Reúsa ProductCard + ProductFiltersPanel; agrega
 * header editorial, tabs por categoría y card concierge (atajo al agente).
 * Solo se renderiza cuando el tenant usa la plantilla "premium" (gating en page).
 */
export function PremiumCatalog({
    slug,
    isSub,
    locale,
    primaryColor,
    currencyCode,
    agentName,
    chatUrl,
    products,
    badges,
    facets,
    activeCategories,
    activeSearch,
    activeMinPrice,
    activeMaxPrice,
    headingTitle,
    headingSubtitle,
}: PremiumCatalogProps) {
    const contrast = getContrastTextColor(primaryColor)
    const allUrl = getStoreLink("/productos", isSub, slug)
    const askAgentText = agentName
        ? `${t("store.catalog.premium_ask_agent", locale)} ${agentName}`
        : t("store.catalog.premium_ask_agent_generic", locale)

    return (
        <div className="bg-white">
            {/* ── Header editorial + CTA al agente ── */}
            <section className="border-b border-slate-100">
                <div className="mx-auto max-w-7xl px-4 py-10 md:py-14">
                    <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                        <div className="max-w-2xl">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                                {t("store.catalog.premium_eyebrow", locale)} · {facets.productCount} {t("store.catalog.premium_products_label", locale)}
                            </p>
                            <h1 className="mt-3 text-3xl font-bold leading-[1.1] tracking-tight text-slate-900 md:text-5xl">
                                {accentLastWord(headingTitle, primaryColor)}
                            </h1>
                            <p className="mt-3 text-lg leading-relaxed text-slate-600">{headingSubtitle}</p>
                        </div>
                        <a
                            href={chatUrl}
                            className="inline-flex shrink-0 items-center gap-2 self-start rounded-full px-5 py-2.5 text-sm font-semibold shadow-sm transition-transform hover:-translate-y-0.5 md:self-auto"
                            style={{ backgroundColor: primaryColor, color: contrast, transitionTimingFunction: EASE }}
                        >
                            <MessageCircle className="h-4 w-4" strokeWidth={1.75} />
                            {askAgentText}
                        </a>
                    </div>

                    {facets.categories.length > 0 ? (
                        <div className="mt-8 flex flex-wrap gap-2">
                            <a href={allUrl} className={tabClass(activeCategories.length === 0)}>
                                {t("store.catalog.premium_all", locale)}
                            </a>
                            {facets.categories.map((category) => (
                                <a
                                    key={category}
                                    href={getStoreLink(`/productos?categorias=${encodeURIComponent(category)}`, isSub, slug)}
                                    className={tabClass(activeCategories.includes(category))}
                                >
                                    {category}
                                </a>
                            ))}
                        </div>
                    ) : null}
                </div>
            </section>

            {/* ── Body: sidebar (concierge + filtros) + grid ── */}
            <section className="mx-auto max-w-7xl px-4 py-10 md:py-14">
                <div className="grid grid-cols-1 gap-8 md:grid-cols-[260px_1fr]">
                    <div className="space-y-6">
                        {/* Card concierge — atajo al agente, tokenizada */}
                        <div className="rounded-2xl p-5 shadow-sm" style={{ backgroundColor: primaryColor, color: contrast }}>
                            <MessageCircle className="h-6 w-6" strokeWidth={1.5} />
                            <h3 className="mt-3 text-base font-bold leading-snug">{t("store.home.premium_concierge_title", locale)}</h3>
                            <p className="mt-1.5 text-sm leading-relaxed opacity-90">{t("store.home.premium_concierge_subtitle", locale)}</p>
                            <a
                                href={chatUrl}
                                className="group mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 text-sm font-semibold transition-transform active:scale-[0.98]"
                                style={{ transitionTimingFunction: EASE }}
                            >
                                {t("store.home.premium_concierge_cta", locale)}
                                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={1.75} />
                            </a>
                        </div>

                        <ProductFiltersPanel
                            availableCategories={facets.categories}
                            activeCategories={activeCategories}
                            activeSearch={activeSearch}
                            activeMinPrice={activeMinPrice}
                            activeMaxPrice={activeMaxPrice}
                            availableMinPrice={facets.minPrice}
                            availableMaxPrice={facets.maxPrice}
                            primaryColor={primaryColor}
                            currencyCode={currencyCode}
                        />
                    </div>

                    <div>
                        <p className="mb-6 text-sm text-slate-500">
                            {products.length} {t("store.catalog.premium_results", locale)}
                        </p>
                        {products.length === 0 ? (
                            <div className="rounded-3xl border border-dashed border-slate-200 bg-stone-50 px-8 py-20 text-center">
                                <p className="text-lg text-slate-500">{headingSubtitle}</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3">
                                {products.map((product) => (
                                    <ProductCard
                                        key={product.id}
                                        product={product}
                                        productUrl={getStoreLink(`/producto/${product.slug || product.id}`, isSub, slug)}
                                        badges={badges}
                                        primaryColor={primaryColor}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </div>
    )
}
