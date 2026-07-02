"use client"

import { useT } from "@/lib/i18n/use-tenant-strings"
import { getDeliveryEstimate, type StorefrontShippingConfig } from "@/lib/utils/shipping"
import { deliveryEstimateLabel } from "./delivery-estimate-label"
import type { ProductSectionLink } from "./product-detail-types"

interface ProductTrustRailProps {
    whatsappLink: string | null
    sectionLinks: ProductSectionLink[]
    shippingConfig?: StorefrontShippingConfig | null
    hasFreeShipping: boolean
    inventoryLabel?: string
    primaryColor?: string
    onStartChat: () => void
}

interface TrustBadgeItem {
    id: string
    icon: string
    title: string
    description: string
    href?: string
    onClick?: () => void
}

export function ProductTrustRail({ whatsappLink, sectionLinks, shippingConfig, hasFreeShipping, inventoryLabel, primaryColor = "#3B82F6", onStartChat }: ProductTrustRailProps) {
    // useT() funciona porque el archivo es 'use client' y ProductTrustRail
    // se renderiza dentro del provider tree de TenantStringsProvider.
    const t = useT()
    // Promesa configurable del merchant (0 = hoy mismo, rango min-max)
    const deliveryEstimate = getDeliveryEstimate(shippingConfig)
    const trustBadges: TrustBadgeItem[] = []
    const resolvedInventoryLabel = inventoryLabel ?? t("store.product_detail.inventory_confirmed")

    if (deliveryEstimate) {
        trustBadges.push({
            id: "shipping",
            icon: "local_shipping",
            title: t("store.product_detail.trust_rail_fast_shipping"),
            description: deliveryEstimateLabel(t, deliveryEstimate),
        })
    } else if (hasFreeShipping) {
        trustBadges.push({
            id: "shipping",
            icon: "local_shipping",
            title: t("store.product_detail.trust_rail_free_shipping"),
            description: t("store.product_detail.trust_rail_active_purchase"),
        })
    }

    if (whatsappLink) {
        trustBadges.push({
            id: "chat",
            icon: "chat_bubble",
            title: t("store.product_detail.trust_badge_assisted_purchase"),
            description: t("store.product_detail.trust_badge_whatsapp_available"),
            href: whatsappLink,
        })
    } else {
        trustBadges.push({
            id: "chat",
            icon: "chat_bubble",
            title: t("store.product_detail.trust_badge_assisted_purchase"),
            description: t("store.product_detail.trust_badge_we_help_chat"),
            onClick: onStartChat,
        })
    }

    trustBadges.push({
        id: "inventory",
        icon: "inventory_2",
        title: t("store.product_detail.trust_rail_real_inventory"),
        description: resolvedInventoryLabel,
    })

    if (sectionLinks.length > 0) {
        trustBadges.push({
            id: "sections",
            icon: "menu_book",
            title: t("store.product_detail.trust_rail_explore"),
            description: t("store.product_detail.trust_rail_sections_count", {
                count: sectionLinks.length,
            }),
        })
    }

    if (trustBadges.length === 0 && sectionLinks.length === 0) {
        return null
    }

    return (
        <div className="mt-5 space-y-3">
            <div className="overflow-hidden rounded-[10px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40">
                <div className="grid grid-cols-2 md:grid-cols-4">
                    {trustBadges.map((item) => {
                        const content = (
                            <>
                                <span className="material-symbols-outlined text-[18px]" style={{ color: primaryColor }}>{item.icon}</span>
                                <span>
                                    {item.title}<br />{item.description}
                                </span>
                            </>
                        )

                        const className = "flex flex-col items-center gap-1 border-r border-slate-200 px-3 py-3 text-center text-[11px] font-medium text-slate-600 last:border-r-0 dark:border-slate-800 dark:text-slate-300"

                        if ("href" in item && item.href) {
                            return (
                                <a key={item.id} href={item.href} target="_blank" rel="noopener noreferrer" className={className}>
                                    {content}
                                </a>
                            )
                        }

                        if ("onClick" in item && item.onClick) {
                            return (
                                <button key={item.id} type="button" onClick={item.onClick} className={className}>
                                    {content}
                                </button>
                            )
                        }

                        return (
                            <div key={item.id} className={className}>
                                {content}
                            </div>
                        )
                    })}
                </div>
            </div>

            {sectionLinks.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {sectionLinks.map((sectionLink) => (
                        <a
                            key={sectionLink.id}
                            href={`#${sectionLink.id}`}
                            className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500"
                        >
                            {sectionLink.label}
                        </a>
                    ))}
                </div>
            )}
        </div>
    )
}
