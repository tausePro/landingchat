"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
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
        <Card>
            <CardHeader>
                <CardTitle>Características del Producto</CardTitle>
                <CardDescription>
                    Configura los badges que aparecen debajo del botón "Iniciar chat"
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-4">
                    {features.map((feature, index) => (
                        <div key={index} className="flex items-start gap-4 p-4 border rounded-lg">
                            <div className="flex-1 space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-24">
                                        <Label className="text-xs">Ícono</Label>
                                        <Input
                                            value={feature.icon}
                                            onChange={(e) => handleIconChange(index, e.target.value)}
                                            className="h-9 text-sm"
                                            placeholder="check_circle"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <Label className="text-xs">Título</Label>
                                        <Input
                                            value={feature.title}
                                            onChange={(e) => handleTitleChange(index, e.target.value)}
                                            className="h-9"
                                            placeholder="Ej: Envío Gratis"
                                        />
                                    </div>
                                    <div className="flex flex-col items-center gap-1 pt-5">
                                        <Switch
                                            checked={feature.enabled}
                                            onCheckedChange={() => handleToggle(index)}
                                        />
                                        <span className="text-xs text-muted-foreground">
                                            {feature.enabled ? "Activo" : "Inactivo"}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <span className="material-symbols-outlined text-lg">{feature.icon}</span>
                                    <span>{feature.title}</span>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveFeature(index)}
                                className="text-red-500 hover:text-red-700"
                            >
                                <span className="material-symbols-outlined">delete</span>
                            </Button>
                        </div>
                    ))}
                </div>

                <Button
                    variant="outline"
                    onClick={handleAddFeature}
                    className="w-full"
                >
                    <span className="material-symbols-outlined mr-2">add</span>
                    Agregar Característica
                </Button>

                <Button onClick={handleSave} disabled={loading} className="w-full">
                    {loading ? "Guardando..." : "Guardar Configuración"}
                </Button>

                <div className="pt-4 border-t">
                    <p className="text-xs text-muted-foreground">
                        💡 <strong>Tip:</strong> Usa íconos de Material Symbols.
                        <a href="https://fonts.google.com/icons" target="_blank" rel="noopener" className="text-primary hover:underline ml-1">
                            Ver catálogo de íconos
                        </a>
                    </p>
                </div>
            </CardContent>
        </Card>
    )
}
