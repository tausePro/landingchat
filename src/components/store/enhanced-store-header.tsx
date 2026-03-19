"use client"

import { useRouter, usePathname } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { useIsSubdomain } from "@/hooks/use-is-subdomain"
import { getStoreLink } from "@/lib/utils/store-urls"
import { useCartStore } from "@/store/cart-store"
import { ShoppingBag, User, MessageCircle, Menu, X, ChevronDown as ChevronDownIcon } from "lucide-react"
import { useEffect, useState, useRef } from "react"
import { AnnouncementBar } from "./announcement-bar"
import { SmartSearch } from "./smart-search"
import { cn, getContrastTextColor } from "@/lib/utils"

interface MenuItem {
    id: string
    label: string
    url: string
    openInNewTab?: boolean
    children?: MenuItem[]
}

type HeaderLogoSize = "sm" | "md" | "lg" | "xl"

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
    showStoreName?: boolean
    menuItems?: MenuItem[]
    className?: string
    hideChatButton?: boolean
    isRealEstate?: boolean
    shippingConfig?: {
        free_shipping_enabled: boolean
        free_shipping_min_amount?: number
        default_shipping_rate?: number
    }
    logoSize?: HeaderLogoSize
    visualVariant?: "default" | "glass"
}

export function EnhancedStoreHeader({
    slug,
    organization,
    onStartChat,
    hideOnMobile = false,
    primaryColor,
    showStoreName = true,
    menuItems = [],
    className = "",
    hideChatButton = false,
    isRealEstate = false,
    shippingConfig,
    logoSize,
    visualVariant = "default"
}: EnhancedStoreHeaderProps) {
    const router = useRouter()
    const pathname = usePathname()
    const isSubdomain = useIsSubdomain()
    const { items, toggleCart } = useCartStore()

    // Prevent hydration mismatch for cart count
    const [mounted, setMounted] = useState(false)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    useEffect(() => {
        const frameId = window.requestAnimationFrame(() => {
            setMounted(true)
        })

        return () => window.cancelAnimationFrame(frameId)
    }, [])

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

    const hasMenuItems = menuItems.length > 0
    const isGlassVariant = visualVariant === "glass"
    const resolvedLogoSize: HeaderLogoSize = logoSize ?? (isGlassVariant ? "lg" : "md")
    const iconButtonClassName = isGlassVariant
        ? "rounded-full border border-white/60 bg-white/65 p-2 text-slate-600 shadow-sm backdrop-blur-xl transition-all hover:bg-white hover:text-slate-900"
        : "p-2 text-slate-600 transition-colors hover:text-slate-900"
    const logoPresentation = {
        sm: {
            width: 112,
            height: 32,
            imageClassName: "h-7 w-auto object-contain max-w-[96px] md:h-8 md:max-w-[112px]",
            markClassName: isGlassVariant ? "h-8 w-8 rounded-xl shadow-sm" : "h-8 w-8 rounded-lg",
        },
        md: {
            width: 132,
            height: 38,
            imageClassName: "h-8 w-auto object-contain max-w-[108px] md:h-9 md:max-w-[132px]",
            markClassName: isGlassVariant ? "h-9 w-9 rounded-2xl shadow-sm" : "h-8 w-8 rounded-lg",
        },
        lg: {
            width: 156,
            height: 44,
            imageClassName: "h-9 w-auto object-contain max-w-[126px] md:h-10 md:max-w-[156px]",
            markClassName: isGlassVariant ? "h-10 w-10 rounded-2xl shadow-sm" : "h-9 w-9 rounded-xl",
        },
        xl: {
            width: 184,
            height: 52,
            imageClassName: "h-10 w-auto object-contain max-w-[144px] md:h-12 md:max-w-[184px]",
            markClassName: isGlassVariant ? "h-11 w-11 rounded-[1.35rem] shadow-sm" : "h-10 w-10 rounded-2xl",
        },
    }[resolvedLogoSize]

    return (
        <div className={`sticky top-0 z-50 w-full ${hideOnMobile ? 'hidden md:block' : ''} ${className}`}>
            {/* Barra superior de anuncios (solo e-commerce, no inmobiliarias) */}
            {!isRealEstate && (
                <AnnouncementBar
                    shippingConfig={shippingConfig}
                    primaryColor={primaryColor}
                    visualVariant={visualVariant}
                />
            )}

            {/* Header principal */}
            <header className={cn(
                "w-full",
                isGlassVariant
                    ? "border-b border-white/40 bg-white/35 backdrop-blur-2xl shadow-[0_18px_60px_rgba(15,23,42,0.08)]"
                    : "border-b bg-white/95 backdrop-blur-md"
            )}>
                <div className={cn(
                    "container mx-auto flex items-center justify-between gap-4 px-4",
                    isGlassVariant ? "min-h-[4.75rem] py-3" : "h-16"
                )}>
                    {/* Logo y nombre de la tienda */}
                    <div className={cn(
                        "flex cursor-pointer flex-shrink-0 items-center gap-3",
                        isGlassVariant && organization.logo_url && "py-1",
                        isGlassVariant && !organization.logo_url && "rounded-full border border-white/60 bg-white/55 px-3.5 py-2 shadow-[0_14px_34px_rgba(15,23,42,0.08)] backdrop-blur-xl"
                    )} onClick={() => router.push(homeLink)}>
                        {organization.logo_url ? (
                            <Image
                                src={organization.logo_url}
                                alt={organization.name}
                                width={logoPresentation.width}
                                height={logoPresentation.height}
                                className={logoPresentation.imageClassName}
                                loading="eager"
                                quality={90}
                                priority
                            />
                        ) : (
                            <div className={cn(
                                "flex items-center justify-center text-white font-bold text-sm",
                                logoPresentation.markClassName
                            )} style={{ backgroundColor: primaryColor }}>
                                {organization.name.substring(0, 1)}
                            </div>
                        )}
                        {showStoreName && (
                            <span className={cn("hidden text-lg font-bold tracking-tight sm:block", isGlassVariant ? "text-slate-900" : "")}>{organization.name}</span>
                        )}
                    </div>

                    {/* Navegación desktop */}
                    {hasMenuItems && (
                        <nav className={cn(
                            "hidden items-center gap-1 md:flex",
                            isGlassVariant && "rounded-full border border-white/60 bg-white/55 p-1 shadow-sm backdrop-blur-xl"
                        )}>
                            {menuItems.map((item) => {
                                const hasChildren = item.children && item.children.length > 0
                                if (hasChildren) {
                                    return (
                                        <DropdownNavItem
                                            key={item.id}
                                            item={item}
                                            resolveMenuUrl={resolveMenuUrl}
                                            isActiveLink={isActiveLink}
                                            visualVariant={visualVariant}
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
                                            isGlassVariant
                                                ? "rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-all"
                                                : "rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                                            isActiveLink(item.url)
                                                ? isGlassVariant
                                                    ? "bg-white text-slate-900 shadow-sm"
                                                    : "bg-slate-100 text-slate-900"
                                                : isGlassVariant
                                                    ? "text-slate-600 hover:bg-white/85 hover:text-slate-900"
                                                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                        )}
                                    >
                                        {item.label}
                                    </a>
                                )
                            })}
                        </nav>
                    )}

                    {/* Buscador inteligente - Solo en desktop */}
                    <div className={cn(
                        "hidden flex-1 justify-center md:flex",
                        hasMenuItems ? (isGlassVariant ? "max-w-[27rem]" : "max-w-sm") : ""
                    )}>
                        <SmartSearch
                            slug={slug}
                            onStartChat={onStartChat}
                            primaryColor={primaryColor}
                            visualVariant={visualVariant}
                        />
                    </div>

                    {/* Acciones del usuario */}
                    <div className={cn(
                        "flex items-center gap-2 md:gap-3",
                        isGlassVariant && "rounded-full border border-white/60 bg-white/55 px-2 py-2 shadow-[0_14px_34px_rgba(15,23,42,0.08)] backdrop-blur-xl"
                    )}>
                        {/* Hamburguesa mobile */}
                        {hasMenuItems && (
                            <button
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                className={cn("md:hidden", iconButtonClassName)}
                                aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
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
                                className={cn("text-xs px-2 md:hidden", isGlassVariant && "rounded-full border border-white/60 bg-white/65 px-3 text-slate-700 shadow-sm backdrop-blur-xl hover:bg-white")}
                            >
                                Pregúntale a la IA
                            </Button>
                        )}

                        {/* Profile Button */}
                        <a
                            href={profileLink}
                            className={iconButtonClassName}
                            aria-label="Mi perfil"
                        >
                            <User className="w-5 h-5" />
                        </a>

                        {/* Cart Button (oculto para inmobiliarias) */}
                        {!isRealEstate && (
                            <button
                                onClick={() => toggleCart()}
                                className={cn("relative", iconButtonClassName)}
                                aria-label="Ver carrito"
                            >
                                <ShoppingBag className="w-5 h-5" />
                                {mounted && cartCount > 0 && (
                                    <span className={cn(
                                        "absolute -right-1 -top-1 min-w-[18px] rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[10px] font-bold text-white",
                                        isGlassVariant ? "border-2 border-slate-50" : "border-2 border-white"
                                    )}>
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
                                className={cn(
                                    "hidden items-center gap-2 rounded-full text-sm font-bold md:flex",
                                    isGlassVariant ? "h-11 border border-white/50 px-6 shadow-[0_18px_36px_rgba(15,23,42,0.16)]" : "h-10 px-6 shadow-lg"
                                )}
                            >
                                <MessageCircle className="w-4 h-4" />
                                {isRealEstate ? "Agenda tu visita" : "Iniciar Chat"}
                            </Button>
                        )}
                    </div>
                </div>

                {/* Menú mobile desplegable */}
                {mobileMenuOpen && hasMenuItems && (
                    <MobileMenu
                        menuItems={menuItems}
                        resolveMenuUrl={resolveMenuUrl}
                        isActiveLink={isActiveLink}
                        onNavClick={handleMobileNavClick}
                        onStartChat={onStartChat}
                        visualVariant={visualVariant}
                    />
                )}

                {/* Buscador móvil */}
                <div className={cn("px-4 pb-3 md:hidden", isGlassVariant && "pt-1")}>
                    <SmartSearch
                        slug={slug}
                        onStartChat={onStartChat}
                        primaryColor={primaryColor}
                        visualVariant={visualVariant}
                    />
                </div>
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
    visualVariant,
}: {
    item: MenuItem
    resolveMenuUrl: (url: string) => string
    isActiveLink: (url: string) => boolean
    visualVariant: "default" | "glass"
}) {
    const [open, setOpen] = useState(false)
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const isGlassVariant = visualVariant === "glass"

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
                    isGlassVariant
                        ? "inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-all"
                        : "inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                    isActiveLink(item.url) || isChildActive
                        ? isGlassVariant
                            ? "bg-white text-slate-900 shadow-sm"
                            : "bg-slate-100 text-slate-900"
                        : isGlassVariant
                            ? "text-slate-600 hover:bg-white/85 hover:text-slate-900"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
            >
                {item.label}
                <ChevronDownIcon className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")} />
            </a>

            {/* Dropdown panel */}
            {open && (
                <div className="absolute left-0 top-full z-50 pt-2">
                    <div className={cn(
                        "min-w-[180px] py-1 animate-in fade-in slide-in-from-top-1 duration-150",
                        isGlassVariant
                            ? "rounded-2xl border border-white/70 bg-white/80 shadow-[0_24px_60px_rgba(15,23,42,0.12)] backdrop-blur-2xl"
                            : "rounded-lg border border-slate-200 bg-white shadow-lg"
                    )}>
                        {item.children!.map((child) => (
                            <a
                                key={child.id}
                                href={resolveMenuUrl(child.url)}
                                target={child.openInNewTab ? '_blank' : undefined}
                                rel={child.openInNewTab ? 'noopener noreferrer' : undefined}
                                className={cn(
                                    isGlassVariant
                                        ? "block rounded-xl px-4 py-2 text-sm transition-colors"
                                        : "block px-4 py-2 text-sm transition-colors",
                                    isActiveLink(child.url)
                                        ? isGlassVariant
                                            ? "bg-white/90 font-medium text-slate-900"
                                            : "bg-slate-50 font-medium text-slate-900"
                                        : isGlassVariant
                                            ? "text-slate-600 hover:bg-white/75 hover:text-slate-900"
                                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
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
    visualVariant,
}: {
    menuItems: MenuItem[]
    resolveMenuUrl: (url: string) => string
    isActiveLink: (url: string) => boolean
    onNavClick: () => void
    onStartChat: (query?: string) => void
    visualVariant: "default" | "glass"
}) {
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const isGlassVariant = visualVariant === "glass"

    return (
        <div className={cn(
            "space-y-1 px-4 py-2 animate-in slide-in-from-top-2 duration-200 md:hidden",
            isGlassVariant
                ? "border-t border-white/50 bg-white/55 backdrop-blur-2xl"
                : "border-t bg-white"
        )}>
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
                                    isGlassVariant
                                        ? "flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors"
                                        : "flex w-full items-center justify-between rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                                    isActiveLink(item.url) || item.children?.some(c => isActiveLink(c.url))
                                        ? isGlassVariant
                                            ? "bg-white/85 text-slate-900"
                                            : "bg-slate-100 text-slate-900"
                                        : isGlassVariant
                                            ? "text-slate-600 hover:bg-white/80 hover:text-slate-900"
                                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                )}
                            >
                                {item.label}
                                <ChevronDownIcon className={cn("w-4 h-4 transition-transform", isExpanded && "rotate-180")} />
                            </button>

                            {/* Children accordion */}
                            {isExpanded && (
                                <div className={cn(
                                    "ml-4 space-y-0.5 py-1 pl-2 animate-in slide-in-from-top-1 duration-150",
                                    isGlassVariant ? "border-l-2 border-white/50" : "border-l-2 border-slate-100"
                                )}>
                                    {/* Link al padre también */}
                                    <a
                                        href={resolveMenuUrl(item.url)}
                                        target={item.openInNewTab ? '_blank' : undefined}
                                        rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
                                        onClick={onNavClick}
                                        className={cn(
                                            isGlassVariant
                                                ? "block rounded-xl px-3 py-2 text-sm transition-colors"
                                                : "block rounded-md px-3 py-2 text-sm transition-colors",
                                            isActiveLink(item.url)
                                                ? isGlassVariant
                                                    ? "bg-white/80 font-medium text-slate-900"
                                                    : "bg-slate-50 font-medium text-slate-900"
                                                : isGlassVariant
                                                    ? "text-slate-500 hover:bg-white/70 hover:text-slate-900"
                                                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                                        )}
                                    >
                                        Ver todo
                                    </a>
                                    {item.children!.map((child) => (
                                        <a
                                            key={child.id}
                                            href={resolveMenuUrl(child.url)}
                                            target={child.openInNewTab ? '_blank' : undefined}
                                            rel={child.openInNewTab ? 'noopener noreferrer' : undefined}
                                            onClick={onNavClick}
                                            className={cn(
                                                isGlassVariant
                                                    ? "block rounded-xl px-3 py-2 text-sm transition-colors"
                                                    : "block rounded-md px-3 py-2 text-sm transition-colors",
                                                isActiveLink(child.url)
                                                    ? isGlassVariant
                                                        ? "bg-white/80 font-medium text-slate-900"
                                                        : "bg-slate-50 font-medium text-slate-900"
                                                    : isGlassVariant
                                                        ? "text-slate-500 hover:bg-white/70 hover:text-slate-900"
                                                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
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
                            isGlassVariant
                                ? "block rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors"
                                : "block rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                            isActiveLink(item.url)
                                ? isGlassVariant
                                    ? "bg-white/85 text-slate-900"
                                    : "bg-slate-100 text-slate-900"
                                : isGlassVariant
                                    ? "text-slate-600 hover:bg-white/80 hover:text-slate-900"
                                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        )}
                    >
                        {item.label}
                    </a>
                )
            })}
            {/* Botón IA en menú mobile */}
            <button
                onClick={() => { onNavClick(); onStartChat(); }}
                className={cn(
                    "w-full text-left px-3 py-2.5 text-sm font-medium transition-colors",
                    isGlassVariant
                        ? "rounded-2xl text-slate-600 hover:bg-white/80 hover:text-slate-900"
                        : "rounded-md text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
            >
                Pregúntale a la IA
            </button>
        </div>
    )
}
