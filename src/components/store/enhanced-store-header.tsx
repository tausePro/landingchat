"use client"

import { useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { useIsSubdomain } from "@/hooks/use-is-subdomain"
import { getStoreLink } from "@/lib/utils/store-urls"
import { useCartStore } from "@/store/cart-store"
import { ShoppingBag, User, MessageCircle } from "lucide-react"
import { useEffect, useState } from "react"
import { AnnouncementBar } from "./announcement-bar"
import { SmartSearch } from "./smart-search"

interface EnhancedStoreHeaderProps {
    slug: string
    organization: any
    onStartChat: (query?: string) => void
    hideOnMobile?: boolean
    primaryColor: string
    showStoreName?: boolean
    className?: string
    hideChatButton?: boolean
    shippingConfig?: {
        free_shipping_enabled: boolean
        free_shipping_min_amount?: number
        default_shipping_rate?: number
    }
}

export function EnhancedStoreHeader({
    slug,
    organization,
    onStartChat,
    hideOnMobile = false,
    primaryColor,
    showStoreName = true,
    className = "",
    hideChatButton = false,
    shippingConfig
}: EnhancedStoreHeaderProps) {
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
        <div className={`sticky top-0 z-50 w-full ${hideOnMobile ? 'hidden md:block' : ''} ${className}`}>
            {/* Barra superior de anuncios */}
            <AnnouncementBar 
                shippingConfig={shippingConfig}
                primaryColor={primaryColor}
            />
            
            {/* Header principal */}
            <header className="w-full border-b bg-white/95 backdrop-blur-md">
                <div className="container mx-auto flex h-16 items-center justify-between px-4 gap-4">
                    {/* Logo y nombre de la tienda */}
                    <div className="flex items-center gap-3 cursor-pointer flex-shrink-0" onClick={() => router.push(homeLink)}>
                        {organization.logo_url ? (
                            <Image
                                src={organization.logo_url}
                                alt={organization.name}
                                width={120}
                                height={32}
                                className="h-8 w-auto object-contain max-w-[100px] md:max-w-[120px]"
                                loading="eager"
                                quality={90}
                                priority
                            />
                        ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg text-white font-bold text-sm" style={{ backgroundColor: primaryColor }}>
                                {organization.name.substring(0, 1)}
                            </div>
                        )}
                        {showStoreName && (
                            <span className="hidden sm:block text-lg font-bold tracking-tight">{organization.name}</span>
                        )}
                    </div>

                    {/* Buscador inteligente - Solo en desktop */}
                    <div className="hidden md:flex flex-1 justify-center">
                        <SmartSearch
                            slug={slug}
                            onStartChat={onStartChat}
                            primaryColor={primaryColor}
                        />
                    </div>

                    {/* Acciones del usuario */}
                    <div className="flex items-center gap-2 md:gap-4">
                        {/* Pregúntale a la IA - Solo móvil */}
                        <Button
                            onClick={() => onStartChat()}
                            variant="ghost"
                            size="sm"
                            className="md:hidden text-xs px-2"
                        >
                            Pregúntale a la IA
                        </Button>

                        {/* Profile Button */}
                        <a
                            href={profileLink}
                            className="p-2 text-slate-600 hover:text-slate-900 transition-colors"
                            aria-label="Mi perfil"
                        >
                            <User className="w-5 h-5" />
                        </a>

                        {/* Cart Button */}
                        <button
                            onClick={() => toggleCart()}
                            className="relative p-2 text-slate-600 hover:text-slate-900 transition-colors"
                            aria-label="Ver carrito"
                        >
                            <ShoppingBag className="w-5 h-5" />
                            {mounted && cartCount > 0 && (
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center border-2 border-white">
                                    {cartCount}
                                </span>
                            )}
                        </button>

                        {/* Chat Button - Desktop */}
                        {!hideChatButton && (
                            <Button
                                onClick={() => onStartChat()}
                                style={{ backgroundColor: primaryColor }}
                                className="hidden md:flex font-bold shadow-lg text-sm px-6 h-10 rounded-full items-center gap-2"
                            >
                                <MessageCircle className="w-4 h-4" />
                                Iniciar Chat
                            </Button>
                        )}
                    </div>
                </div>

                {/* Buscador móvil */}
                <div className="md:hidden px-4 pb-3">
                    <SmartSearch
                        slug={slug}
                        onStartChat={onStartChat}
                        primaryColor={primaryColor}
                    />
                </div>
            </header>
        </div>
    )
}