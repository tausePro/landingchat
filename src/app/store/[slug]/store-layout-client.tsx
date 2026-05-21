"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { CustomerGateModal } from "@/components/store/customer-gate-modal"
import { TemplateRenderer } from "@/components/store/templates/template-renderer"
import { EnhancedStoreHeader } from "@/components/store/enhanced-store-header"
import { useIsSubdomain } from "@/hooks/use-is-subdomain"
import { getStoreLink, getChatUrl } from "@/lib/utils/store-urls"
import { getStoredUUID, setStoredUUID, setStoredString } from "@/lib/utils/storage"
import { StorePresence } from "@/components/store/store-presence"
import { CartDrawer } from "@/app/chat/components/cart-drawer"
import { ensurePosthog } from "@/lib/analytics/posthog-client"
import { useCartStore } from "@/store/cart-store"
import { useTrackingParams } from "@/hooks/use-tracking-params"
import { ConversationalLayout } from "@/components/store/layouts/conversational-layout"
import { EmbeddableChat } from "@/components/chat/embeddable-chat"
import { ProductStoryTray } from "@/components/store/product-story-tray"
import { ProactiveChatBubble } from "@/components/store/proactive-chat-bubble"
import { getSafeStorefrontTemplate, isRealEstateIndustry, type StorefrontTemplateContext } from "@/lib/storefront-templates"
import { StoreFooter } from "@/components/store/store-footer"
import { useT } from "@/lib/i18n/use-tenant-strings"
import type { ProactiveCouponOffer } from "./actions"
import type { ProductDetailCROConfig } from "@/lib/storefront/product-detail-cro"

// ... (in render)

interface StoreMenuItem {
    id: string
    label: string
    url: string
}

interface OrganizationSettings {
    industry?: string | null
    branding?: {
        primaryColor?: string
        [key: string]: unknown
    }
    storefront?: {
        hero?: Record<string, unknown>
        typography?: {
            fontFamily?: string
            [key: string]: unknown
        }
        header?: {
            showStoreName?: boolean
            menuItems?: StoreMenuItem[]
            [key: string]: unknown
        }
        template?: string
        [key: string]: unknown
    }
    whatsapp?: {
        phone?: string
        [key: string]: unknown
    }
    agent?: {
        name?: unknown
        avatar?: unknown
        [key: string]: unknown
    }
    [key: string]: unknown
}

interface StoreOrganization extends StorefrontTemplateContext {
    slug: string
    name: string
    logo_url?: string | null
    settings?: OrganizationSettings | null
}

interface StoreProduct extends Record<string, unknown> {
    id: string
    name: string
    price: number
    image_url: string
    slug: string
}

interface ShippingConfig {
    free_shipping_enabled: boolean
    free_shipping_min_amount: number | null
    free_shipping_zones: string[] | null
    default_shipping_rate: number
}

interface HeaderShippingConfig {
    free_shipping_enabled: boolean
    free_shipping_min_amount?: number
    default_shipping_rate?: number
}

interface IdentifiedCustomer {
    id: string
    full_name: string
    phone: string
    email?: string
}

interface StoreLayoutClientProps {
    slug: string
    organization: StoreOrganization
    products: StoreProduct[]
    properties?: Array<Record<string, unknown>>
    badges?: Array<Record<string, unknown>>
    pages?: Array<{ id: string; slug: string; title: string }>
    children?: React.ReactNode
    hideNavigation?: boolean
    hideHeaderOnMobile?: boolean
    initialIsSubdomain?: boolean
    defaultChatProductId?: string
    defaultChatProductName?: string | null
    proactiveCouponOffer?: ProactiveCouponOffer | null
    productDetailCRO?: ProductDetailCROConfig | null
}

