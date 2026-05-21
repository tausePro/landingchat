"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useSyncExternalStore } from "react"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CheckoutFlow } from "@/components/checkout/checkout-flow"
import { useCartStore } from "@/store/cart-store"
import { useIsSubdomain } from "@/hooks/use-is-subdomain"
import { getStoreLink } from "@/lib/utils/store-urls"
import { useT } from "@/lib/i18n/use-tenant-strings"

interface Props {
    slug: string
    sourceChannel: "web" | "chat" | "whatsapp"
    chatId?: string
    organizationName: string
    organizationLogo: string | null
}

/**
 * Suscribe a la hidratación del cart-store (zustand persist) usando el patrón
 * React 19 con useSyncExternalStore. Devuelve `false` en SSR y durante la
 * hidratación inicial; `true` cuando localStorage ya fue leído.
 */
function useCartHydrated(): boolean {
    return useSyncExternalStore(
        (callback) => useCartStore.persist.onFinishHydration(callback),
        () => useCartStore.persist.hasHydrated(),
        () => false,
    )
}

export function CheckoutPageClient({ slug, sourceChannel, chatId, organizationName, organizationLogo }: Props) {
    const t = useT()
    const router = useRouter()
    const isSubdomain = useIsSubdomain()
    const items = useCartStore(s => s.items)
    const setOrgSlug = useCartStore(s => s.setOrganizationSlug)
    const hasHydrated = useCartHydrated()

    // Sincronizar el slug del URL con el cart-store (efecto legítimo: external sync).
    useEffect(() => {
        setOrgSlug(slug)
    }, [slug, setOrgSlug])

    // Si el carrito está vacío tras hidratar, redirigir al storefront.
    useEffect(() => {
        if (!hasHydrated) return
        if (items.length === 0) {
            const storeUrl = getStoreLink("/", isSubdomain, slug)
            router.replace(storeUrl)
        }
    }, [hasHydrated, items.length, isSubdomain, slug, router])

    const storeHref = getStoreLink("/", isSubdomain, slug)

    const handleBack = () => {
        if (typeof window !== "undefined" && window.history.length > 1) {
            router.back()
            return
        }
        router.push(storeHref)
    }

    return (
        <div className="min-h-[100dvh] bg-slate-50 dark:bg-slate-950 flex flex-col">
            {/* Top bar: back button + tienda */}
            <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-slate-800 dark:bg-slate-900/95">
                <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleBack}
                        aria-label={t("store.checkout.back_aria")}
                        className="h-9 w-9 shrink-0"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>

                    <Link
                        href={storeHref}
                        className="flex min-w-0 flex-1 items-center gap-2"
                        aria-label={t("store.checkout.back_to_store_aria", { name: organizationName })}
                    >
                        {organizationLogo && (
                            <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                                <Image
                                    src={organizationLogo}
                                    alt=""
                                    fill
                                    sizes="32px"
                                    className="object-contain"
                                />
                            </span>
                        )}
                        <span className="min-w-0 truncate text-sm font-semibold text-slate-900 dark:text-white">
                            {organizationName}
                        </span>
                    </Link>

                    <span className="hidden sm:inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {t("store.checkout.secure_badge")}
                    </span>
                </div>
            </header>

            <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
                {hasHydrated && items.length > 0 ? (
                    <CheckoutFlow
                        slug={slug}
                        sourceChannel={sourceChannel}
                        chatId={chatId}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="h-10 w-10 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
                        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                            {t("store.checkout.cart_loading")}
                        </p>
                    </div>
                )}
            </main>
        </div>
    )
}
