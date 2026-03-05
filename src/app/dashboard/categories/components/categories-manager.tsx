"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Pencil,
    Trash2,
    Package,
    Search,
    FolderOpen,
    Plus,
    Eye,
    EyeOff,
    ChevronDown,
    ChevronUp,
    X,
} from "lucide-react"
import type { Category, CategoryProduct } from "../actions"
import {
    createCategory,
    updateCategory,
    deleteCategory,
    getCategoryProducts,
    removeProductFromCategory,
    addProductsToCategory,
    getAvailableProducts,
} from "../actions"

interface CategoriesManagerProps {
    initialCategories: Category[]
}

export function CategoriesManager({ initialCategories }: CategoriesManagerProps) {
    const [categories, setCategories] = useState<Category[]>(initialCategories)
    const [search, setSearch] = useState("")
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [expandedProducts, setExpandedProducts] = useState<CategoryProduct[]>([])
    const [showCreate, setShowCreate] = useState(false)
    const [newName, setNewName] = useState("")
    const [newDescription, setNewDescription] = useState("")
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editName, setEditName] = useState("")
    const [editDescription, setEditDescription] = useState("")
    const [isPending, startTransition] = useTransition()
    const [showAddProducts, setShowAddProducts] = useState(false)
    const [availableProducts, setAvailableProducts] = useState<CategoryProduct[]>([])
    const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
    const router = useRouter()

    const filtered = categories.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase())
    )

    const handleCreate = () => {
        if (!newName.trim()) return
        startTransition(async () => {
            const result = await createCategory({ name: newName, description: newDescription || undefined })
            if (result.success) {
                toast.success(`Categoría "${newName}" creada`)
                setNewName("")
                setNewDescription("")
                setShowCreate(false)
                router.refresh()
                const updated = await import("../actions").then(m => m.getCategories())
                setCategories(updated)
            } else {
                toast.error(result.error || "Error al crear")
            }
        })
    }

    const handleToggleVisibility = (cat: Category) => {
        startTransition(async () => {
            const result = await updateCategory(cat.id, { is_visible: !cat.is_visible })
            if (result.success) {
                setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, is_visible: !c.is_visible } : c))
                toast.success(cat.is_visible ? "Categoría oculta" : "Categoría visible")
            }
        })
    }

    const handleSaveEdit = (id: string) => {
        if (!editName.trim()) return
        startTransition(async () => {
            const result = await updateCategory(id, { name: editName, description: editDescription || null })
            if (result.success) {
                toast.success("Categoría actualizada")
                setEditingId(null)
                router.refresh()
                const updated = await import("../actions").then(m => m.getCategories())
                setCategories(updated)
            } else {
                toast.error(result.error || "Error al actualizar")
            }
        })
    }

    const handleDelete = (cat: Category) => {
        const msg = (cat.product_count || 0) > 0
            ? `¿Eliminar "${cat.name}"? Se desvinculará de ${cat.product_count} producto(s).`
            : `¿Eliminar "${cat.name}"?`
        if (!confirm(msg)) return

        startTransition(async () => {
            const result = await deleteCategory(cat.id)
            if (result.success) {
                toast.success(`"${cat.name}" eliminada`)
                setCategories(prev => prev.filter(c => c.id !== cat.id))
            } else {
                toast.error(result.error || "Error al eliminar")
            }
        })
    }

    const handleExpand = (catId: string) => {
        if (expandedId === catId) {
            setExpandedId(null)
            setShowAddProducts(false)
            return
        }
        setExpandedId(catId)
        setShowAddProducts(false)
        startTransition(async () => {
            const products = await getCategoryProducts(catId)
            setExpandedProducts(products)
        })
    }

    const handleRemoveProduct = (categoryId: string, productId: string) => {
        startTransition(async () => {
            const result = await removeProductFromCategory(categoryId, productId)
            if (result.success) {
                setExpandedProducts(prev => prev.filter(p => p.id !== productId))
                setCategories(prev => prev.map(c => c.id === categoryId ? { ...c, product_count: (c.product_count || 1) - 1 } : c))
                toast.success("Producto desvinculado")
            }
        })
    }

    const handleShowAddProducts = (categoryId: string) => {
        setShowAddProducts(true)
        setSelectedProductIds([])
        startTransition(async () => {
            const available = await getAvailableProducts(categoryId)
            setAvailableProducts(available)
        })
    }

    const handleAddSelectedProducts = (categoryId: string) => {
        if (selectedProductIds.length === 0) return
        startTransition(async () => {
            const result = await addProductsToCategory(categoryId, selectedProductIds)
            if (result.success) {
                toast.success(`${selectedProductIds.length} producto(s) vinculados`)
                setShowAddProducts(false)
                setSelectedProductIds([])
                const products = await getCategoryProducts(categoryId)
                setExpandedProducts(products)
                setCategories(prev => prev.map(c => c.id === categoryId ? { ...c, product_count: products.length } : c))
            }
        })
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Categorías</h1>
                    <p className="text-muted-foreground mt-1">Gestiona las categorías de tus productos</p>
                </div>
                <Button onClick={() => setShowCreate(!showCreate)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Crear Categoría
                </Button>
            </div>

            {/* Crear categoría */}
            {showCreate && (
                <div className="rounded-xl border bg-card p-4 space-y-3">
                    <Input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Nombre de la categoría"
                        onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                        autoFocus
                    />
                    <Input
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        placeholder="Descripción (opcional)"
                    />
                    <div className="flex gap-2">
                        <Button onClick={handleCreate} disabled={isPending || !newName.trim()} size="sm">
                            {isPending ? "Creando..." : "Crear"}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>Cancelar</Button>
                    </div>
                </div>
            )}

            {/* Barra de búsqueda */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar categoría..." className="pl-9" />
                </div>
                <Badge variant="secondary">{categories.length} categoría{categories.length !== 1 ? "s" : ""}</Badge>
            </div>

            {/* Lista */}
            <div className="rounded-xl border bg-card overflow-hidden">
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                        <FolderOpen className="h-12 w-12 mb-3 opacity-40" />
                        <p className="text-sm">{search ? "No se encontraron categorías" : "No hay categorías. Crea una con el botón de arriba."}</p>
                    </div>
                ) : (
                    <div className="divide-y">
                        {filtered.map((cat, idx) => (
                            <div key={cat.id ?? idx}>
                                {/* Fila principal */}
                                <div className="flex items-center px-6 py-4 hover:bg-muted/50 transition-colors">
                                    <button onClick={() => handleExpand(cat.id)} className="mr-3 text-muted-foreground hover:text-foreground">
                                        {expandedId === cat.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                    </button>

                                    {editingId === cat.id ? (
                                        <div className="flex-1 flex items-center gap-2">
                                            <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 max-w-xs" autoFocus
                                                onKeyDown={(e) => { if (e.key === "Enter") handleSaveEdit(cat.id); if (e.key === "Escape") setEditingId(null) }} />
                                            <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="h-8 max-w-sm" placeholder="Descripción" />
                                            <Button size="sm" variant="ghost" onClick={() => handleSaveEdit(cat.id)} disabled={isPending}>Guardar</Button>
                                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                                        </div>
                                    ) : (
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{cat.name}</span>
                                                {!cat.is_visible && <Badge variant="outline" className="text-xs">Oculta</Badge>}
                                            </div>
                                            {cat.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{cat.description}</p>}
                                        </div>
                                    )}

                                    <div className="flex items-center gap-4 ml-4">
                                        <div className="flex items-center gap-1.5 text-muted-foreground">
                                            <Package className="h-3.5 w-3.5" />
                                            <span className="text-sm">{cat.product_count || 0}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleToggleVisibility(cat)} title={cat.is_visible ? "Ocultar" : "Mostrar"}>
                                                {cat.is_visible ? <Eye className="h-4 w-4 text-green-500" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditingId(cat.id); setEditName(cat.name); setEditDescription(cat.description || "") }}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-8 w-8 hover:text-red-500" onClick={() => handleDelete(cat)} disabled={isPending}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                {/* Productos expandidos */}
                                {expandedId === cat.id && (
                                    <div className="px-6 pb-4 bg-muted/30">
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className="text-sm font-medium">Productos en esta categoría</h4>
                                            <Button size="sm" variant="outline" className="gap-1" onClick={() => handleShowAddProducts(cat.id)}>
                                                <Plus className="h-3 w-3" /> Agregar productos
                                            </Button>
                                        </div>

                                        {expandedProducts.length === 0 && !isPending ? (
                                            <p className="text-sm text-muted-foreground py-4">Sin productos vinculados</p>
                                        ) : (
                                            <div className="space-y-1">
                                                {expandedProducts.map((p) => (
                                                    <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-background">
                                                        <div className="flex items-center gap-3">
                                                            {p.image_url ? (
                                                                <img src={p.image_url} alt="" className="w-8 h-8 rounded object-cover" />
                                                            ) : (
                                                                <div className="w-8 h-8 rounded bg-muted flex items-center justify-center"><Package className="h-4 w-4 text-muted-foreground" /></div>
                                                            )}
                                                            <span className="text-sm">{p.name}</span>
                                                            {p.sale_price && <Badge variant="secondary" className="text-xs">Oferta</Badge>}
                                                        </div>
                                                        <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-red-500" onClick={() => handleRemoveProduct(cat.id, p.id)}>
                                                            <X className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Agregar productos */}
                                        {showAddProducts && (
                                            <div className="mt-3 border rounded-lg p-3 bg-background space-y-2">
                                                <p className="text-xs font-medium text-muted-foreground">Selecciona productos para agregar:</p>
                                                <div className="max-h-48 overflow-y-auto space-y-1">
                                                    {availableProducts.map((p) => (
                                                        <label key={p.id} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted cursor-pointer">
                                                            <input type="checkbox" checked={selectedProductIds.includes(p.id)}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) setSelectedProductIds(prev => [...prev, p.id])
                                                                    else setSelectedProductIds(prev => prev.filter(id => id !== p.id))
                                                                }}
                                                                className="rounded text-primary"
                                                            />
                                                            <span className="text-sm">{p.name}</span>
                                                        </label>
                                                    ))}
                                                    {availableProducts.length === 0 && !isPending && (
                                                        <p className="text-sm text-muted-foreground py-2">Todos los productos ya están vinculados</p>
                                                    )}
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button size="sm" onClick={() => handleAddSelectedProducts(cat.id)} disabled={selectedProductIds.length === 0 || isPending}>
                                                        Agregar {selectedProductIds.length > 0 ? `(${selectedProductIds.length})` : ""}
                                                    </Button>
                                                    <Button size="sm" variant="ghost" onClick={() => setShowAddProducts(false)}>Cancelar</Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
