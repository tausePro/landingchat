"use client"

import { useCartStore } from "@/store/cart-store"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { CartSidebar } from "@/components/chat/cart-sidebar"
import { useMediaQuery } from "@/hooks/use-media-query"

interface CartDrawerProps {
    slug: string
    primaryColor?: string
    recommendations?: any[]
    onlyMobile?: boolean
    onCheckout?: () => void
}

export function CartDrawer({ slug, primaryColor, recommendations, onlyMobile = false, onCheckout }: CartDrawerProps) {
    const { isOpen, setIsOpen } = useCartStore()
    const isDesktop = useMediaQuery("(min-width: 1024px)")

    // Si onlyMobile está activado y estamos en escritorio, no renderizar
    if (onlyMobile && isDesktop) return null

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetContent className="w-full sm:w-[400px] p-0 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden [&>button]:hidden">
                <SheetTitle className="sr-only">Carrito de Compras</SheetTitle>
                <CartSidebar 
                    slug={slug} 
                    primaryColor={primaryColor} 
                    recommendations={recommendations}
                    onClose={() => setIsOpen(false)}
                    onCheckout={onCheckout}
                />
            </SheetContent>
        </Sheet>
    )
}