export function StoreLayoutClient({ slug, organization, products, properties = [], badges = [], pages = [], children, hideNavigation = false, hideHeaderOnMobile = false, initialIsSubdomain = false, defaultChatProductId, defaultChatProductName, proactiveCouponOffer, productDetailCRO }: StoreLayoutClientProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const clientIsSubdomain = useIsSubdomain()
    const isSubdomain = initialIsSubdomain || clientIsSubdomain
    const [showGateModal, setShowGateModal] = useState(false)
    const t = useT()

    // --- DUMMY DATA FOR TESTING UI (If no products found) ---
    const productsToUse = products
    // --------------------------------------------------------

    const [pendingProductId, setPendingProductId] = useState<string | null>(null)
    const [pendingContext, setPendingContext] = useState<string | null>(null)
    const [shippingConfig, setShippingConfig] = useState<ShippingConfig | undefined>(undefined)
    const { setIsOpen: setCartOpen, setOrganizationSlug } = useCartStore()

    // Clear cart if switching organizations
    useEffect(() => {
        if (organization.slug) {
            setOrganizationSlug(organization.slug)
        }
    }, [organization.slug, setOrganizationSlug])

    // Capturar UTM params al entrar a la tienda
    useTrackingParams(slug)

    // Branding settings
    const primaryColor = organization.settings?.branding?.primaryColor || "#2b7cee"

    // Detectar vertical de la org
    const isRealEstate = isRealEstateIndustry(organization)

    // Storefront customization settings
    const storefrontSettings = organization.settings?.storefront || {}
    const heroSettings = storefrontSettings.hero || {}
    const typographySettings = storefrontSettings.typography || {}
    const headerSettings = storefrontSettings.header || {}
    const selectedTemplate = getSafeStorefrontTemplate(storefrontSettings.template, organization)
    const showStoreName = headerSettings.showStoreName ?? true
    const headerShippingConfig: HeaderShippingConfig | undefined = shippingConfig
        ? {
            free_shipping_enabled: shippingConfig.free_shipping_enabled,
            free_shipping_min_amount: shippingConfig.free_shipping_min_amount ?? undefined,
            default_shipping_rate: shippingConfig.default_shipping_rate ?? undefined,
        }
        : undefined

    // Defaults de menú según vertical (el admin puede personalizar).
    // i18n Fase 1 (T1.3c): labels desde el diccionario para que Tantor (en-US) vea "Home/Products".
    const defaultMenuItems = isRealEstate
        ? [
            { id: "home", label: t("store.nav.home"), url: "/" },
            { id: "properties", label: t("store.nav.properties"), url: "/" }
        ]
        : [
            { id: "home", label: t("store.nav.home"), url: "/" },
            { id: "products", label: t("store.nav.products"), url: "/productos" }
        ]
    const menuItems = headerSettings.menuItems || defaultMenuItems

    // Typography
    const fontFamily = typographySettings.fontFamily || "Inter"

    // Cargar configuración de envío
    useEffect(() => {
        const loadShippingConfig = async () => {
            try {
                const response = await fetch(`/api/store/${slug}/shipping-config`)
                if (response.ok) {
                    const rawConfig = await response.json() as Omit<ShippingConfig, "default_shipping_rate"> & {
                        default_shipping_rate: number | null
                    }

                    const config: ShippingConfig = {
                        ...rawConfig,
                        default_shipping_rate: rawConfig.default_shipping_rate ?? 0,
                    }

                    setShippingConfig(config)
                }
            } catch (error) {
                console.error('Error loading shipping config:', error)
            }
        }
        loadShippingConfig()
    }, [slug])

    // Detectar action=chat en la URL
    useEffect(() => {
        const action = searchParams.get('action')
        const productId = searchParams.get('product')
        const context = searchParams.get('context')

        if (action === 'chat') {
            // Verificar si ya está identificado (con validación de UUID)
            const customerId = getStoredUUID(`customer_${organization.slug}`)

            if (customerId) {
                // Ya identificado, ir directamente al chat
                let chatUrl = getChatUrl(isSubdomain, organization.slug, isRealEstate)
                const params = new URLSearchParams()
                if (productId) params.set('product', productId)
                if (context) params.set('context', context)
                if (params.toString()) chatUrl += `?${params.toString()}`

                router.push(chatUrl)
            } else {
                // No identificado, guardar contexto y mostrar modal
                const frameId = window.requestAnimationFrame(() => {
                    if (productId) setPendingProductId(productId)
                    if (context) setPendingContext(context)
                    setShowGateModal(true)
                })

                return () => window.cancelAnimationFrame(frameId)
            }
        }
    }, [searchParams, organization.slug, router, isSubdomain, isRealEstate])

    const handleStartChat = (productId?: string, query?: string, attributionParams?: Record<string, string>) => {
        // Verificar si ya está identificado (con validación de UUID)
        const customerId = getStoredUUID(`customer_${organization.slug}`)
        const effectiveProductId = productId || defaultChatProductId

        if (customerId) {
            // Ya identificado, ir al chat
            // Se mantiene el chatId anterior para continuar la conversación

            let chatUrl = getChatUrl(isSubdomain, organization.slug, isRealEstate)
            const params = new URLSearchParams()
            if (effectiveProductId) params.set('product', effectiveProductId)
            if (query) params.set('context', query)
            Object.entries(attributionParams ?? {}).forEach(([key, value]) => {
                params.set(key, value)
            })
            if (params.toString()) chatUrl += `?${params.toString()}`

            router.push(chatUrl)
        } else {
            // Guardar producto y contexto pendientes si existen
            if (effectiveProductId) setPendingProductId(effectiveProductId)
            if (query) setPendingContext(query)
            // Mostrar modal de identificación
            setShowGateModal(true)
        }
    }

    const handleCustomerIdentified = (customer: IdentifiedCustomer) => {
        // Guardar en localStorage (con validación)
        setStoredUUID(`customer_${organization.slug}`, customer.id)
        setStoredString(`customer_name_${organization.slug}`, customer.full_name)

        // Identificar en PostHog
        const posthog = ensurePosthog()
        if (posthog) {
            const posthogPersonProperties: Record<string, string> = {
                name: customer.full_name,
                phone: customer.phone
            }

            if (typeof customer.email === "string" && customer.email.length > 0) {
                posthogPersonProperties.email = customer.email
            }

            posthog.identify(customer.id, {
                ...posthogPersonProperties
            })
        }

        // Se mantiene el chatId anterior si existe para continuar la conversación

        // Cerrar modal e ir al chat
        setShowGateModal(false)

        // Construir URL del chat con producto y contexto si existen
        let chatUrl = getChatUrl(isSubdomain, organization.slug, isRealEstate)
        const params = new URLSearchParams()
        if (pendingProductId) params.set('product', pendingProductId)
        if (pendingContext) params.set('context', pendingContext)
        if (params.toString()) chatUrl += `?${params.toString()}`

        router.push(chatUrl)
    }

    // Feature Flag for Storefront 2.0
    // Desactivado temporalmente mientras implementamos checkout conversacional
    const USE_CONVERSATIONAL_LAYOUT = false

    const content = (
        <div className="min-h-screen bg-white dark:bg-gray-950 text-slate-900 dark:text-slate-100" style={{ fontFamily: fontFamily }}>
            {/* --- Header --- */}
            {!hideNavigation && (
                <EnhancedStoreHeader
                    slug={slug}
                    organization={organization}
                    onStartChat={handleStartChat}
                    primaryColor={primaryColor}
                    showStoreName={showStoreName}
                    menuItems={menuItems}
                    hideOnMobile={hideHeaderOnMobile}
                    shippingConfig={headerShippingConfig}
                    isRealEstate={isRealEstate}
                    hideMenu={productDetailCRO?.landingMode?.hideMenu}
                    hideSearch={productDetailCRO?.landingMode?.hideSearch}
                    hideProfile={productDetailCRO?.landingMode?.hideProfile}
                    hideAnnouncementBar={productDetailCRO?.landingMode?.hideAnnouncementBar}
                />
            )}

            <main>
                {children ? children : (
                    <TemplateRenderer
                        template={selectedTemplate}
                        organization={organization}
                        products={productsToUse}
                        properties={properties}
                        badges={badges}
                        pages={pages}
                        primaryColor={primaryColor}
                        heroSettings={heroSettings}
                        onStartChat={handleStartChat}
                        isSubdomain={isSubdomain}
                    />
                )}
            </main>

            {/* Footer — solo cuando hay children (páginas internas); las templates incluyen el suyo propio */}
            {children && !isRealEstate && (
                <StoreFooter
                    organization={organization}
                    pages={pages}
                    isSubdomain={isSubdomain}
                />
            )}

            {/* Customer Gate Modal */}
            <CustomerGateModal
                isOpen={showGateModal}
                onClose={() => setShowGateModal(false)}
                slug={slug}
                onIdentified={handleCustomerIdentified}
            />

            {/* Cart y Checkout solo para e-commerce */}
            {!isRealEstate && (
                <>
                    <CartDrawer
                        slug={slug}
                        primaryColor={primaryColor}
                        shippingConfig={shippingConfig}
                        onCheckout={() => {
                            setCartOpen(false)
                            router.push(getStoreLink('/checkout', isSubdomain, slug))
                        }}
                    />
                </>
            )}

            {/* Presence Tracking */}
            <StorePresence slug={organization.slug} />

            {/* Floating WhatsApp/Chat Button - Only show if NOT in Conversational Layout */}
            {!USE_CONVERSATIONAL_LAYOUT && (
                <div className="fixed bottom-6 right-6 z-50">
                    {organization.settings?.whatsapp?.phone ? (
                        <a
                            href={`https://wa.me/${organization.settings.whatsapp.phone.replace(/\D/g, '')}?text=${encodeURIComponent(t("store.whatsapp.greeting"))}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-white shadow-lg shadow-green-500/30 transition-transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-green-300"
                            aria-label={t("store.whatsapp.contact_aria")}
                        >
                            <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                <title>WhatsApp</title>
                            </svg>
                        </a>
                    ) : (
                        <button
                            onClick={() => handleStartChat()}
                            className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-blue-300"
                            style={{ backgroundColor: primaryColor }}
                            aria-label={t("store.chat.start_aria")}
                        >
                            <span className="material-symbols-outlined text-3xl">chat</span>
                        </button>
                    )}
                </div>
            )}

            {!USE_CONVERSATIONAL_LAYOUT && !isRealEstate && defaultChatProductId && !showGateModal && (
                <ProactiveChatBubble
                    slug={slug}
                    productId={defaultChatProductId}
                    productName={defaultChatProductName}
                    primaryColor={primaryColor}
                    onStartChat={handleStartChat}
                    whatsappPhone={organization.settings?.whatsapp?.phone}
                    agentName={organization.settings?.agent?.name}
                    agentAvatar={organization.settings?.agent?.avatar}
                    couponOffer={proactiveCouponOffer}
                />
            )}
        </div>
    )

    if (USE_CONVERSATIONAL_LAYOUT) {
        return (
            <ConversationalLayout
                chatPanel={
                    <EmbeddableChat
                        mode="embedded"
                        className="w-full h-full border-none shadow-none"
                        initialContext={pendingContext || undefined}
                    />
                }
                productTray={
                    <ProductStoryTray
                        products={productsToUse}
                        primaryColor={primaryColor}
                        onProductSelect={(prod) => handleStartChat(prod.id, `Me interesa el producto ${prod.name}`)}
                    />
                }
            >
                {content}
            </ConversationalLayout>
        )
    }

    return content
}
