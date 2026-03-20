"use client"

import { useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, MessageCircle, ShoppingBag, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getContrastTextColor } from "@/lib/utils"
import { getProductUrl, getStoreLink } from "@/lib/utils/store-urls"
import type { StorefrontViewModel, StorefrontViewModelOfferItem } from "@/types/storefront"

interface LegacyStoreProduct {
    id: string
    name?: string | null
    slug?: string | null
    description?: string | null
    image_url?: string | null
    price?: number | string | null
    sale_price?: number | string | null
}

interface FeaturedBandOrganization {
    slug: string
    name: string
}

interface DisplayProduct {
    id: string
    title: string
    slug?: string | null
    description?: string | null
    imageUrl?: string | null
    price?: number | null
    salePrice?: number | null
}

interface CompleteTemplateV2FeaturedBandProps {
    organization: FeaturedBandOrganization
    products: LegacyStoreProduct[]
    primaryColor: string
    onStartChat: (productId?: string) => void
    storefrontViewModel?: StorefrontViewModel
    isSubdomain: boolean
}

function getNumericValue(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined || value === "") {
        return null
    }

    const parsedValue = typeof value === "number" ? value : Number(value)
    return Number.isNaN(parsedValue) ? null : parsedValue
}

function formatPrice(value: number | string | null | undefined): string {
    const numericValue = getNumericValue(value)

    if (numericValue === null) {
        return "Sin precio"
    }

    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: 0,
    }).format(numericValue)
}

