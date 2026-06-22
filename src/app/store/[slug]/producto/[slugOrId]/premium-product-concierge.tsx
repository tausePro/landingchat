import { MessageCircle } from "lucide-react"
import { getChatUrl } from "@/lib/utils/store-urls"
import { getContrastTextColor } from "@/lib/utils"
import { t } from "@/lib/i18n/storefront-strings"
import type { TenantLocaleContext } from "@/lib/i18n/tenant-locale"

interface PremiumProductConciergeProps {
    slug: string
    isSubdomain: boolean
    locale: TenantLocaleContext["locale"]
    primaryColor: string
    agentName: string | null
    productId: string
}

/**
 * Banda de asesor guiado para la ficha de producto (premium). Server-rendered;
 * enlaza al chat con el producto + un contexto de duda/cross-sell, para que el
 * agente resuelva o recomiende con qué combinarlo. Portabilidad del asesor a la
 * vista de producto. Gating por template "premium" se hace en la page.
 */
export function PremiumProductConcierge({
    slug,
    isSubdomain,
    locale,
    primaryColor,
    agentName,
    productId,
}: PremiumProductConciergeProps) {
    const contrast = getContrastTextColor(primaryColor)
    const chatUrl = `${getChatUrl(isSubdomain, slug, false)}?product=${encodeURIComponent(productId)}&context=${encodeURIComponent(t("store.product.premium_concierge_intent", locale))}`
    const cta = agentName
        ? `${t("store.product.premium_concierge_cta", locale)} ${agentName}`
        : t("store.product.premium_concierge_cta_generic", locale)

    return (
        <section className="border-t border-slate-100 bg-stone-50 py-12 md:py-16">
            <div className="mx-auto max-w-3xl px-4 text-center">
                <h2 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
                    {t("store.product.premium_concierge_title", locale)}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {t("store.product.premium_concierge_subtitle", locale)}
                </p>
                <a
                    href={chatUrl}
                    className="mt-5 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold shadow-sm transition-transform hover:-translate-y-0.5"
                    style={{ backgroundColor: primaryColor, color: contrast }}
                >
                    <MessageCircle className="h-4 w-4" strokeWidth={1.75} />
                    {cta}
                </a>
            </div>
        </section>
    )
}
