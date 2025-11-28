"use client"

import { useState, useEffect } from "react"
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

export function ProductSectionEditor({ organization }: ProductSectionEditorProps) {
    const [loading, setLoading] = useState(false)
    const [categories, setCategories] = useState<string[]>([])
    const defaultConfig = {
        showSection: true,
        itemsToShow: 8,
        orderBy: "recent",
        showPrices: true,
        showAddToCart: true,
        showAIRecommended: false,
        categories: {
            enabled: true,
            selected: []
        }
    }

    const [config, setConfig] = useState(
        organization.settings?.storefront?.products || defaultConfig
    )

    // Load categories from products
    useEffect(() => {
        const loadCategories = async () => {
            try {
                const response = await fetch(`/api/store/${organization.slug}/categories`)
                const data = await response.json()
                if (data.categories) {
                    setCategories(data.categories)
                }
            } catch (error) {
                console.error("Error loading categories:", error)
            }
        }
        loadCategories()
    }, [organization.slug])

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
        <Card className="bg-white dark:bg-gray-900/50 border-gray-200 dark:border-gray-800">
            <CardHeader className="pb-6">
                <CardTitle className="text-xl font-bold text-[#1F2937] dark:text-white">Sección de Productos</CardTitle>
                <CardDescription className="text-base text-[#6B7280] dark:text-gray-400">
                    Configura cómo se muestran los productos en el grid de tu tienda
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Show Section Toggle */}
                <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-800 rounded-xl">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center size-10 rounded-lg bg-gray-100 dark:bg-gray-800">
                            <span className="material-symbols-outlined text-2xl text-[#1F2937] dark:text-gray-300">visibility</span>
                        </div>
                        <p className="font-medium text-base text-[#1F2937] dark:text-gray-200">Mostrar sección de productos</p>
                    </div>
                    <Switch
                        checked={config.showSection}
                        onCheckedChange={(checked) => setConfig({ ...config, showSection: checked })}
                    />
                </div>

                <div className="h-px bg-gray-200 dark:border-gray-800" />

                {/* Items to Show */}
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                        <Label className="text-sm font-medium text-[#1F2937] dark:text-gray-300">Cantidad a mostrar</Label>
                        <p className="text-sm text-[#6B7280] dark:text-gray-400 mt-1">Elige cuántos productos se verán por página.</p>
                    </div>
                    <Select
                        value={config.itemsToShow.toString()}
                        onValueChange={(value) => setConfig({ ...config, itemsToShow: parseInt(value) })}
                    >
                        <SelectTrigger className="max-w-[200px] bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700">
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
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                        <Label className="text-sm font-medium text-[#1F2937] dark:text-gray-300">Ordenar por</Label>
                        <p className="text-sm text-[#6B7280] dark:text-gray-400 mt-1">Define el orden de aparición de los productos.</p>
                    </div>
                    <Select
                        value={config.orderBy}
                        onValueChange={(value) => setConfig({ ...config, orderBy: value })}
                    >
                        <SelectTrigger className="max-w-[200px] bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700">
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
                    <p className="font-medium text-base text-[#1F2937] dark:text-gray-200">Mostrar precios</p>
                    <Switch
                        checked={config.showPrices}
                        onCheckedChange={(checked) => setConfig({ ...config, showPrices: checked })}
                    />
                </div>

                {/* Show Add to Cart */}
                <div className="flex items-center justify-between">
                    <p className="font-medium text-base text-[#1F2937] dark:text-gray-200">Mostrar botón "Agregar al carrito"</p>
                    <Switch
                        checked={config.showAddToCart}
                        onCheckedChange={(checked) => setConfig({ ...config, showAddToCart: checked })}
                    />
                </div>

                {/* Show AI Recommended */}
                <div className="flex items-center justify-between">
                    <p className="font-medium text-base text-[#1F2937] dark:text-gray-200">Mostrar badge "Recomendado por IA"</p>
                    <Switch
                        checked={config.showAIRecommended}
                        onCheckedChange={(checked) => setConfig({ ...config, showAIRecommended: checked })}
                    />
                </div>

                <div className="h-px bg-gray-200 dark:border-gray-800 my-6" />

                {/* Categories Navigation */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-800 rounded-xl">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center justify-center size-10 rounded-lg bg-gray-100 dark:bg-gray-800">
                                <span className="material-symbols-outlined text-2xl text-[#1F2937] dark:text-gray-300">category</span>
                            </div>
                            <p className="font-medium text-base text-[#1F2937] dark:text-gray-200">Mostrar navegación por categorías</p>
                        </div>
                        <Switch
                            checked={config.categories.enabled}
                            onCheckedChange={(checked) => setConfig({
                                ...config,
                                categories: { ...config.categories, enabled: checked }
                            })}
                        />
                    </div>

                    {config.categories.enabled && categories.length > 0 && (
                        <div className="pl-0 space-y-3">
                            <p className="text-sm font-medium text-[#1F2937] dark:text-gray-300">Selecciona las categorías a mostrar:</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {categories.map((category) => (
                                    <label
                                        key={category}
                                        className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                    >
                                        <input
                                            type="checkbox"
                                            className="form-checkbox h-5 w-5 rounded text-primary border-gray-300 dark:border-gray-600 focus:ring-primary"
                                            checked={(config.categories.selected || []).includes(category)}
                                            onChange={() => toggleCategory(category)}
                                        />
                                        <span className="text-sm capitalize text-[#1F2937] dark:text-gray-300">
                                            {category}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {config.categories.enabled && categories.length === 0 && (
                        <div className="pl-0 py-4 text-center text-sm text-[#6B7280] dark:text-gray-400">
                            No hay categorías disponibles. Agrega categorías a tus productos.
                        </div>
                    )}
                </div>

                <Button
                    onClick={handleSave}
                    disabled={loading}
                    className="w-full h-12 bg-primary hover:bg-primary/90 text-white text-base font-bold mt-6"
                >
                    {loading ? "Guardando..." : "Guardar Configuración"}
                </Button>
            </CardContent>
        </Card>
    )
}
