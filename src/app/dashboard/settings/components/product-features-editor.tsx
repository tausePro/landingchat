"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { updateOrganization } from "../actions"

interface ProductFeaturesEditorProps {
    organization: {
        id: string
        name: string
        slug: string
        settings: any
    }
}

interface ProductFeature {
    icon: string
    title: string
    enabled: boolean
}

const DEFAULT_FEATURES: ProductFeature[] = [
    { icon: "local_shipping", title: "Envío Gratis", enabled: true },
    { icon: "verified_user", title: "Garantía de 1 año", enabled: true },
    { icon: "support_agent", title: "Soporte 24/7", enabled: true },
    { icon: "inventory_2", title: "Stock Disponible", enabled: true }
]

export function ProductFeaturesEditor({ organization }: ProductFeaturesEditorProps) {
    const [loading, setLoading] = useState(false)
    const [features, setFeatures] = useState<ProductFeature[]>(
        organization.settings?.storefront?.productFeatures || DEFAULT_FEATURES
    )

    const handleToggle = (index: number) => {
        const updated = [...features]
        updated[index].enabled = !updated[index].enabled
        setFeatures(updated)
    }

    const handleTitleChange = (index: number, value: string) => {
        const updated = [...features]
        updated[index].title = value
        setFeatures(updated)
    }

    const handleIconChange = (index: number, value: string) => {
        const updated = [...features]
        updated[index].icon = value
        setFeatures(updated)
    }

    const handleAddFeature = () => {
        setFeatures([...features, { icon: "check_circle", title: "Nueva característica", enabled: true }])
    }

    const handleRemoveFeature = (index: number) => {
        setFeatures(features.filter((_, i) => i !== index))
    }

    const handleSave = async () => {
        setLoading(true)
        try {
            await updateOrganization({
                ...organization,
                settings: {
                    ...organization.settings,
                    storefront: {
                        ...organization.settings?.storefront,
                        productFeatures: features
                    }
                }
            })
            alert("Configuración guardada correctamente")
        } catch (error: any) {
            alert(`Error: ${error.message}`)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card className="bg-white dark:bg-gray-900/50 border-gray-200 dark:border-gray-800">
            <CardHeader className="pb-6">
                <CardTitle className="text-xl font-bold text-[#1F2937] dark:text-white">Características del Producto</CardTitle>
                <CardDescription className="text-base text-[#6B7280] dark:text-gray-400">
                    Configura los badges que aparecen debajo del botón "Iniciar chat"
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-6">
                    {features.map((feature, index) => (
                        <div key={index} className="border border-gray-200 dark:border-gray-800 rounded-xl p-6">
                            {/* Input Row */}
                            <div className="grid grid-cols-12 gap-4 items-start mb-4">
                                <div className="col-span-3">
                                    <label className="text-sm font-medium text-[#1F2937] dark:text-gray-300 block mb-2">
                                        Ícono
                                    </label>
                                    <Input
                                        value={feature.icon}
                                        onChange={(e) => handleIconChange(index, e.target.value)}
                                        className="bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700"
                                        placeholder="local_shipping"
                                    />
                                </div>
                                <div className="col-span-6">
                                    <label className="text-sm font-medium text-[#1F2937] dark:text-gray-300 block mb-2">
                                        Título
                                    </label>
                                    <Input
                                        value={feature.title}
                                        onChange={(e) => handleTitleChange(index, e.target.value)}
                                        className="bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700"
                                        placeholder="Ej: Envío Gratis"
                                    />
                                </div>
                                <div className="col-span-2 flex flex-col items-center pt-7">
                                    <Switch
                                        checked={feature.enabled}
                                        onCheckedChange={() => handleToggle(index)}
                                    />
                                    <span className="text-xs text-[#6B7280] dark:text-gray-400 mt-1">
                                        Activo
                                    </span>
                                </div>
                                <div className="col-span-1 flex justify-end pt-7">
                                    <button
                                        onClick={() => handleRemoveFeature(index)}
                                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-xl">delete</span>
                                    </button>
                                </div>
                            </div>

                            {/* Preview Row */}
                            <div className="flex items-center gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                                <span className="material-symbols-outlined text-2xl text-[#1F2937] dark:text-gray-300">
                                    {feature.icon}
                                </span>
                                <span className="text-base font-medium text-[#1F2937] dark:text-gray-200">
                                    {feature.title}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                <button
                    onClick={handleAddFeature}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-gray-200 dark:border-gray-700 rounded-lg text-base font-medium text-[#1F2937] dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                    <span className="material-symbols-outlined text-xl">add</span>
                    Agregar Característica
                </button>

                <Button
                    onClick={handleSave}
                    disabled={loading}
                    className="w-full h-12 bg-primary hover:bg-primary/90 text-white text-base font-bold"
                >
                    {loading ? "Guardando..." : "Guardar Configuración"}
                </Button>

                <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
                    <p className="text-sm text-[#6B7280] dark:text-gray-400">
                        💡 <strong>Tip:</strong> Usa íconos de Material Symbols.{" "}
                        <a
                            href="https://fonts.google.com/icons"
                            target="_blank"
                            rel="noopener"
                            className="text-primary hover:underline"
                        >
                            Ver catálogo de íconos
                        </a>
                    </p>
                </div>
            </CardContent>
        </Card>
    )
}
