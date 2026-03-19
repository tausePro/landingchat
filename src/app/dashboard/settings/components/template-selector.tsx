"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { updateOrganization } from "../actions"
import { useRouter } from "next/navigation"
import { Check } from "lucide-react"
import { getAllowedStorefrontTemplates, getSafeStorefrontTemplate } from "@/lib/storefront-templates"
import type { OrganizationSettingsOverrides } from "@/types/organization"
import { normalizeStorefrontTemplateVersion, type StorefrontTemplateVersion } from "@/types/storefront"

interface TemplateSelectorProps {
    organization: {
        id: string
        name: string
        slug: string
        industry?: string | null
        settings: OrganizationSettingsOverrides | null
    }
}

export function TemplateSelector({ organization }: TemplateSelectorProps) {
    const router = useRouter()
    const currentTemplate = getSafeStorefrontTemplate(organization.settings?.storefront?.template, organization)
    const currentTemplateVersion = normalizeStorefrontTemplateVersion(organization.settings?.storefront?.templateVersion)
    const availableTemplates = getAllowedStorefrontTemplates(organization)
    const [selectedTemplate, setSelectedTemplate] = useState(currentTemplate)
    const [selectedTemplateVersion, setSelectedTemplateVersion] = useState<StorefrontTemplateVersion>(currentTemplateVersion)
    const [isSaving, setIsSaving] = useState(false)
    const hasPendingChanges = selectedTemplate !== currentTemplate || selectedTemplateVersion !== currentTemplateVersion
    const selectedVersionLabel = selectedTemplateVersion === "v2" ? "V2 preview" : "V1 estable"
    const supportsVisibleV2Preview = selectedTemplate === "complete" || selectedTemplate === "real-estate"

    const handleSave = async () => {
        if (!hasPendingChanges) return

        setIsSaving(true)
        try {
            const updatedSettings = {
                ...organization.settings,
                storefront: {
                    ...organization.settings?.storefront,
                    template: selectedTemplate,
                    templateVersion: selectedTemplateVersion
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
                        Selecciona el diseño y el rail visual que quieres validar en la tienda
                    </p>
                </div>
                <div className="p-6">
                    <div className="rounded-lg border border-border-light bg-background-light p-4 dark:border-border-dark dark:bg-background-dark">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <p className="text-sm font-semibold text-text-light-primary dark:text-text-dark-primary">
                                    Motor visual activo
                                </p>
                                <p className="mt-1 text-xs text-text-light-secondary dark:text-text-dark-secondary">
                                    Guarda `v1` o `v2` y luego revisa el preview o la tienda pública local.
                                </p>
                            </div>
                            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                                {selectedVersionLabel}
                            </span>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                            <button
                                type="button"
                                onClick={() => setSelectedTemplateVersion("v1")}
                                className={`rounded-lg border px-4 py-3 text-left transition-colors ${selectedTemplateVersion === "v1"
                                        ? "border-primary bg-primary/5"
                                        : "border-border-light bg-card-light hover:bg-background-light dark:border-border-dark dark:bg-card-dark dark:hover:bg-background-dark"
                                    }`}
                            >
                                <p className="text-sm font-semibold text-text-light-primary dark:text-text-dark-primary">V1 estable</p>
                                <p className="mt-1 text-xs text-text-light-secondary dark:text-text-dark-secondary">
                                    Mantiene el storefront actual sin cambios visuales nuevos.
                                </p>
                            </button>

                            <button
                                type="button"
                                onClick={() => setSelectedTemplateVersion("v2")}
                                className={`rounded-lg border px-4 py-3 text-left transition-colors ${selectedTemplateVersion === "v2"
                                        ? "border-primary bg-primary/5"
                                        : "border-border-light bg-card-light hover:bg-background-light dark:border-border-dark dark:bg-card-dark dark:hover:bg-background-dark"
                                    }`}
                            >
                                <p className="text-sm font-semibold text-text-light-primary dark:text-text-dark-primary">V2 preview</p>
                                <p className="mt-1 text-xs text-text-light-secondary dark:text-text-dark-secondary">
                                    Activa el rail nuevo y muestra una señal visual temporal en local para validación.
                                </p>
                            </button>
                        </div>

                        <p className="mt-3 text-xs text-text-light-secondary dark:text-text-dark-secondary">
                            {supportsVisibleV2Preview
                                ? "Esta plantilla ya puede mostrar la validación visual del rail v2 en local."
                                : "Hoy la validación visual fuerte de v2 está enfocada principalmente en `complete` y `real-estate`."}
                        </p>
                    </div>

                    <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
                        {availableTemplates.map((template) => (
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
            {hasPendingChanges && (
                <div className="flex justify-end gap-3 border-t border-border-light dark:border-border-dark pt-6">
                    <Button
                        variant="outline"
                        onClick={() => {
                            setSelectedTemplate(currentTemplate)
                            setSelectedTemplateVersion(currentTemplateVersion)
                        }}
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
                        {isSaving ? "Aplicando..." : "Aplicar cambios"}
                    </Button>
                </div>
            )}
        </div>
    )
}
