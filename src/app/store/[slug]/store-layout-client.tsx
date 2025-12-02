"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { CustomerGateModal } from "@/components/store/customer-gate-modal"
import { TemplateRenderer } from "@/components/store/templates/template-renderer"
import { StoreHeader } from "@/components/store/store-header"

interface StoreLayoutClientProps {
    slug: string
    organization: any
    products: any[]
    children?: React.ReactNode
    hideNavigation?: boolean
    hideHeaderOnMobile?: boolean
}

export function StoreLayoutClient({ slug, organization, products, children, hideNavigation = false, hideHeaderOnMobile = false }: StoreLayoutClientProps) {
    const router = useRouter()
    const [showGateModal, setShowGateModal] = useState(false)
    const [pendingProductId, setPendingProductId] = useState<string | null>(null)

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

    const handleStartChat = (productId?: string) => {
        // Verificar si ya está identificado
        const customerId = localStorage.getItem(`customer_${slug}`)

        if (customerId) {
            // Ya identificado, ir al chat
            const chatUrl = productId
                ? `/chat/${slug}?product=${productId}`
                : `/chat/${slug}`
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
        localStorage.setItem(`customer_${slug}`, customer.id)
        localStorage.setItem(`customer_name_${slug}`, customer.full_name)

        // Cerrar modal e ir al chat
        setShowGateModal(false)

        const chatUrl = pendingProductId
            ? `/chat/${slug}?product=${pendingProductId}`
            : `/chat/${slug}`

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
