"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { updateOrganization } from "../actions"
import { Button } from "@/components/ui/button"
import { ChevronUp, ChevronDown, Trash2, Plus, ExternalLink } from "lucide-react"

interface HeaderEditorProps {
    organization: {
        id: string
        name: string
        slug: string
        settings: any
    }
}

interface MenuItem {
    id: string
    label: string
    url: string
    openInNewTab?: boolean
}

const DEFAULT_MENU_ITEMS: MenuItem[] = [
    { id: "home", label: "Inicio", url: "/" },
    { id: "products", label: "Productos", url: "/productos" }
]

const MAX_MENU_ITEMS = 6

export function HeaderEditor({ organization }: HeaderEditorProps) {
    const [loading, setLoading] = useState(false)
    const [showStoreName, setShowStoreName] = useState(
        organization.settings?.storefront?.header?.showStoreName ?? true
    )
    const [menuItems, setMenuItems] = useState<MenuItem[]>(
        organization.settings?.storefront?.header?.menuItems || DEFAULT_MENU_ITEMS
    )

    // --- Menu item handlers ---
    const handleAddMenuItem = () => {
        if (menuItems.length >= MAX_MENU_ITEMS) return
        setMenuItems([
            ...menuItems,
            {
                id: Math.random().toString(36).substring(2, 9),
                label: "",
                url: "",
                openInNewTab: false
            }
        ])
    }

    const handleRemoveMenuItem = (index: number) => {
        setMenuItems(menuItems.filter((_, i) => i !== index))
    }

    const handleUpdateMenuItem = (index: number, field: keyof MenuItem, value: string | boolean) => {
        const updated = [...menuItems]
        updated[index] = { ...updated[index], [field]: value }
        setMenuItems(updated)
    }

    const handleMoveMenuItem = (index: number, direction: "up" | "down") => {
        const newIndex = direction === "up" ? index - 1 : index + 1
        if (newIndex < 0 || newIndex >= menuItems.length) return
        const updated = [...menuItems]
        const temp = updated[index]
        updated[index] = updated[newIndex]
        updated[newIndex] = temp
        setMenuItems(updated)
    }

    // --- Save ---
    const handleSave = async () => {
        setLoading(true)
        try {
            // Filtrar items vacíos antes de guardar
            const validMenuItems = menuItems.filter(item => item.label.trim() && item.url.trim())

            await updateOrganization({
                ...organization,
                settings: {
                    ...organization.settings,
                    storefront: {
                        ...organization.settings?.storefront,
                        header: {
                            ...organization.settings?.storefront?.header,
                            showStoreName,
                            menuItems: validMenuItems
                        }
                    }
                }
            })
            // Actualizar estado local con items válidos
            setMenuItems(validMenuItems.length > 0 ? validMenuItems : DEFAULT_MENU_ITEMS)
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
                <CardTitle className="text-xl font-bold text-[#1F2937] dark:text-white">Encabezado</CardTitle>
                <CardDescription className="text-base text-[#6B7280] dark:text-gray-400">
                    Personaliza cómo se muestra el encabezado de tu tienda
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Toggle: Mostrar nombre de tienda */}
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label className="text-base">Mostrar Nombre de la Tienda</Label>
                        <p className="text-sm text-muted-foreground">
                            Muestra el nombre junto al logo en el encabezado
                        </p>
                    </div>
                    <Switch
                        checked={showStoreName}
                        onCheckedChange={setShowStoreName}
                    />
                </div>

                {/* Separador */}
                <div className="border-t border-gray-200 dark:border-gray-800" />

                {/* Menú de navegación */}
                <div className="space-y-4">
                    <div>
                        <Label className="text-base font-semibold">Menú de Navegación</Label>
                        <p className="text-sm text-muted-foreground mt-1">
                            Configura los enlaces del menú principal de tu tienda
                        </p>
                    </div>

                    {/* Lista de items */}
                    <div className="space-y-3">
                        {menuItems.map((item, index) => (
                            <div
                                key={item.id}
                                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                            >
                                <div className="flex items-start gap-3">
                                    {/* Botones reordenar */}
                                    <div className="flex flex-col gap-0.5 pt-1">
                                        <button
                                            onClick={() => handleMoveMenuItem(index, "up")}
                                            disabled={index === 0}
                                            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                            aria-label="Mover arriba"
                                        >
                                            <ChevronUp className="w-4 h-4 text-gray-500" />
                                        </button>
                                        <button
                                            onClick={() => handleMoveMenuItem(index, "down")}
                                            disabled={index === menuItems.length - 1}
                                            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                            aria-label="Mover abajo"
                                        >
                                            <ChevronDown className="w-4 h-4 text-gray-500" />
                                        </button>
                                    </div>

                                    {/* Campos */}
                                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">
                                                Etiqueta
                                            </label>
                                            <Input
                                                value={item.label}
                                                onChange={(e) => handleUpdateMenuItem(index, "label", e.target.value)}
                                                placeholder="Ej: Productos"
                                                className="bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">
                                                URL
                                            </label>
                                            <Input
                                                value={item.url}
                                                onChange={(e) => handleUpdateMenuItem(index, "url", e.target.value)}
                                                placeholder="Ej: /productos"
                                                className="bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700"
                                            />
                                        </div>
                                    </div>

                                    {/* Acciones */}
                                    <div className="flex items-center gap-2 pt-1">
                                        <label
                                            className="flex items-center gap-1 cursor-pointer p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                            title="Abrir en nueva pestaña"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={item.openInNewTab || false}
                                                onChange={(e) => handleUpdateMenuItem(index, "openInNewTab", e.target.checked)}
                                                className="sr-only"
                                            />
                                            <ExternalLink
                                                className={`w-4 h-4 ${item.openInNewTab ? "text-primary" : "text-gray-400"}`}
                                            />
                                        </label>
                                        <button
                                            onClick={() => handleRemoveMenuItem(index)}
                                            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                            aria-label="Eliminar enlace"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Botón agregar */}
                    <button
                        onClick={handleAddMenuItem}
                        disabled={menuItems.length >= MAX_MENU_ITEMS}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Agregar Enlace
                        {menuItems.length >= MAX_MENU_ITEMS && (
                            <span className="text-xs text-gray-400 ml-1">(máx. {MAX_MENU_ITEMS})</span>
                        )}
                    </button>

                    {/* Tip */}
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        💡 Usa rutas relativas como <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">/productos</code> o URLs completas como <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">https://instagram.com/...</code>
                    </p>
                </div>

                {/* Botón guardar */}
                <Button
                    onClick={handleSave}
                    disabled={loading}
                    className="w-full h-12 bg-primary hover:bg-primary/90 text-white text-base font-bold"
                >
                    {loading ? "Guardando..." : "Guardar Configuración"}
                </Button>
            </CardContent>
        </Card>
    )
}
