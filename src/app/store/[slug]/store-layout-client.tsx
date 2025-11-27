"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { CustomerGateModal } from "@/components/store/customer-gate-modal"
import { TemplateRenderer } from "@/components/store/templates/template-renderer"

interface StoreLayoutClientProps {
    slug: string
    organization: any
    products: any[]
}

export function StoreLayoutClient({ slug, organization, products }: StoreLayoutClientProps) {
    const router = useRouter()
    const [showGateModal, setShowGateModal] = useState(false)
    const [pendingProductId, setPendingProductId] = useState<string | null>(null)

    // Branding settings
    const primaryColor = organization.settings?.branding?.primaryColor || "#2b7cee"

    // Storefront customization settings
    const storefrontSettings = organization.settings?.storefront || {}
    const heroSettings = storefrontSettings.hero || {}
    const typographySettings = storefrontSettings.typography || {}
    const selectedTemplate = storefrontSettings.template || "minimal"

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
            <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md">
                <div className="container mx-auto flex h-16 items-center justify-between px-4">
                    <div className="flex items-center gap-2">
                        {organization.logo_url ? (
                            <img src={organization.logo_url} alt={organization.name} className="h-8 w-auto object-contain" />
                        ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white font-bold">
                                {organization.name.substring(0, 1)}
                            </div>
                        )}
                        <span className="text-lg font-bold tracking-tight">{organization.name}</span>
                    </div>
                    <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
                        <a href="#products" className="hover:text-primary transition-colors">Productos</a>
                    </nav>
                    <div className="flex items-center gap-4">
                        <Button
                            onClick={() => handleStartChat()}
                            style={{ backgroundColor: primaryColor }}
                            className="font-bold shadow-lg shadow-blue-500/20"
                        >
                            Iniciar Chat
                        </Button>
                    </div>
                </div>
            </header>

            <main>
                {/* Render Template Dinámicamente */}
                <TemplateRenderer
                    template={selectedTemplate}
                    organization={organization}
                    products={products}
                    primaryColor={primaryColor}
                    heroSettings={heroSettings}
                    onStartChat={handleStartChat}
                />
            </main>

            {/* Customer Gate Modal */}
            <CustomerGateModal
                isOpen={showGateModal}
                onClose={() => setShowGateModal(false)}
                slug={slug}
                organizationId={organization.id}
                organizationSettings={organization.settings}
                onCustomerIdentified={handleCustomerIdentified}
            />
        </div>
    )
}
