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


interface StoreLayoutClientProps {
    slug: string
    organization: any
    products: any[]
    children?: React.ReactNode
    hideNavigation?: boolean
    hideHeaderOnMobile?: boolean
    initialIsSubdomain?: boolean
}

export function StoreLayoutClient({ slug, organization, products, children, hideNavigation = false, hideHeaderOnMobile = false, initialIsSubdomain = false }: StoreLayoutClientProps) {
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

    return (
        <div className="min-h-screen bg-white text-slate-900" style={{ fontFamily: fontFamily }}>
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
        </div>
    )
}
