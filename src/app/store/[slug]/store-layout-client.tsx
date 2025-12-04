"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { CustomerGateModal } from "@/components/store/customer-gate-modal"
import { TemplateRenderer } from "@/components/store/templates/template-renderer"
import { StoreHeader } from "@/components/store/store-header"
import { useIsSubdomain } from "@/hooks/use-is-subdomain"
import { getChatUrl } from "@/lib/utils/store-urls"

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
    const [pendingProductId, setPendingProductId] = useState<string | null>(null)
    const [pendingContext, setPendingContext] = useState<string | null>(null)

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

    const handleStartChat = (productId?: string) => {
        // Verificar si ya está identificado
        const customerId = localStorage.getItem(`customer_${organization.slug}`)

        if (customerId) {
            // Ya identificado, ir al chat
            let chatUrl = getChatUrl(isSubdomain, organization.slug)
            if (productId) chatUrl += `?product=${productId}`
            router.push(chatUrl)
        } else {
            // Guardar producto pendiente si existe
            if (productId) {
                setPendingProductId(productId)
            }
            // Mostrar modal de identificación
            setShowGateModal(true)
        }
    }

    const handleCustomerIdentified = (customer: any) => {
        // Guardar en localStorage
        localStorage.setItem(`customer_${organization.slug}`, customer.id)
        localStorage.setItem(`customer_name_${organization.slug}`, customer.full_name)

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
                <StoreHeader
                    slug={slug}
                    organization={organization}
                    onStartChat={() => handleStartChat()}
                    primaryColor={primaryColor}
                    showStoreName={showStoreName}
                    hideOnMobile={hideHeaderOnMobile}
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
        </div>
    )
}
