"use client"

import { useState, useEffect, type ReactNode } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { CustomerGateModal } from "@/components/store/customer-gate-modal"
import { TemplateRenderer } from "@/components/store/templates/template-renderer"
import { EnhancedStoreHeader } from "@/components/store/enhanced-store-header"
import { useIsSubdomain } from "@/hooks/use-is-subdomain"
import { getChatUrl } from "@/lib/utils/store-urls"
import { getStoredUUID, setStoredUUID, setStoredString } from "@/lib/utils/storage"
import { StorePresence } from "@/components/store/store-presence"
import { CartDrawer } from "@/app/chat/components/cart-drawer"
import { ensurePosthog } from "@/lib/analytics/posthog-client"
import { CheckoutModal } from "@/app/chat/components/checkout-modal"
import { useCartStore } from "@/store/cart-store"
import { useTrackingParams } from "@/hooks/use-tracking-params"
import { ConversationalLayout } from "@/components/store/layouts/conversational-layout"
import { EmbeddableChat } from "@/components/chat/embeddable-chat"
import { ProductStoryTray } from "@/components/store/product-story-tray"
import { getSafeStorefrontTemplate, isRealEstateIndustry } from "@/lib/storefront-templates"
import type { Organization } from "@/types/organization"
import { normalizeStorefrontTemplateVersion, type StorefrontHeroSliderProduct, type StorefrontProperty, type StorefrontViewModel } from "@/types/storefront"

interface StoreMenuItem {
    id: string
    label: string
    url: string
    openInNewTab?: boolean
    children?: StoreMenuItem[]
}

interface StoreProduct {
    id: string
    name: string
    price: number
    image_url: string
    slug: string
    [key: string]: unknown
}

type StoreProperty = StorefrontProperty

interface StoreShippingConfig {
    free_shipping_enabled: boolean
    free_shipping_min_amount: number | null
    free_shipping_zones: string[] | null
    default_shipping_rate: number
}

type HeaderLogoSize = "sm" | "md" | "lg" | "xl"

interface HeaderSettings {
    showStoreName?: boolean
    menuItems?: StoreMenuItem[]
    logoSize?: HeaderLogoSize
}

interface TypographySettings {
    fontFamily?: string
}

interface IdentifiedCustomer {
    id: string
    full_name: string
    phone: string
    email?: string | null
}

interface StoreLayoutOrganization extends Pick<Organization, "slug" | "name" | "industry" | "logo_url"> {
    settings?: {
        branding?: {
            primaryColor?: string
        } | null
        storefront?: {
            template?: string
            templateVersion?: StorefrontViewModel["tenant"]["templateVersion"]
            hero?: Record<string, unknown>
            typography?: TypographySettings | null
            header?: HeaderSettings | null
        } | null
        whatsapp?: {
            phone?: string | null
        } | null
    } | null
}

interface StoreLayoutClientProps {
    slug: string
    organization: StoreLayoutOrganization
    products: StoreProduct[]
    heroSliderProducts?: StorefrontHeroSliderProduct[]
    storefrontViewModel?: StorefrontViewModel
    properties?: StoreProperty[]
    badges?: unknown[]
    pages?: Array<{ id: string; slug: string; title: string }>
    children?: ReactNode
    hideNavigation?: boolean
    hideHeaderOnMobile?: boolean
    initialIsSubdomain?: boolean
    defaultChatProductId?: string
}

