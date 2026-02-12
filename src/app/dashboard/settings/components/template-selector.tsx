"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { updateOrganization } from "../actions"
import { useRouter } from "next/navigation"
import { Check } from "lucide-react"

interface TemplateSelectorProps {
    organization: {
        id: string
        name: string
        slug: string
        settings: any
    }
}

const TEMPLATES = [
    {
        id: "minimal",
        name: "Minimal",
        description: "Diseño limpio y simple enfocado en productos",
        preview: "/templates/minimal-preview.png",
        features: ["Hero destacado", "Productos featured", "Footer simple"]
    },
    {
        id: "complete",
        name: "Completo",
        description: "Storefront completo con todas las secciones",
        preview: "/templates/complete-preview.png",
        features: ["Hero", "Cómo funciona", "Características", "Productos", "Testimonios", "Footer"]
    },
    {
        id: "single-product",
        name: "Producto Único",
        description: "Perfecto para destacar un solo producto o servicio",
        preview: "/templates/single-product-preview.png",
        features: ["Hero centrado", "Producto destacado", "Detalles ampliados"]
    },
    {
        id: "services",
        name: "Servicios",
        description: "Optimizado para negocios basados en servicios",
        preview: "/templates/services-preview.png",
        features: ["Hero", "Lista de servicios", "Testimonios", "Contacto"]
    },
    {
        id: "real-estate",
        name: "Inmobiliaria",
        description: "Diseñado para mostrar propiedades con filtros y búsqueda",
        preview: "/templates/real-estate-preview.png",
        features: ["Buscador", "Filtros por tipo/ciudad/precio", "Galería", "Detalle de propiedad"]
    }
]

export function TemplateSelector({ organization }: TemplateSelectorProps) {
    const router = useRouter()
    const currentTemplate = organization.settings?.storefront?.template || "minimal"
    const [selectedTemplate, setSelectedTemplate] = useState(currentTemplate)
    const [isSaving, setIsSaving] = useState(false)

    const handleSave = async () => {
        if (selectedTemplate === currentTemplate) return

        setIsSaving(true)
        try {
            const updatedSettings = {
                ...organization.settings,
                storefront: {
                    ...organization.settings?.storefront,
                    template: selectedTemplate
                }
            }

            await updateOrganization({
                name: organization.name,
                slug: organization.slug,
                settings: updatedSettings
            })

            router.refresh()
        } catch (error) {
            console.error("Error saving template:", error)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark shadow-sm">
                <div className="p-6 border-b border-border-light dark:border-border-dark">
                    <h2 className="text-lg font-semibold">Plantilla del Storefront</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Selecciona el diseño que mejor se adapte a tu negocio
                    </p>
                </div>
                <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {TEMPLATES.map((template) => (
                            <div
                                key={template.id}
                                onClick={() => setSelectedTemplate(template.id)}
                                className={`relative group cursor-pointer rounded-lg border-2 transition-all ${selectedTemplate === template.id
                                        ? "border-primary ring-2 ring-primary ring-offset-2 ring-offset-white dark:ring-offset-gray-900"
                                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                                    }`}
                            >
                                {/* Selected Indicator */}
                                {selectedTemplate === template.id && (
                                    <div className="absolute top-3 right-3 z-10 flex items-center justify-center size-6 rounded-full bg-primary text-white">
                                        <Check className="w-4 h-4" />
                                    </div>
                                )}

                                {/* Template Preview */}
                                <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 rounded-t-lg overflow-hidden">
                                    <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-600">
                                        <span className="text-sm font-medium">{template.name}</span>
                                    </div>
                                </div>

                                {/* Template Info */}
                                <div className="p-4">
                                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                                        {template.name}
                                    </h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                        {template.description}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {template.features.map((feature, idx) => (
                                            <span
                                                key={idx}
                                                className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                                            >
                                                {feature}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Save Button */}
            {selectedTemplate !== currentTemplate && (
                <div className="flex justify-end gap-3 border-t border-border-light dark:border-border-dark pt-6">
                    <Button
                        variant="outline"
                        onClick={() => setSelectedTemplate(currentTemplate)}
                        disabled={isSaving}
                        className="h-10 px-5 text-sm font-semibold"
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="h-10 px-5 text-sm font-semibold bg-primary hover:bg-primary/90"
                    >
                        {isSaving ? "Aplicando..." : "Aplicar Plantilla"}
                    </Button>
                </div>
            )}
        </div>
    )
}
