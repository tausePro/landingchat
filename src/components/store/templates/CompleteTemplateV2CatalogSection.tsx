"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Layers3, MessageCircle, ShoppingBag } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ProductCard } from "@/components/store/product-card"
import { getContrastTextColor } from "@/lib/utils"
import { getStoreLink } from "@/lib/utils/store-urls"
import type { StorefrontViewModel } from "@/types/storefront"

interface CatalogProduct {
    id: string
    name?: string | null
    slug?: string | null
    description?: string | null
    image_url?: string | null
    price?: number | string | null
    sale_price?: number | string | null
    categories?: string | string[] | null
    images?: string[] | null
    stock?: number | null
    badge_id?: string | null
    [key: string]: unknown
}

interface CatalogSettings {
    showSection?: boolean
    itemsToShow?: number
    orderBy?: string
    showPrices?: boolean
    showAddToCart?: boolean
    showAIRecommended?: boolean
    categories?: {
        enabled?: boolean
        selected?: string[]
    }
    sectionTitle?: string
    sectionSubtitle?: string
}

interface CatalogOrganization {
    slug: string
    settings?: {
        storefront?: {
            products?: CatalogSettings | null
        } | null
    } | null
}

interface CompleteTemplateV2CatalogSectionProps {
    organization: CatalogOrganization
    products: CatalogProduct[]
    badges?: unknown[]
    primaryColor: string
    onStartChat: (productId?: string) => void
    storefrontViewModel?: StorefrontViewModel
    isSubdomain: boolean
}

const defaultProductConfig: Required<Omit<CatalogSettings, "categories">> & { categories: { enabled: boolean; selected: string[] } } = {
    showSection: true,
    itemsToShow: 8,
    orderBy: "recent",
    showPrices: true,
    showAddToCart: true,
    showAIRecommended: false,
    categories: {
        enabled: true,
        selected: [],
    },
    sectionTitle: "Catálogo curado",
    sectionSubtitle: "Explora por categorías y descubre una selección mucho más clara, comercial y accionable.",
}

function getProductCategories(product: CatalogProduct): string[] {
    if (Array.isArray(product.categories)) {
        return product.categories.filter((category): category is string => typeof category === "string" && category.trim().length > 0)
    }

    if (typeof product.categories === "string" && product.categories.trim().length > 0) {
        return [product.categories.trim()]
    }

    return []
}