export function StoreLayoutClient({ slug, organization, products, heroSliderProducts = [], storefrontViewModel, properties = [], badges = [], pages = [], children, hideNavigation = false, hideHeaderOnMobile = false, initialIsSubdomain = false, defaultChatProductId }: StoreLayoutClientProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const clientIsSubdomain = useIsSubdomain()
    const isSubdomain = initialIsSubdomain || clientIsSubdomain
    const [showGateModal, setShowGateModal] = useState(false)

    // --- DUMMY DATA FOR TESTING UI (If no products found) ---
    const productsToUse = products
    // --------------------------------------------------------

    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
    const [pendingProductId, setPendingProductId] = useState<string | null>(null)
    const [pendingContext, setPendingContext] = useState<string | null>(null)
    const [shippingConfig, setShippingConfig] = useState<StoreShippingConfig | null>(null)
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
    const typographySettings: TypographySettings = storefrontSettings.typography || {}
    const headerSettings: HeaderSettings = storefrontSettings.header || {}
    const selectedTemplate = getSafeStorefrontTemplate(storefrontSettings.template, organization)
    const templateVersion = storefrontViewModel?.tenant.templateVersion || normalizeStorefrontTemplateVersion(storefrontSettings.templateVersion)
    const templateKey = storefrontViewModel?.tenant.templateKey || selectedTemplate
    const showTemplateVersionBadge = process.env.NODE_ENV !== "production" && templateVersion === "v2"
    const showStoreName = headerSettings.showStoreName ?? true
    const headerLogoSize = headerSettings.logoSize
    const headerVisualVariant = templateKey === "complete" && templateVersion === "v2" ? "glass" : "default"
    const headerShippingConfig = shippingConfig
        ? {
            free_shipping_enabled: shippingConfig.free_shipping_enabled,
            free_shipping_min_amount: shippingConfig.free_shipping_min_amount ?? undefined,
            default_shipping_rate: shippingConfig.default_shipping_rate,
        }
        : undefined

    // Defaults de menú según vertical (el admin puede personalizar)
    const defaultMenuItems = isRealEstate
        ? [
            { id: "home", label: "Inicio", url: "/" },
            { id: "properties", label: "Propiedades", url: "/" }
        ]
        : [
            { id: "home", label: "Inicio", url: "/" },
            { id: "products", label: "Productos", url: "/productos" }
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
                    const config = await response.json() as Partial<StoreShippingConfig>
                    setShippingConfig({
                        free_shipping_enabled: Boolean(config.free_shipping_enabled),
                        free_shipping_min_amount: typeof config.free_shipping_min_amount === "number" ? config.free_shipping_min_amount : null,
                        free_shipping_zones: Array.isArray(config.free_shipping_zones)
                            ? config.free_shipping_zones.filter((zone): zone is string => typeof zone === "string")
                            : null,
                        default_shipping_rate: typeof config.default_shipping_rate === "number" ? config.default_shipping_rate : 0,
                    })
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

        if (action !== 'chat') {
            return
        }

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
            return
        }

        const frameId = window.requestAnimationFrame(() => {
            if (productId) setPendingProductId(productId)
            if (context) setPendingContext(context)
            setShowGateModal(true)
        })

        return () => window.cancelAnimationFrame(frameId)
    }, [searchParams, organization.slug, router, isSubdomain, isRealEstate])

    const handleStartChat = (productId?: string, query?: string) => {
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
            posthog.identify(customer.id, {
                email: customer.email,
                name: customer.full_name,
                phone: customer.phone
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
        <div className="min-h-screen bg-white dark:bg-gray-950 text-slate-900 dark:text-slate-100" style={{ fontFamily: fontFamily }} data-template-key={templateKey} data-template-version={templateVersion}>
            {showTemplateVersionBadge && (
                <div className="fixed bottom-4 left-4 z-[60] rounded-full border border-primary/30 bg-white/95 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary shadow-lg backdrop-blur dark:bg-gray-950/95">
                    Preview local · {templateKey} · v2
                </div>
            )}
            {/* --- Header --- */}
            {!hideNavigation && (
                <EnhancedStoreHeader
                    slug={slug}
                    organization={organization}
                    onStartChat={(query) => handleStartChat(undefined, query)}
                    primaryColor={primaryColor}
                    showStoreName={showStoreName}
                    menuItems={menuItems}
                    hideOnMobile={hideHeaderOnMobile}
                    shippingConfig={headerShippingConfig}
                    logoSize={headerLogoSize}
                    isRealEstate={isRealEstate}
                    visualVariant={headerVisualVariant}
                />
            )}

            <main>
                {children ? children : (
                    <TemplateRenderer
                        template={selectedTemplate}
                        organization={organization}
                        products={productsToUse}
                        heroSliderProducts={heroSliderProducts}
                        storefrontViewModel={storefrontViewModel}
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

            {/* Customer Gate Modal */}
            <CustomerGateModal
                isOpen={showGateModal}
                onClose={() => setShowGateModal(false)}
                slug={slug}
                organizationName={organization.name}
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
                            setIsCheckoutOpen(true)
                        }}
                    />

                    {isCheckoutOpen && (
                        <CheckoutModal
                            isOpen={isCheckoutOpen}
                            onClose={() => setIsCheckoutOpen(false)}
                            slug={slug}
                        />
                    )}
                </>
            )}

            {/* Presence Tracking */}
            <StorePresence slug={organization.slug} />

            {/* Floating WhatsApp/Chat Button - Only show if NOT in Conversational Layout */}
            {!USE_CONVERSATIONAL_LAYOUT && (
                <div className="fixed bottom-6 right-6 z-50">
                    {organization.settings?.whatsapp?.phone ? (
                        <a
                            href={`https://wa.me/${organization.settings.whatsapp.phone.replace(/\D/g, '')}?text=${encodeURIComponent('Hola, me gustaría obtener información')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-white shadow-lg shadow-green-500/30 transition-transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-green-300"
                            aria-label="Contactar por WhatsApp"
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
                            aria-label="Iniciar chat"
                        >
                            <span className="material-symbols-outlined text-3xl">chat</span>
                        </button>
                    )}
                </div>
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
