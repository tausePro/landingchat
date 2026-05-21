"use client"

import { useCartStore } from "@/store/cart-store"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { CartSidebar, type RecommendationItem } from "@/components/chat/cart-sidebar"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useT } from "@/lib/i18n/use-tenant-strings"

interface ShippingConfig {
    free_shipping_enabled: boolean
    free_shipping_min_amount: number | null
    free_shipping_zones: string[] | null
    default_shipping_rate: number
}

interface CartDrawerProps {
    slug: string
    primaryColor?: string
    recommendations?: RecommendationItem[]
    onlyMobile?: boolean
    onCheckout?: () => void
    shippingConfig?: ShippingConfig | null
}

export function CartDrawer({ slug, primaryColor, recommendations, onlyMobile = false, onCheckout, shippingConfig }: CartDrawerProps) {
    const { isOpen, setIsOpen } = useCartStore()
    const isDesktop = useMediaQuery("(min-width: 1024px)")
    const t = useT()

    // Si onlyMobile está activado y estamos en escritorio, no renderizar
    if (onlyMobile && isDesktop) return null

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetContent className="w-full sm:w-[400px] p-0 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden [&>button]:hidden">
                <SheetTitle className="sr-only">{t("store.cart.drawer_title_sr")}</SheetTitle>
                <CartSidebar 
                    slug={slug} 
                    primaryColor={primaryColor} 
                    recommendations={recommendations}
                    onClose={() => setIsOpen(false)}
                    onCheckout={onCheckout}
                    shippingConfig={shippingConfig}
                />
            </SheetContent>
        </Sheet>
    )
}
