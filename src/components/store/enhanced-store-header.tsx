"use client"

import { useRouter, usePathname } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { useIsSubdomain } from "@/hooks/use-is-subdomain"
import { getStoreLink } from "@/lib/utils/store-urls"
import { useCartStore } from "@/store/cart-store"
import { ShoppingBag, User, MessageCircle, Menu, X, Search, ChevronDown as ChevronDownIcon } from "lucide-react"
import { useEffect, useState, useRef } from "react"
import { AnnouncementBar } from "./announcement-bar"
import { SmartSearch } from "./smart-search"
import { cn, getContrastTextColor } from "@/lib/utils"
import { useT } from "@/lib/i18n/use-tenant-strings"

interface MenuItem {
    id: string
    label: string
    url: string
    openInNewTab?: boolean
    children?: MenuItem[]
}

interface HeaderOrganization {
    name: string
    logo_url?: string | null
}

interface EnhancedStoreHeaderProps {
    slug: string
    organization: HeaderOrganization
    onStartChat: (query?: string) => void
    hideOnMobile?: boolean
    primaryColor: string
    /** Alto del logo en px (configurable por el merchant). Default 44. */
    logoSize?: number
    showStoreName?: boolean
    menuItems?: MenuItem[]
    className?: string
    hideChatButton?: boolean
    hideMenu?: boolean
    hideSearch?: boolean
    hideProfile?: boolean
    hideAnnouncementBar?: boolean
    isRealEstate?: boolean
    shippingConfig?: {
        free_shipping_enabled: boolean
        free_shipping_min_amount?: number
        default_shipping_rate?: number
    }
    announcementMessages?: string[]
}

