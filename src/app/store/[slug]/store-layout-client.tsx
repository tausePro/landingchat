"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { CustomerGateModal } from "@/components/store/customer-gate-modal"
import { TemplateRenderer } from "@/components/store/templates/template-renderer"
import { StoreHeader } from "@/components/store/store-header"
import { EnhancedStoreHeader } from "@/components/store/enhanced-store-header"
import { useIsSubdomain } from "@/hooks/use-is-subdomain"
import { getChatUrl } from "@/lib/utils/store-urls"
import { StorePresence } from "@/components/store/store-presence"
import { CartDrawer } from "@/app/chat/components/cart-drawer"
import { ensurePosthog } from "@/lib/analytics/posthog-client"
import { CheckoutModal } from "@/app/chat/components/checkout-modal"
import { useCartStore } from "@/store/cart-store"
import { useTrackingParams } from "@/hooks/use-tracking-params"
import { ConversationalLayout } from "@/components/store/layouts/conversational-layout"
import { EmbeddableChat } from "@/components/chat/embeddable-chat"
import { ProductStoryTray } from "@/components/store/product-story-tray"

// ... (in render)



interface StoreLayoutClientProps {
    slug: string
    organization: any
    products: any[]
    pages?: Array<{ id: string; slug: string; title: string }>
    children?: React.ReactNode
    hideNavigation?: boolean
    hideHeaderOnMobile?: boolean
    initialIsSubdomain?: boolean
}

export function StoreLayoutClient({ slug, organization, products, pages = [], children, hideNavigation = false, hideHeaderOnMobile = false, initialIsSubdomain = false }: StoreLayoutClientProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const clientIsSubdomain = useIsSubdomain()
    const isSubdomain = initialIsSubdomain || clientIsSubdomain
    const [showGateModal, setShowGateModal] = useState(false)
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
    const [pendingProductId, setPendingProductId] = useState<string | null>(null)
    const [pendingContext, setPendingContext] = useState<string | null>(null)
    const [shippingConfig, setShippingConfig] = useState<any>(null)
    const { setIsOpen: setCartOpen } = useCartStore()

    // Capturar UTM params al entrar a la tienda
    useTrackingParams(slug)

    // Branding settings
    const primaryColor = organization.settings?.branding?.primaryColor || "#2b7cee"

    // Storefront customization settings
    const storefrontSettings = organization.settings?.storefront || {}
    const heroSettings = storefrontSettings.hero || {}
    const typographySettings = storefrontSettings.typography || {}
    const headerSettings = storefrontSettings.header || {}
    const selectedTemplate = storefrontSettings.template || "minimal"
    const showStoreName = headerSettings.showStoreName ?? true

    // Typography
    const fontFamily = typographySettings.fontFamily || "Inter"

    // Cargar configuración de envío
    useEffect(() => {
        const loadShippingConfig = async () => {
            try {
                const response = await fetch(`/api/store/${slug}/shipping-config`)
                if (response.ok) {
                    const config = await response.json()
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
            // Verificar si ya está identificado
            const customerId = localStorage.getItem(`customer_${organization.slug}`)

            if (customerId) {
                // Ya identificado, ir directamente al chat
                let chatUrl = getChatUrl(isSubdomain, organization.slug)
                const params = new URLSearchParams()
                if (productId) params.set('product', productId)
                if (context) params.set('context', context)
                if (params.toString()) chatUrl += `?${params.toString()}`

                router.push(chatUrl)
            } else {
                // No identificado, guardar contexto y mostrar modal
                if (productId) setPendingProductId(productId)
                if (context) setPendingContext(context)
                setShowGateModal(true)
            }
        }
    }, [searchParams, organization.slug, router, isSubdomain])

    const handleStartChat = (productId?: string, query?: string) => {
        // Verificar si ya está identificado
        const customerId = localStorage.getItem(`customer_${organization.slug}`)

        if (customerId) {
            // Ya identificado, ir al chat
            // Se mantiene el chatId anterior para continuar la conversación

            let chatUrl = getChatUrl(isSubdomain, organization.slug)
            const params = new URLSearchParams()
            if (productId) params.set('product', productId)
            if (query) params.set('context', query)
            if (params.toString()) chatUrl += `?${params.toString()}`

            router.push(chatUrl)
        } else {
            // Guardar producto y contexto pendientes si existen
            if (productId) setPendingProductId(productId)
            if (query) setPendingContext(query)
            // Mostrar modal de identificación
            setShowGateModal(true)
        }
    }

    const handleCustomerIdentified = (customer: any) => {
        // Guardar en localStorage
        localStorage.setItem(`customer_${organization.slug}`, customer.id)
        localStorage.setItem(`customer_name_${organization.slug}`, customer.full_name)

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
        let chatUrl = getChatUrl(isSubdomain, organization.slug)
        const params = new URLSearchParams()
        if (pendingProductId) params.set('product', pendingProductId)
        if (pendingContext) params.set('context', pendingContext)
        if (params.toString()) chatUrl += `?${params.toString()}`

        router.push(chatUrl)
    }

    // Feature Flag for Storefront 2.0
    const USE_CONVERSATIONAL_LAYOUT = true

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
                    hideOnMobile={hideHeaderOnMobile}
                    shippingConfig={shippingConfig}
                />
            )}

            <main>
                {children ? children : (
                    <TemplateRenderer
                        template={selectedTemplate}
                        organization={organization}
                        products={products}
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
                        products={products}
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