function stripHtml(value: string | null | undefined): string {
    if (!value) {
        return ""
    }

    return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

function createExcerpt(value: string | null | undefined, maxLength: number): string {
    const cleanValue = stripHtml(value)

    if (!cleanValue) {
        return ""
    }

    if (cleanValue.length <= maxLength) {
        return cleanValue
    }

    const truncated = cleanValue.slice(0, maxLength)
    const lastSpace = truncated.lastIndexOf(" ")

    return `${lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated}...`
}

function mapViewModelProduct(product: StorefrontViewModelOfferItem): DisplayProduct {
    return {
        id: product.id,
        title: product.title,
        slug: product.slug,
        description: product.description,
        imageUrl: product.imageUrl,
        price: getNumericValue(product.price),
        salePrice: getNumericValue(product.salePrice),
    }
}

function mapLegacyProduct(product: LegacyStoreProduct): DisplayProduct {
    return {
        id: product.id,
        title: product.name || "Producto destacado",
        slug: product.slug,
        description: product.description,
        imageUrl: product.image_url,
        price: getNumericValue(product.price),
        salePrice: getNumericValue(product.sale_price),
    }
}

export function CompleteTemplateV2FeaturedBand({
    organization,
    products,
    primaryColor,
    onStartChat,
    storefrontViewModel,
    isSubdomain,
}: CompleteTemplateV2FeaturedBandProps) {
    const featuredProducts = useMemo(() => {
        const viewModelProducts = storefrontViewModel?.commerce?.featuredProducts ?? []

        if (viewModelProducts.length > 0) {
            return viewModelProducts.slice(0, 3).map(mapViewModelProduct).filter((product) => product.id.length > 0)
        }

        return products.slice(0, 3).map(mapLegacyProduct).filter((product) => product.id.length > 0)
    }, [products, storefrontViewModel?.commerce?.featuredProducts])

    const conversationEnabled = storefrontViewModel?.conversation.chatEnabled ?? true
    const productsUrl = getStoreLink("/productos", isSubdomain, organization.slug)

    if (featuredProducts.length === 0) {
        return null
    }

    const [primaryProduct, ...secondaryProducts] = featuredProducts
    const primaryProductUrl = getProductUrl(primaryProduct.slug || primaryProduct.id, isSubdomain, organization.slug)
    const primaryPrice = primaryProduct.salePrice ?? primaryProduct.price
    const primaryHasDiscount = primaryProduct.salePrice !== null
        && primaryProduct.salePrice !== undefined
        && primaryProduct.price !== null
        && primaryProduct.price !== undefined
        && primaryProduct.salePrice < primaryProduct.price

    return (
        <section className="bg-white py-10 md:py-14" data-section="featured-band">
            <div className="container mx-auto px-4">
                <div className="mb-8 flex flex-col gap-5 md:mb-10 md:flex-row md:items-end md:justify-between">
                    <div className="max-w-2xl">
                        <Badge variant="outline" className="rounded-full border-cyan-200/80 bg-cyan-50/80 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-700">
                            <Sparkles className="mr-2 h-3.5 w-3.5" />
                            Selección editorial
                        </Badge>
                        <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-950 md:text-4xl">
                            El siguiente scroll ya debe vender mejor que `v1`
                        </h2>
                        <p className="mt-3 text-base leading-7 text-slate-600 md:text-lg">
                            Productos listos para descubrir, comparar y abrir conversación sin perder el tono premium del nuevo `complete-v2`.
                        </p>
                    </div>

                    <Button asChild variant="outline" className="h-11 rounded-full border-slate-200 bg-white px-5 font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
                        <Link href={productsUrl} data-cta="featured-band-catalog">
                            <ShoppingBag className="mr-2 h-4 w-4" />
                            Explorar catálogo
                        </Link>
                    </Button>
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] xl:gap-5">
                    <article
                        className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-[linear-gradient(135deg,#f7fcff_0%,#ffffff_40%,#ecfeff_100%)] shadow-[0_24px_80px_rgba(15,23,42,0.08)]"
                        data-product-id={primaryProduct.id}
                    >
                        <div className="grid gap-0 lg:grid-cols-[minmax(0,0.95fr)_minmax(300px,0.9fr)]">
                            <div className="flex flex-col justify-between p-6 md:p-8">
                                <div>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <span className="inline-flex items-center rounded-full border border-white/80 bg-white/85 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-600 shadow-sm">
                                            Destacado ahora
                                        </span>
                                        {primaryHasDiscount && (
                                            <span className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white" style={{ backgroundColor: primaryColor }}>
                                                Precio con ventaja
                                            </span>
                                        )}
                                    </div>

                                    <h3 className="mt-5 max-w-xl text-2xl font-extrabold tracking-tight text-slate-950 md:text-[2rem] md:leading-tight">
                                        {primaryProduct.title}
                                    </h3>
                                    <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600 md:text-base">
                                        {createExcerpt(primaryProduct.description, 180) || "Una propuesta destacada del catálogo lista para verse mejor, abrir ficha y convertirse en conversación."}
                                    </p>
                                </div>

                                <div className="mt-8">
                                    <div className="flex flex-wrap items-end gap-3">
                                        <p className="text-2xl font-extrabold tracking-tight text-slate-950 md:text-3xl">
                                            {formatPrice(primaryPrice)}
                                        </p>
                                        {primaryHasDiscount && primaryProduct.price !== null && primaryProduct.price !== undefined && (
                                            <p className="pb-1 text-sm font-medium text-slate-400 line-through">
                                                {formatPrice(primaryProduct.price)}
                                            </p>
                                        )}
                                    </div>

                                    <div className="mt-5 flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                        <span className="rounded-full border border-white/80 bg-white/80 px-3 py-1.5">Descubrimiento guiado</span>
                                        <span className="rounded-full border border-white/80 bg-white/80 px-3 py-1.5">CTA comercial claro</span>
                                        <span className="rounded-full border border-white/80 bg-white/80 px-3 py-1.5">Listo para conversar</span>
                                    </div>

                                    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                                        <Button
                                            asChild
                                            className="h-12 rounded-full px-6 text-sm font-semibold shadow-[0_18px_44px_rgba(15,23,42,0.12)]"
                                            style={{ backgroundColor: primaryColor, color: getContrastTextColor(primaryColor) }}
                                        >
                                            <Link href={primaryProductUrl} data-cta="featured-band-primary-open" data-product-id={primaryProduct.id}>
                                                Abrir ficha destacada
                                                <ArrowRight className="ml-2 h-4 w-4" />
                                            </Link>
                                        </Button>

                                        {conversationEnabled && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="h-12 rounded-full border-white/80 bg-white/84 px-6 text-sm font-semibold text-slate-700 shadow-sm hover:bg-white"
                                                onClick={() => onStartChat(primaryProduct.id)}
                                                data-cta="featured-band-primary-chat"
                                                data-product-id={primaryProduct.id}
                                            >
                                                <MessageCircle className="mr-2 h-4 w-4" />
                                                Quiero asesoría con IA
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="relative min-h-[320px] border-t border-white/70 bg-slate-100 lg:min-h-full lg:border-l lg:border-t-0">
                                {primaryProduct.imageUrl ? (
                                    <Image
                                        src={primaryProduct.imageUrl}
                                        alt={primaryProduct.title}
                                        fill
                                        sizes="(max-width: 1280px) 100vw, 36vw"
                                        className="object-cover"
                                    />
                                ) : (
                                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-100 via-white to-cyan-50 px-10 text-center text-2xl font-semibold text-slate-400">
                                        {primaryProduct.title}
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/10 via-transparent to-white/20" />
                            </div>
                        </div>
                    </article>

                    {secondaryProducts.length > 0 && (
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                            {secondaryProducts.map((product, index) => {
                                const productUrl = getProductUrl(product.slug || product.id, isSubdomain, organization.slug)
                                const saleOrPrice = product.salePrice ?? product.price
                                const hasDiscount = product.salePrice !== null
                                    && product.salePrice !== undefined
                                    && product.price !== null
                                    && product.price !== undefined
                                    && product.salePrice < product.price

                                return (
                                    <article
                                        key={product.id}
                                        className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_18px_48px_rgba(15,23,42,0.06)]"
                                        data-product-id={product.id}
                                    >
                                        <div className="grid h-full gap-0 sm:grid-cols-[132px_minmax(0,1fr)] xl:grid-cols-[144px_minmax(0,1fr)]">
                                            <div className="relative min-h-[148px] bg-slate-100">
                                                {product.imageUrl ? (
                                                    <Image
                                                        src={product.imageUrl}
                                                        alt={product.title}
                                                        fill
                                                        sizes="(max-width: 1280px) 50vw, 144px"
                                                        className="object-cover"
                                                    />
                                                ) : (
                                                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-100 via-white to-cyan-50 px-4 text-center text-sm font-semibold text-slate-400">
                                                        {product.title}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex min-w-0 flex-col justify-between p-5">
                                                <div>
                                                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                                                        Curado #{index + 2}
                                                    </p>
                                                    <h3 className="mt-2 line-clamp-2 text-lg font-bold leading-tight text-slate-900">
                                                        {product.title}
                                                    </h3>
                                                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
                                                        {createExcerpt(product.description, 90) || "Una alternativa bien posicionada para mantener la intención comercial del scroll."}
                                                    </p>
                                                </div>

                                                <div className="mt-4">
                                                    <div className="flex flex-wrap items-end gap-2">
                                                        <p className="text-lg font-bold text-slate-900">
                                                            {formatPrice(saleOrPrice)}
                                                        </p>
                                                        {hasDiscount && product.price !== null && product.price !== undefined && (
                                                            <p className="text-xs text-slate-400 line-through">
                                                                {formatPrice(product.price)}
                                                            </p>
                                                        )}
                                                    </div>

                                                    <div className="mt-4 flex flex-wrap gap-2">
                                                        <Button asChild variant="outline" size="sm" className="rounded-full border-slate-200 bg-white hover:bg-slate-50">
                                                            <Link href={productUrl} data-cta="featured-band-secondary-open" data-product-id={product.id}>
                                                                Ver producto
                                                            </Link>
                                                        </Button>

                                                        {conversationEnabled && (
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                className="rounded-full text-slate-600 hover:text-slate-900"
                                                                onClick={() => onStartChat(product.id)}
                                                                data-cta="featured-band-secondary-chat"
                                                                data-product-id={product.id}
                                                            >
                                                                <MessageCircle className="mr-2 h-4 w-4" />
                                                                Hablar con IA
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </article>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </section>
    )
}