export function CompleteTemplateV2CatalogSection({
    organization,
    products,
    badges = [],
    primaryColor,
    onStartChat,
    storefrontViewModel,
    isSubdomain,
}: CompleteTemplateV2CatalogSectionProps) {
    const savedProductConfig = organization.settings?.storefront?.products ?? {}
    const productConfig = {
        ...defaultProductConfig,
        ...savedProductConfig,
        categories: {
            ...defaultProductConfig.categories,
            ...(savedProductConfig?.categories ?? {}),
        },
    }
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
    const conversationEnabled = storefrontViewModel?.conversation.chatEnabled ?? true
    const catalogUrl = getStoreLink("/productos", isSubdomain, organization.slug)

    const availableCategories = useMemo(() => {
        if (!productConfig.categories.enabled) {
            return []
        }

        if (productConfig.categories.selected.length > 0) {
            return productConfig.categories.selected
        }

        const categories = new Set<string>()
        products.forEach((product) => {
            getProductCategories(product).forEach((category) => categories.add(category))
        })

        return Array.from(categories)
    }, [productConfig.categories.enabled, productConfig.categories.selected, products])

    const visibleProducts = useMemo(() => {
        let result = [...products]

        if (productConfig.categories.enabled && productConfig.categories.selected.length > 0) {
            result = result.filter((product) => {
                const productCategories = getProductCategories(product)
                return productCategories.some((category) => productConfig.categories.selected.includes(category))
            })
        }

        if (selectedCategory) {
            result = result.filter((product) => getProductCategories(product).includes(selectedCategory))
        }

        if (productConfig.orderBy === "price_asc") {
            result.sort((leftProduct, rightProduct) => Number(leftProduct.price ?? 0) - Number(rightProduct.price ?? 0))
        } else if (productConfig.orderBy === "price_desc") {
            result.sort((leftProduct, rightProduct) => Number(rightProduct.price ?? 0) - Number(leftProduct.price ?? 0))
        }

        const itemsToShow = Number.isFinite(productConfig.itemsToShow)
            ? Math.max(1, Math.min(productConfig.itemsToShow ?? defaultProductConfig.itemsToShow, 8))
            : defaultProductConfig.itemsToShow

        return result.slice(0, itemsToShow)
    }, [productConfig.categories.enabled, productConfig.categories.selected, productConfig.itemsToShow, productConfig.orderBy, products, selectedCategory])

    if (!productConfig.showSection) {
        return null
    }

    return (
        <section className="bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_18%,#effbff_100%)] py-12 md:py-16" data-section="catalog-curation">
            <div className="container mx-auto px-4">
                <div className="overflow-hidden rounded-[36px] border border-slate-200/80 bg-white/88 p-6 shadow-[0_28px_90px_rgba(15,23,42,0.07)] backdrop-blur-xl md:p-8 xl:p-10">
                    <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                        <div className="max-w-3xl">
                            <Badge variant="outline" className="rounded-full border-cyan-200/80 bg-cyan-50/85 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-700">
                                <Layers3 className="mr-2 h-3.5 w-3.5" />
                                Explora por intención
                            </Badge>
                            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-950 md:text-4xl">
                                {productConfig.sectionTitle || defaultProductConfig.sectionTitle}
                            </h2>
                            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600 md:text-lg">
                                {productConfig.sectionSubtitle || defaultProductConfig.sectionSubtitle}
                            </p>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                            <Button asChild variant="outline" className="h-11 rounded-full border-slate-200 bg-white px-5 font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
                                <Link href={catalogUrl} data-cta="catalog-curation-open-catalog">
                                    <ShoppingBag className="mr-2 h-4 w-4" />
                                    Ver catálogo completo
                                </Link>
                            </Button>
                            {conversationEnabled && (
                                <Button
                                    type="button"
                                    className="h-11 rounded-full px-5 font-semibold shadow-[0_18px_44px_rgba(15,23,42,0.12)]"
                                    style={{ backgroundColor: primaryColor, color: getContrastTextColor(primaryColor) }}
                                    onClick={() => onStartChat()}
                                    data-cta="catalog-curation-open-chat"
                                >
                                    <MessageCircle className="mr-2 h-4 w-4" />
                                    Necesito ayuda para elegir
                                </Button>
                            )}
                        </div>
                    </div>

                    {availableCategories.length > 0 && (
                        <div className="mt-8 flex flex-wrap gap-3">
                            <Button
                                type="button"
                                variant={selectedCategory === null ? undefined : "outline"}
                                className="rounded-full px-4 font-semibold"
                                style={selectedCategory === null ? { backgroundColor: primaryColor, color: getContrastTextColor(primaryColor) } : undefined}
                                onClick={() => setSelectedCategory(null)}
                                data-cta="catalog-curation-chip-all"
                            >
                                Todo
                            </Button>
                            {availableCategories.map((category) => (
                                <Button
                                    key={category}
                                    type="button"
                                    variant={selectedCategory === category ? undefined : "outline"}
                                    className="rounded-full px-4 font-semibold capitalize"
                                    style={selectedCategory === category ? { backgroundColor: primaryColor, color: getContrastTextColor(primaryColor) } : undefined}
                                    onClick={() => setSelectedCategory(category)}
                                    data-cta="catalog-curation-chip"
                                    data-category={category}
                                >
                                    {category}
                                </Button>
                            ))}
                        </div>
                    )}

                    {visibleProducts.length > 0 ? (
                        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
                            {visibleProducts.map((product) => {
                                const productUrl = getStoreLink(`/producto/${product.slug || product.id}`, isSubdomain, organization.slug)

                                return (
                                    <ProductCard
                                        key={product.id}
                                        product={product}
                                        productUrl={productUrl}
                                        badges={badges}
                                        primaryColor={primaryColor}
                                        showPrices={productConfig.showPrices}
                                        showAddToCart={productConfig.showAddToCart}
                                        showAIRecommended={productConfig.showAIRecommended}
                                    />
                                )
                            })}
                        </div>
                    ) : (
                        <div className="mt-8 rounded-[28px] border border-dashed border-slate-300 bg-slate-50 px-8 py-14 text-center">
                            <h3 className="text-2xl font-bold tracking-tight text-slate-950">
                                {products.length > 0 ? "No encontramos productos para este filtro" : "Estamos preparando el catálogo"}
                            </h3>
                            <p className="mt-3 text-base text-slate-600">
                                {products.length > 0
                                    ? "Prueba otra categoría o vuelve al catálogo completo para seguir explorando."
                                    : "Todavía no hay productos activos para mostrar en esta sección."}
                            </p>
                            {conversationEnabled && (
                                <Button
                                    type="button"
                                    className="mt-6 h-11 rounded-full px-6 font-semibold"
                                    style={{ backgroundColor: primaryColor, color: getContrastTextColor(primaryColor) }}
                                    onClick={() => onStartChat()}
                                    data-cta="catalog-curation-empty-chat"
                                >
                                    <MessageCircle className="mr-2 h-4 w-4" />
                                    Quiero ayuda con esta selección
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </section>
    )
}
