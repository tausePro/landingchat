"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { updateOrganization } from "../actions"
import { Button } from "@/components/ui/button"
import { ChevronUp, ChevronDown, Trash2, Plus, ExternalLink, Zap, ChevronRight } from "lucide-react"
import { toast } from "sonner"

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
    children?: MenuItem[]
}

interface QuickLink {
    label: string
    url: string
}

const DEFAULT_MENU_ITEMS: MenuItem[] = [
    { id: "home", label: "Inicio", url: "/" },
    { id: "products", label: "Productos", url: "/productos" }
]

const MAX_MENU_ITEMS = 8
const MAX_SUB_ITEMS = 6

// Enlaces rápidos fijos
const STATIC_QUICK_LINKS: QuickLink[] = [
    { label: "Inicio", url: "/" },
    { label: "Productos", url: "/productos" },
    { label: "Mi Perfil", url: "/profile" },
]

function generateId() {
    return Math.random().toString(36).substring(2, 9)
}

export function HeaderEditor({ organization }: HeaderEditorProps) {
    const [loading, setLoading] = useState(false)
    const [showStoreName, setShowStoreName] = useState(
        organization.settings?.storefront?.header?.showStoreName ?? true
    )
    const [menuItems, setMenuItems] = useState<MenuItem[]>(
        organization.settings?.storefront?.header?.menuItems || DEFAULT_MENU_ITEMS
    )
    const [quickLinks, setQuickLinks] = useState<QuickLink[]>(STATIC_QUICK_LINKS)
    const [loadingCategories, setLoadingCategories] = useState(true)
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

    // Cargar categorías del store para sugerencias rápidas
    useEffect(() => {
        async function loadCategories() {
            try {
                const res = await fetch(`/api/store/${organization.slug}/categories`)
                if (res.ok) {
                    const data = await res.json()
                    if (data.categories && data.categories.length > 0) {
                        const categoryLinks: QuickLink[] = data.categories.map((cat: string) => ({
                            label: cat,
                            url: `/productos?categoria=${cat.toLowerCase()}`
                        }))
                        setQuickLinks([...STATIC_QUICK_LINKS, ...categoryLinks])
                    }
                }
            } catch {
                // Si falla, mantener solo los links estáticos
            } finally {
                setLoadingCategories(false)
            }
        }
        loadCategories()
    }, [organization.slug])

    // Toggle expandir/colapsar sub-items
    const toggleExpanded = (id: string) => {
        setExpandedItems(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    // --- Agregar un quick link como menu item ---
    const handleAddQuickLink = (link: QuickLink) => {
        if (menuItems.length >= MAX_MENU_ITEMS) return
        const exists = menuItems.some(
            item => item.url === link.url && item.label === link.label
        )
        if (exists) return

        setMenuItems([
            ...menuItems,
            {
                id: generateId(),
                label: link.label,
                url: link.url,
                openInNewTab: false
            }
        ])
    }

    // --- Menu item handlers ---
    const handleAddMenuItem = () => {
        if (menuItems.length >= MAX_MENU_ITEMS) return
        setMenuItems([
            ...menuItems,
            {
                id: generateId(),
                label: "",
                url: "",
                openInNewTab: false
            }
        ])
    }

    const handleRemoveMenuItem = (index: number) => {
        setMenuItems(menuItems.filter((_, i) => i !== index))
    }

    const handleUpdateMenuItem = (index: number, field: string, value: string | boolean) => {
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

    // --- Sub-item handlers ---
    const handleAddSubItem = (parentIndex: number) => {
        const updated = [...menuItems]
        const parent = updated[parentIndex]
        const children = parent.children || []
        if (children.length >= MAX_SUB_ITEMS) return
        updated[parentIndex] = {
            ...parent,
            children: [...children, { id: generateId(), label: "", url: "", openInNewTab: false }]
        }
        setMenuItems(updated)
        // Auto-expandir al agregar
        setExpandedItems(prev => new Set(prev).add(parent.id))
    }

    const handleUpdateSubItem = (parentIndex: number, childIndex: number, field: string, value: string | boolean) => {
        const updated = [...menuItems]
        const children = [...(updated[parentIndex].children || [])]
        children[childIndex] = { ...children[childIndex], [field]: value }
        updated[parentIndex] = { ...updated[parentIndex], children }
        setMenuItems(updated)
    }

    const handleRemoveSubItem = (parentIndex: number, childIndex: number) => {
        const updated = [...menuItems]
        const children = (updated[parentIndex].children || []).filter((_, i) => i !== childIndex)
        updated[parentIndex] = { ...updated[parentIndex], children: children.length > 0 ? children : undefined }
        setMenuItems(updated)
    }

    const handleMoveSubItem = (parentIndex: number, childIndex: number, direction: "up" | "down") => {
        const updated = [...menuItems]
        const children = [...(updated[parentIndex].children || [])]
        const newIndex = direction === "up" ? childIndex - 1 : childIndex + 1
        if (newIndex < 0 || newIndex >= children.length) return
        const temp = children[childIndex]
        children[childIndex] = children[newIndex]
        children[newIndex] = temp
        updated[parentIndex] = { ...updated[parentIndex], children }
        setMenuItems(updated)
    }

    // Agregar quick link como sub-item de un parent
    const handleAddQuickLinkAsSub = (parentIndex: number, link: QuickLink) => {
        const parent = menuItems[parentIndex]
        const children = parent.children || []
        if (children.length >= MAX_SUB_ITEMS) return
        const exists = children.some(c => c.url === link.url && c.label === link.label)
        if (exists) return
        const updated = [...menuItems]
        updated[parentIndex] = {
            ...parent,
            children: [...children, { id: generateId(), label: link.label, url: link.url, openInNewTab: false }]
        }
        setMenuItems(updated)
        setExpandedItems(prev => new Set(prev).add(parent.id))
    }

    // --- Save ---
    const handleSave = async () => {
        setLoading(true)
        try {
            // Filtrar items vacíos antes de guardar (y sus children)
            const validMenuItems = menuItems
                .filter(item => item.label.trim() && item.url.trim())
                .map(item => ({
                    ...item,
                    children: item.children?.filter(c => c.label.trim() && c.url.trim()) || undefined
                }))
                .map(item => ({
                    ...item,
                    children: item.children && item.children.length > 0 ? item.children : undefined
                }))

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
            setMenuItems(validMenuItems.length > 0 ? validMenuItems : DEFAULT_MENU_ITEMS)
            toast.success("Configuración guardada correctamente")
        } catch (error: any) {
            toast.error(`Error: ${error.message}`)
        } finally {
            setLoading(false)
        }
    }

    // Verificar si un quick link ya fue agregado (en top-level)
    const isQuickLinkAdded = (link: QuickLink) => {
        return menuItems.some(item => item.url === link.url && item.label === link.label)
    }

    // Verificar si un quick link ya existe como sub-item de un parent
    const isQuickLinkInSub = (parentIndex: number, link: QuickLink) => {
        const children = menuItems[parentIndex].children || []
        return children.some(c => c.url === link.url && c.label === link.label)
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
                            Configura los enlaces del menú principal. Cada enlace puede tener submenú.
                        </p>
                    </div>

                    {/* Enlaces rápidos */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                            <Zap className="w-4 h-4 text-amber-500" />
                            Enlaces rápidos
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {STATIC_QUICK_LINKS.map((link) => (
                                <button
                                    key={link.url}
                                    onClick={() => handleAddQuickLink(link)}
                                    disabled={isQuickLinkAdded(link) || menuItems.length >= MAX_MENU_ITEMS}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    <Plus className="w-3 h-3" />
                                    {link.label}
                                </button>
                            ))}

                            {!loadingCategories && quickLinks.length > STATIC_QUICK_LINKS.length && (
                                <>
                                    <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 self-center mx-1" />
                                    {quickLinks.slice(STATIC_QUICK_LINKS.length).map((link) => (
                                        <button
                                            key={link.url}
                                            onClick={() => handleAddQuickLink(link)}
                                            disabled={isQuickLinkAdded(link) || menuItems.length >= MAX_MENU_ITEMS}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <Plus className="w-3 h-3" />
                                            {link.label}
                                        </button>
                                    ))}
                                </>
                            )}

                            {loadingCategories && (
                                <span className="text-xs text-gray-400 self-center">Cargando categorías...</span>
                            )}
                        </div>
                        {quickLinks.length > STATIC_QUICK_LINKS.length && (
                            <p className="text-xs text-gray-400">
                                Los enlaces <span className="text-blue-500">azules</span> son categorías de tus productos
                            </p>
                        )}
                    </div>

                    {/* Lista de items */}
                    <div className="space-y-3">
                        {menuItems.map((item, index) => {
                            const isExpanded = expandedItems.has(item.id)
                            const childCount = item.children?.length || 0

                            return (
                                <div
                                    key={item.id}
                                    className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                                >
                                    {/* Item principal */}
                                    <div className="p-4">
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
                                            <div className="flex items-center gap-1 pt-1">
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

                                        {/* Barra de sub-items */}
                                        <div className="flex items-center gap-2 mt-3 ml-10">
                                            <button
                                                onClick={() => toggleExpanded(item.id)}
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                            >
                                                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                                                Submenú
                                                {childCount > 0 && (
                                                    <span className="bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                                        {childCount}
                                                    </span>
                                                )}
                                            </button>
                                            {!isExpanded && childCount === 0 && (
                                                <button
                                                    onClick={() => handleAddSubItem(index)}
                                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-primary transition-colors"
                                                >
                                                    <Plus className="w-3 h-3" />
                                                    Agregar sub-enlace
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Sub-items expandidos */}
                                    {isExpanded && (
                                        <div className="bg-gray-50/80 dark:bg-gray-800/30 border-t border-gray-200 dark:border-gray-700 px-4 py-3 space-y-3">
                                            {/* Quick links para sub-items */}
                                            {quickLinks.length > STATIC_QUICK_LINKS.length && (
                                                <div className="flex flex-wrap gap-1.5 mb-2">
                                                    <span className="text-[10px] uppercase tracking-wider text-gray-400 self-center mr-1">Agregar:</span>
                                                    {quickLinks.slice(STATIC_QUICK_LINKS.length).map((link) => (
                                                        <button
                                                            key={link.url}
                                                            onClick={() => handleAddQuickLinkAsSub(index, link)}
                                                            disabled={isQuickLinkInSub(index, link) || childCount >= MAX_SUB_ITEMS}
                                                            className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                                        >
                                                            <Plus className="w-2.5 h-2.5" />
                                                            {link.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Lista de sub-items */}
                                            {(item.children || []).map((child, childIndex) => (
                                                <div
                                                    key={child.id}
                                                    className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-md p-2.5 border border-gray-200 dark:border-gray-700"
                                                >
                                                    {/* Reordenar sub */}
                                                    <div className="flex flex-col gap-0">
                                                        <button
                                                            onClick={() => handleMoveSubItem(index, childIndex, "up")}
                                                            disabled={childIndex === 0}
                                                            className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                                                        >
                                                            <ChevronUp className="w-3 h-3 text-gray-400" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleMoveSubItem(index, childIndex, "down")}
                                                            disabled={childIndex === (item.children?.length || 1) - 1}
                                                            className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                                                        >
                                                            <ChevronDown className="w-3 h-3 text-gray-400" />
                                                        </button>
                                                    </div>

                                                    {/* Campos sub */}
                                                    <div className="flex-1 grid grid-cols-2 gap-2">
                                                        <Input
                                                            value={child.label}
                                                            onChange={(e) => handleUpdateSubItem(index, childIndex, "label", e.target.value)}
                                                            placeholder="Etiqueta"
                                                            className="h-8 text-xs bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-600"
                                                        />
                                                        <Input
                                                            value={child.url}
                                                            onChange={(e) => handleUpdateSubItem(index, childIndex, "url", e.target.value)}
                                                            placeholder="URL"
                                                            className="h-8 text-xs bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-600"
                                                        />
                                                    </div>

                                                    {/* Acciones sub */}
                                                    <label className="cursor-pointer p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title="Abrir en nueva pestaña">
                                                        <input
                                                            type="checkbox"
                                                            checked={child.openInNewTab || false}
                                                            onChange={(e) => handleUpdateSubItem(index, childIndex, "openInNewTab", e.target.checked)}
                                                            className="sr-only"
                                                        />
                                                        <ExternalLink className={`w-3.5 h-3.5 ${child.openInNewTab ? "text-primary" : "text-gray-300"}`} />
                                                    </label>
                                                    <button
                                                        onClick={() => handleRemoveSubItem(index, childIndex)}
                                                        className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ))}

                                            {/* Botón agregar sub-item */}
                                            <button
                                                onClick={() => handleAddSubItem(index)}
                                                disabled={childCount >= MAX_SUB_ITEMS}
                                                className="w-full flex items-center justify-center gap-1.5 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-md text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-white dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                            >
                                                <Plus className="w-3 h-3" />
                                                Agregar sub-enlace
                                                {childCount >= MAX_SUB_ITEMS && <span className="text-gray-400 ml-1">(máx. {MAX_SUB_ITEMS})</span>}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    {/* Botón agregar vacío */}
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
                        Usa rutas relativas como <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">/productos</code> o URLs completas como <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">https://instagram.com/...</code>. Los items con submenú se muestran como dropdown al pasar el mouse.
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
