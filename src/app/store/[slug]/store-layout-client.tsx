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
import { WhatsAppFloatingButton } from "@/components/store/whatsapp-floating-button"
import { ChatAIFloatingButton } from "@/components/store/chat-ai-floating-button"
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

            {/*
              Botón flotante de contacto.
              - Si el tenant tiene WhatsApp (settings.whatsapp.phone — resuelto
                server-side por enrichOrganizationWithStorefrontContact con
                fallback a whatsapp_instances): WhatsAppFloatingButton.
              - Si no: ChatAIFloatingButton (azul, abre chat IA embebido).
              No se muestra en el layout conversacional (que tiene su propio panel).
              v1.14.2 (2026-05-20): extraído de inline a componentes reutilizables.
            */}
            {!USE_CONVERSATIONAL_LAYOUT && (
                organization.settings?.whatsapp?.phone ? (
                    <WhatsAppFloatingButton
                        phone={organization.settings.whatsapp.phone}
                        greeting={t("store.whatsapp.greeting")}
                        ariaLabel={t("store.whatsapp.contact_aria")}
                    />
                ) : (
                    <ChatAIFloatingButton
                        primaryColor={primaryColor}
                        onClick={() => handleStartChat()}
                        ariaLabel={t("store.chat.start_aria")}
                    />
                )
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
