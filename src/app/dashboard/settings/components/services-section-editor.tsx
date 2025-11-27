"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { updateOrganization } from "../actions"

interface ServicesSectionEditorProps {
    organization: {
        id: string
        name: string
        slug: string
        settings: any
    }
}

export function ServicesSectionEditor({ organization }: ServicesSectionEditorProps) {
    const [loading, setLoading] = useState(false)
    const defaultConfig = {
        showSection: true,
        itemsToShow: 6,
        orderBy: "recent",
        showPrices: true,
        showBookButton: true,
        showDuration: true
    }

    const [config, setConfig] = useState(
        organization.settings?.storefront?.services || defaultConfig
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
                        services: config
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
                <CardTitle className="text-xl font-bold text-[#1F2937] dark:text-white">Sección de Servicios</CardTitle>
                <CardDescription className="text-base text-[#6B7280] dark:text-gray-400">
                    Configura cómo se muestran los servicios en tu tienda
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Show Section Toggle */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center size-10 rounded-lg bg-gray-100">
                            <span className="material-symbols-outlined text-2xl">work</span>
                        </div>
                        <p className="font-medium">Mostrar sección de servicios</p>
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
                        <p className="text-sm text-muted-foreground">Elige cuántos servicios se verán por página.</p>
                    </div>
                    <Select
                        value={config.itemsToShow.toString()}
                        onValueChange={(value) => setConfig({ ...config, itemsToShow: parseInt(value) })}
                    >
                        <SelectTrigger className="max-w-xs w-32">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="3">3 servicios</SelectItem>
                            <SelectItem value="6">6 servicios</SelectItem>
                            <SelectItem value="9">9 servicios</SelectItem>
                            <SelectItem value="12">12 servicios</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Order By */}
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        <Label className="text-sm font-medium">Ordenar por</Label>
                        <p className="text-sm text-muted-foreground">Define el orden de aparición de los servicios.</p>
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
                            <SelectItem value="popular">Más populares</SelectItem>
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

                {/* Show Book Button */}
                <div className="flex items-center justify-between">
                    <p className="font-medium">Mostrar botón "Reservar"</p>
                    <Switch
                        checked={config.showBookButton}
                        onCheckedChange={(checked) => setConfig({ ...config, showBookButton: checked })}
                    />
                </div>

                {/* Show Duration */}
                <div className="flex items-center justify-between">
                    <p className="font-medium">Mostrar duración del servicio</p>
                    <Switch
                        checked={config.showDuration}
                        onCheckedChange={(checked) => setConfig({ ...config, showDuration: checked })}
                    />
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