export function EnhancedStoreHeader({
    slug,
    organization,
    onStartChat,
    hideOnMobile = false,
    primaryColor,
    logoSize = 44,
    showStoreName = true,
    menuItems = [],
    className = "",
    hideChatButton = false,
    hideMenu = false,
    hideSearch = false,
    hideProfile = false,
    hideAnnouncementBar = false,
    isRealEstate = false,
    shippingConfig,
    announcementMessages
}: EnhancedStoreHeaderProps) {
    const router = useRouter()
    const pathname = usePathname()
    const isSubdomain = useIsSubdomain()
    const { items, toggleCart } = useCartStore()
    const t = useT()

    // Prevent hydration mismatch for cart count
    const [mounted, setMounted] = useState(false)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [searchOpen, setSearchOpen] = useState(false)
    useEffect(() => {
        const frameId = window.requestAnimationFrame(() => setMounted(true))
        return () => window.cancelAnimationFrame(frameId)
    }, [])

    // Cerrar el overlay de busqueda (desktop) con la tecla Escape.
    useEffect(() => {
        if (!searchOpen) return
        function handleKey(event: KeyboardEvent) {
            if (event.key === "Escape") setSearchOpen(false)
        }
        document.addEventListener("keydown", handleKey)
        return () => document.removeEventListener("keydown", handleKey)
    }, [searchOpen])

    const cartCount = items.reduce((acc, item) => acc + item.quantity, 0)

    const homeLink = getStoreLink('/', isSubdomain, slug)
    const profileLink = getStoreLink('/profile', isSubdomain, slug)

    // Resolver URL de un menu item: relativas pasan por getStoreLink, absolutas pasan directo
    const resolveMenuUrl = (url: string) => {
        if (url.startsWith('http://') || url.startsWith('https://')) return url
        return getStoreLink(url, isSubdomain, slug)
    }

    // Detectar si un link está activo
    const isActiveLink = (url: string) => {
        if (url.startsWith('http://') || url.startsWith('https://')) return false
        const fullUrl = getStoreLink(url, isSubdomain, slug)
        if (url === '/') return pathname === fullUrl
        return pathname.startsWith(fullUrl)
    }

    // Cerrar menú mobile al navegar
    const handleMobileNavClick = () => {
        setMobileMenuOpen(false)
    }

    const hasMenuItems = !hideMenu && menuItems.length > 0

    return (
        <div className={`sticky top-0 z-50 w-full ${hideOnMobile ? 'hidden md:block' : ''} ${className}`}>
            {/* Barra superior de anuncios (solo e-commerce, no inmobiliarias) */}
            {!isRealEstate && !hideAnnouncementBar && (
                <AnnouncementBar
                    shippingConfig={shippingConfig}
                    primaryColor={primaryColor}
                    messages={announcementMessages}
                />
            )}

            {/* Header principal */}
            <header className="w-full border-b bg-white/95 backdrop-blur-md">
                <div className="container relative mx-auto flex h-16 items-center justify-between px-4 gap-4">
                    {/* Logo y nombre de la tienda */}
                    <div className="flex items-center gap-3 cursor-pointer flex-shrink-0" onClick={() => router.push(homeLink)}>
                        {organization.logo_url ? (
                            <Image
                                src={organization.logo_url}
                                alt={organization.name}
                                width={240}
                                height={64}
                                className="w-auto object-contain max-w-[280px]"
                                style={{ height: `${logoSize}px` }}
                                loading="eager"
                                quality={90}
                                priority
                            />
                        ) : (
                            <span
                                className="truncate font-extrabold tracking-tight text-slate-900 max-w-[60vw] sm:max-w-[320px]"
                                style={{ fontSize: `${Math.round(logoSize * 0.6)}px`, lineHeight: 1.1 }}
                            >
                                {organization.name}
                            </span>
                        )}
                        {organization.logo_url && showStoreName && (
                            <span className="hidden sm:block text-lg font-bold tracking-tight">{organization.name}</span>
                        )}
                    </div>

                    {/* Navegación desktop */}
                    {hasMenuItems && (
                        <nav className="hidden md:flex items-center gap-1">
                            {menuItems.map((item) => {
                                const hasChildren = item.children && item.children.length > 0
                                if (hasChildren) {
                                    return (
                                        <DropdownNavItem
                                            key={item.id}
                                            item={item}
                                            resolveMenuUrl={resolveMenuUrl}
                                            isActiveLink={isActiveLink}
                                        />
                                    )
                                }
                                return (
                                    <a
                                        key={item.id}
                                        href={resolveMenuUrl(item.url)}
                                        target={item.openInNewTab ? '_blank' : undefined}
                                        rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
                                        className={cn(
                                            "px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap",
                                            isActiveLink(item.url)
                                                ? "text-slate-900 bg-slate-100"
                                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                                        )}
                                    >
                                        {item.label}
                                    </a>
                                )
                            })}
                        </nav>
                    )}

                    {/* Espaciador desktop: empuja las acciones a la derecha y deja
                        el menu de navegacion pegado al logo. El buscador ya no ocupa
                        espacio fijo aqui — se expande desde el icono de lupa. */}
                    <div className="hidden md:block flex-1" aria-hidden="true" />

                    {/* Acciones del usuario */}
                    <div className="flex items-center gap-2 md:gap-3">
                        {/* Hamburguesa mobile */}
                        {hasMenuItems && (
                            <button
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                className="md:hidden p-2 text-slate-600 hover:text-slate-900 transition-colors"
                                aria-label={mobileMenuOpen ? t("store.header.close_menu") : t("store.header.open_menu")}
                            >
                                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                            </button>
                        )}

                        {/* Pregúntale a la IA - Solo móvil (ocultar si hay menú para no saturar) */}
                        {!hasMenuItems && (
                            <Button
                                onClick={() => onStartChat()}
                                variant="ghost"
                                size="sm"
                                className="md:hidden text-xs px-2"
                            >
                                {t("store.header.ask_ai")}
                            </Button>
                        )}

                        {/* Buscador (desktop): icono de lupa que abre el overlay.
                            Colapsado libera ancho horizontal para el menu. */}
                        {!hideSearch && (
                            <button
                                onClick={() => setSearchOpen(true)}
                                className="hidden md:flex p-2 text-slate-600 hover:text-slate-900 transition-colors"
                                aria-label={t("store.header.search_aria")}
                            >
                                <Search className="w-5 h-5" />
                            </button>
                        )}

                        {/* Profile Button */}
                        {!hideProfile && (
                            <a
                                href={profileLink}
                                className="p-2 text-slate-600 hover:text-slate-900 transition-colors"
                                aria-label={t("store.header.profile_aria")}
                            >
                                <User className="w-5 h-5" />
                            </a>
                        )}

                        {/* Cart Button (oculto para inmobiliarias) */}
                        {!isRealEstate && (
                            <button
                                onClick={() => toggleCart()}
                                className="relative p-2 text-slate-600 hover:text-slate-900 transition-colors"
                                aria-label={t("store.header.cart_aria")}
                            >
                                <ShoppingBag className="w-5 h-5" />
                                {mounted && cartCount > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center border-2 border-white">
                                        {cartCount}
                                    </span>
                                )}
                            </button>
                        )}

                        {/* Chat Button - Desktop */}
                        {!hideChatButton && (
                            <Button
                                onClick={() => onStartChat()}
                                style={{ backgroundColor: primaryColor, color: getContrastTextColor(primaryColor) }}
                                className="hidden md:flex font-bold shadow-lg text-sm px-6 h-10 rounded-full items-center gap-2"
                            >
                                <MessageCircle className="w-4 h-4" />
                                {isRealEstate ? t("store.header.book_visit") : t("store.header.start_chat")}
                            </Button>
                        )}
                    </div>

                    {/* Overlay de busqueda desktop: el buscador se expande sobre la
                        fila del header desde el icono de lupa, sin reflujo del menu.
                        Se cierra con la X o con la tecla Escape. */}
                    {!hideSearch && searchOpen && (
                        <div className="hidden md:flex absolute inset-0 z-50 items-center justify-center gap-2 bg-white/95 backdrop-blur-md px-4 animate-in fade-in duration-150">
                            <SmartSearch
                                slug={slug}
                                onStartChat={onStartChat}
                                primaryColor={primaryColor}
                                onClose={() => setSearchOpen(false)}
                                autoFocus
                            />
                            <button
                                onClick={() => setSearchOpen(false)}
                                className="flex-shrink-0 p-2 text-slate-600 hover:text-slate-900 transition-colors"
                                aria-label={t("store.header.close_search")}
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Menú mobile desplegable */}
                {mobileMenuOpen && hasMenuItems && (
                    <MobileMenu
                        menuItems={menuItems}
                        resolveMenuUrl={resolveMenuUrl}
                        isActiveLink={isActiveLink}
                        onNavClick={handleMobileNavClick}
                        onStartChat={onStartChat}
                    />
                )}

                {/* Buscador móvil */}
                {!hideSearch && (
                    <div className="md:hidden px-4 pb-3">
                        <SmartSearch
                            slug={slug}
                            onStartChat={onStartChat}
                            primaryColor={primaryColor}
                        />
                    </div>
                )}
            </header>
        </div>
    )
}

