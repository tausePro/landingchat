"use client"

import { useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { useIsSubdomain } from "@/hooks/use-is-subdomain"
import { getStoreLink } from "@/lib/utils/store-urls"
import { useCartStore } from "@/store/cart-store"
import { ShoppingBag, User } from "lucide-react"
import { useEffect, useState } from "react"

interface StoreHeaderProps {
    slug: string
    organization: any
    onStartChat: () => void
    hideOnMobile?: boolean
    primaryColor: string
    showStoreName?: boolean
    className?: string
    hideChatButton?: boolean
    isChatMode?: boolean
    onCloseChat?: () => void
}

export function StoreHeader({
    slug,
    organization,
    onStartChat,
    hideOnMobile = false,
    primaryColor,
    showStoreName = true,
    className = "",
    hideChatButton = false,
    isChatMode = false,
    onCloseChat
}: StoreHeaderProps) {
    const router = useRouter()
    const isSubdomain = useIsSubdomain()
    const { items, toggleCart } = useCartStore()

    // Prevent hydration mismatch for cart count
    const [mounted, setMounted] = useState(false)
    useEffect(() => setMounted(true), [])

    const cartCount = items.reduce((acc, item) => acc + item.quantity, 0)

    const homeLink = getStoreLink('/', isSubdomain, slug)
    const productsLink = getStoreLink('/productos', isSubdomain, slug)
    const profileLink = getStoreLink('/profile', isSubdomain, slug)

    return (
        <header className={`sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md ${hideOnMobile ? 'hidden md:block' : ''} ${className}`}>
            <div className="container mx-auto flex h-16 items-center justify-between px-4">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push(homeLink)}>
                    {organization.logo_url ? (
                        <Image
                            src={organization.logo_url}
                            alt={organization.name}
                            width={150}
                            height={40}
                            className="h-10 w-auto object-contain max-w-[120px] md:max-w-[150px]"
                            loading="eager"
                            quality={90}
                            priority
                        />
                    ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white font-bold text-lg" style={{ backgroundColor: primaryColor }}>
                            {organization.name.substring(0, 1)}
                        </div>
                    )}
                    {showStoreName && (
                        <span className="text-lg md:text-xl font-bold tracking-tight">{organization.name}</span>
                    )}
                </div>
                <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
                    <a href={homeLink} className="hover:text-primary transition-colors">Inicio</a>
                    <a href={productsLink} className="hover:text-primary transition-colors">Productos</a>
                    <a href={profileLink} className="hover:text-primary transition-colors">Mi Perfil</a>
                </nav>
                <div className="flex items-center gap-4">
                    {/* Profile Button - Mobile */}
                    <a
                        href={profileLink}
                        className="md:hidden p-2 text-slate-600 hover:text-slate-900 transition-colors"
                        aria-label="Mi perfil"
                    >
                        <User className="w-6 h-6" />
                    </a>

                    {/* Cart Button */}
                    <button
                        onClick={() => toggleCart()}
                        className={`relative p-2 text-slate-600 hover:text-slate-900 transition-colors ${isChatMode ? 'md:hidden' : ''}`}
                        aria-label="Ver carrito"
                    >
                        <ShoppingBag className="w-6 h-6" />
                        {mounted && cartCount > 0 && (
                            <span className="absolute top-0 right-0 -mt-1 -mr-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center border-2 border-white">
                                {cartCount}
                            </span>
                        )}
                    </button>

                    {isChatMode ? (
                         <Button
                            onClick={onCloseChat}
                            variant="ghost"
                            size="sm"
                            className="font-bold border border-gray-200 text-gray-700 hover:bg-gray-100 h-9 px-3 gap-1"
                        >
                            <span className="material-symbols-outlined text-lg">close</span>
                            <span className="hidden sm:inline text-xs">Cerrar</span>
                        </Button>
                    ) : (
                        !hideChatButton && (
                            <Button
                                onClick={onStartChat}
                                style={{ backgroundColor: primaryColor }}
                                className="font-bold shadow-lg shadow-blue-500/20 text-sm md:text-base px-4 md:px-6"
                            >
                                Iniciar Chat
                            </Button>
                        )
                    )}
                </div>
            </div>
        </header>
    )
}
