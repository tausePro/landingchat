"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { updateOrganization } from "../actions"

interface ProductSectionEditorProps {
    organization: {
        id: string
        name: string
        slug: string
        settings: any
    }
}

const DEFAULT_CATEGORIES = ["ropa", "calzado", "accesorios", "tecnologia", "hogar"]

export function ProductSectionEditor({ organization }: ProductSectionEditorProps) {
    const [loading, setLoading] = useState(false)
    const defaultConfig = {
        showSection: true,
        itemsToShow: 8,
        orderBy: "recent",
        showPrices: true,
        showAddToCart: true,
        showAIRecommended: false,
        categories: {
            enabled: true,
            selected: ["ropa", "calzado", "accesorios", "hogar"]
        }
    }

    const [config, setConfig] = useState(
        organization.settings?.storefront?.products || defaultConfig
    )

    const handleSave = async () => {
        setLoading(true)
        try {
            await updateOrganization({
                ...organization,
                settings: {
                    ...organization.settings,
                    storefront: {
                        ...organization.settings?.storefront,
                        products: config
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

    const toggleCategory = (category: string) => {
        const selected = config.categories.selected || []
        const newSelected = selected.includes(category)
            ? selected.filter((c: string) => c !== category)
            : [...selected, category]

        setConfig({
            ...config,
            categories: {
                ...config.categories,
                selected: newSelected
            }
        })
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Sección de Productos</CardTitle>
                <CardDescription>
                    Configura cómo se muestran los productos en el grid de tu tienda
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Show Section Toggle */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center size-10 rounded-lg bg-gray-100">
                            <span className="material-symbols-outlined text-2xl">visibility</span>
                        </div>
                        <p className="font-medium">Mostrar sección de productos</p>
                    </div>
                    <Switch
                        checked={config.showSection}
                        onCheckedChange={(checked) => setConfig({ ...config, showSection: checked })}
                    />
                </div>

                <div className="h-px bg-gray-200" />

                {/* Items to Show */}
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        <Label className="text-sm font-medium">Cantidad a mostrar</Label>
                        <p className="text-sm text-muted-foreground">Elige cuántos productos se verán por página.</p>
                    </div>
                    <Select
                        value={config.itemsToShow.toString()}
                        onValueChange={(value) => setConfig({ ...config, itemsToShow: parseInt(value) })}
                    >
                        <SelectTrigger className="max-w-xs w-32">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="4">4 productos</SelectItem>
                            <SelectItem value="6">6 productos</SelectItem>
                            <SelectItem value="8">8 productos</SelectItem>
                            <SelectItem value="12">12 productos</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Order By */}
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        <Label className="text-sm font-medium">Ordenar por</Label>
                        <p className="text-sm text-muted-foreground">Define el orden de aparición de los productos.</p>
                    </div>
                    <Select
                        value={config.orderBy}
                        onValueChange={(value) => setConfig({ ...config, orderBy: value })}
                    >
                        <SelectTrigger className="max-w-xs w-40">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="recent">Más recientes</SelectItem>
                            <SelectItem value="price_asc">Precio menor</SelectItem>
                            <SelectItem value="price_desc">Precio mayor</SelectItem>
                            <SelectItem value="best_selling">Más vendidos</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Show Prices */}
                <div className="flex items-center justify-between">
                    <p className="font-medium">Mostrar precios</p>
                    <Switch
                        checked={config.showPrices}
                        onCheckedChange={(checked) => setConfig({ ...config, showPrices: checked })}
                    />
                </div>

                {/* Show Add to Cart */}
                <div className="flex items-center justify-between">
                    <p className="font-medium">Mostrar botón "Agregar al carrito"</p>
                    <Switch
                        checked={config.showAddToCart}
                        onCheckedChange={(checked) => setConfig({ ...config, showAddToCart: checked })}
                    />
                </div>

                {/* Show AI Recommended */}
                <div className="flex items-center justify-between">
                    <p className="font-medium">Mostrar badge "Recomendado por IA"</p>
                    <Switch
                        checked={config.showAIRecommended}
                        onCheckedChange={(checked) => setConfig({ ...config, showAIRecommended: checked })}
                    />
                </div>

                <div className="h-px bg-gray-200 my-6" />

                {/* Categories Navigation */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center justify-center size-10 rounded-lg bg-gray-100">
                                <span className="material-symbols-outlined text-2xl">category</span>
                            </div>
                            <p className="font-medium">Mostrar navegación por categorías</p>
                        </div>
                        <Switch
                            checked={config.categories.enabled}
                            onCheckedChange={(checked) => setConfig({
                                ...config,
                                categories: { ...config.categories, enabled: checked }
                            })}
                        />
                    </div>

                    {config.categories.enabled && (
                        <div className="pl-14 space-y-3">
                            <p className="text-sm font-medium">Selecciona las categorías a mostrar:</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {DEFAULT_CATEGORIES.map((category) => (
                                    <label
                                        key={category}
                                        className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50 transition-colors"
                                    >
                                        <input
                                            type="checkbox"
                                            className="form-checkbox h-5 w-5 rounded text-primary"
                                            checked={(config.categories.selected || []).includes(category)}
                                            onChange={() => toggleCategory(category)}
                                        />
                                        <span className="text-sm capitalize">
                                            {category === "tecnologia" ? "Tecnología" : category}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <Button onClick={handleSave} disabled={loading} className="w-full mt-6">
                    {loading ? "Guardando..." : "Guardar Configuración"}
                </Button>
            </CardContent>
        </Card>
    )
}