// ============================================================================
// Desktop Dropdown Nav Item
// ============================================================================
function DropdownNavItem({
    item,
    resolveMenuUrl,
    isActiveLink,
}: {
    item: MenuItem
    resolveMenuUrl: (url: string) => string
    isActiveLink: (url: string) => boolean
}) {
    const [open, setOpen] = useState(false)
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    const handleEnter = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        setOpen(true)
    }

    const handleLeave = () => {
        timeoutRef.current = setTimeout(() => setOpen(false), 150)
    }

    // Detectar si algún hijo está activo
    const isChildActive = item.children?.some(child => isActiveLink(child.url)) || false

    return (
        <div
            ref={containerRef}
            className="relative"
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
        >
            <a
                href={resolveMenuUrl(item.url)}
                className={cn(
                    "inline-flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap",
                    isActiveLink(item.url) || isChildActive
                        ? "text-slate-900 bg-slate-100"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                )}
            >
                {item.label}
                <ChevronDownIcon className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")} />
            </a>

            {/* Dropdown panel */}
            {open && (
                <div className="absolute left-0 top-full pt-1 z-50">
                    <div className="bg-white rounded-lg shadow-lg border border-slate-200 py-1 min-w-[180px] animate-in fade-in slide-in-from-top-1 duration-150">
                        {item.children!.map((child) => (
                            <a
                                key={child.id}
                                href={resolveMenuUrl(child.url)}
                                target={child.openInNewTab ? '_blank' : undefined}
                                rel={child.openInNewTab ? 'noopener noreferrer' : undefined}
                                className={cn(
                                    "block px-4 py-2 text-sm transition-colors",
                                    isActiveLink(child.url)
                                        ? "text-slate-900 bg-slate-50 font-medium"
                                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                                )}
                                onClick={() => setOpen(false)}
                            >
                                {child.label}
                            </a>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

// ============================================================================
// Mobile Menu with Accordion Sub-items
// ============================================================================
function MobileMenu({
    menuItems,
    resolveMenuUrl,
    isActiveLink,
    onNavClick,
    onStartChat,
}: {
    menuItems: MenuItem[]
    resolveMenuUrl: (url: string) => string
    isActiveLink: (url: string) => boolean
    onNavClick: () => void
    onStartChat: (query?: string) => void
}) {
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const t = useT()

    return (
        <div className="md:hidden border-t bg-white px-4 py-2 space-y-1 animate-in slide-in-from-top-2 duration-200">
            {menuItems.map((item) => {
                const hasChildren = item.children && item.children.length > 0
                const isExpanded = expandedId === item.id

                if (hasChildren) {
                    return (
                        <div key={item.id}>
                            {/* Parent item - toggles accordion */}
                            <button
                                onClick={() => setExpandedId(isExpanded ? null : item.id)}
                                className={cn(
                                    "w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-md transition-colors",
                                    isActiveLink(item.url) || item.children?.some(c => isActiveLink(c.url))
                                        ? "text-slate-900 bg-slate-100"
                                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                                )}
                            >
                                {item.label}
                                <ChevronDownIcon className={cn("w-4 h-4 transition-transform", isExpanded && "rotate-180")} />
                            </button>

                            {/* Children accordion */}
                            {isExpanded && (
                                <div className="ml-4 border-l-2 border-slate-100 pl-2 space-y-0.5 py-1 animate-in slide-in-from-top-1 duration-150">
                                    {/* Link al padre también */}
                                    <a
                                        href={resolveMenuUrl(item.url)}
                                        target={item.openInNewTab ? '_blank' : undefined}
                                        rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
                                        onClick={onNavClick}
                                        className={cn(
                                            "block px-3 py-2 text-sm rounded-md transition-colors",
                                            isActiveLink(item.url)
                                                ? "text-slate-900 bg-slate-50 font-medium"
                                                : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                                        )}
                                    >
                                        {t("store.header.see_all")}
                                    </a>
                                    {item.children!.map((child) => (
                                        <a
                                            key={child.id}
                                            href={resolveMenuUrl(child.url)}
                                            target={child.openInNewTab ? '_blank' : undefined}
                                            rel={child.openInNewTab ? 'noopener noreferrer' : undefined}
                                            onClick={onNavClick}
                                            className={cn(
                                                "block px-3 py-2 text-sm rounded-md transition-colors",
                                                isActiveLink(child.url)
                                                    ? "text-slate-900 bg-slate-50 font-medium"
                                                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                                            )}
                                        >
                                            {child.label}
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                }

                return (
                    <a
                        key={item.id}
                        href={resolveMenuUrl(item.url)}
                        target={item.openInNewTab ? '_blank' : undefined}
                        rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
                        onClick={onNavClick}
                        className={cn(
                            "block px-3 py-2.5 text-sm font-medium rounded-md transition-colors",
                            isActiveLink(item.url)
                                ? "text-slate-900 bg-slate-100"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                        )}
                    >
                        {item.label}
                    </a>
                )
            })}
            {/* Botón IA en menú mobile */}
            <button
                onClick={() => { onNavClick(); onStartChat(); }}
                className="w-full text-left px-3 py-2.5 text-sm font-medium rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            >
                {t("store.header.ask_ai")}
            </button>
        </div>
    )
}
