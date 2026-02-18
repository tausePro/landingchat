"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Pencil,
    Trash2,
    Check,
    X,
    Package,
    Search,
    FolderOpen,
} from "lucide-react"
import { renameCategory, deleteCategory } from "../../products/actions"

interface Category {
    name: string
    productCount: number
}

interface CategoriesManagerProps {
    initialCategories: Category[]
}

export function CategoriesManager({ initialCategories }: CategoriesManagerProps) {
    const [categories, setCategories] = useState<Category[]>(initialCategories)
    const [search, setSearch] = useState("")
    const [editingIndex, setEditingIndex] = useState<number | null>(null)
    const [editValue, setEditValue] = useState("")
    const [loading, setLoading] = useState<string | null>(null)
    const router = useRouter()

    const filtered = categories.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase())
    )

    const handleStartEdit = (index: number, name: string) => {
        setEditingIndex(index)
        setEditValue(name)
    }

    const handleCancelEdit = () => {
        setEditingIndex(null)
        setEditValue("")
    }

    const handleSaveEdit = async (oldName: string) => {
        const newName = editValue.trim()
        if (!newName || newName === oldName) {
            handleCancelEdit()
            return
        }

        // Verificar que no exista ya
        if (categories.some((c) => c.name === newName)) {
            toast.error("Ya existe una categoría con ese nombre")
            return
        }

        setLoading(oldName)
        const result = await renameCategory(oldName, newName)

        if (result.success) {
            toast.success(`Categoría renombrada: "${oldName}" → "${newName}" (${result.data?.updated} productos actualizados)`)
            // Actualizar local
            setCategories((prev) =>
                prev.map((c) => (c.name === oldName ? { ...c, name: newName } : c))
            )
            router.refresh()
        } else {
            toast.error(result.error || "Error al renombrar")
        }

        setLoading(null)
        handleCancelEdit()
    }

    const handleDelete = async (name: string, productCount: number) => {
        const msg = productCount > 0
            ? `¿Eliminar "${name}"? Se quitará de ${productCount} producto(s). Los productos NO se eliminan.`
            : `¿Eliminar "${name}"?`

        if (!confirm(msg)) return

        setLoading(name)
        const result = await deleteCategory(name)

        if (result.success) {
            toast.success(`Categoría "${name}" eliminada (${result.data?.updated} productos actualizados)`)
            setCategories((prev) => prev.filter((c) => c.name !== name))
            router.refresh()
        } else {
            toast.error(result.error || "Error al eliminar")
        }

        setLoading(null)
    }

    return (
        <div className="space-y-4">
            {/* Barra de búsqueda */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar categoría..."
                        className="pl-9"
                    />
                </div>
                <Badge variant="secondary" className="text-sm">
                    {categories.length} categoría{categories.length !== 1 ? "s" : ""}
                </Badge>
            </div>

            {/* Lista de categorías */}
            <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark overflow-hidden">
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                        <FolderOpen className="h-12 w-12 mb-3 opacity-40" />
                        <p className="text-sm">
                            {search
                                ? "No se encontraron categorías"
                                : "No hay categorías. Importa productos de WooCommerce o créalas al editar un producto."}
                        </p>
                    </div>
                ) : (
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-text-light-secondary dark:text-text-dark-secondary uppercase bg-background-light dark:bg-background-dark">
                            <tr>
                                <th className="px-6 py-3" scope="col">Categoría</th>
                                <th className="px-6 py-3 text-center" scope="col">Productos</th>
                                <th className="px-6 py-3 text-right" scope="col">
                                    <span className="sr-only">Acciones</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((category, index) => (
                                <tr
                                    key={category.name}
                                    className="border-b border-border-light dark:border-border-dark hover:bg-background-light/50 dark:hover:bg-background-dark/50"
                                >
                                    <td className="px-6 py-4 font-medium text-text-light-primary dark:text-text-dark-primary">
                                        {editingIndex === index ? (
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") handleSaveEdit(category.name)
                                                        if (e.key === "Escape") handleCancelEdit()
                                                    }}
                                                    className="h-8 max-w-xs"
                                                    autoFocus
                                                />
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-8 w-8 text-green-600 hover:text-green-700"
                                                    onClick={() => handleSaveEdit(category.name)}
                                                    disabled={loading === category.name}
                                                >
                                                    <Check className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-8 w-8"
                                                    onClick={handleCancelEdit}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <span>{category.name}</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex items-center justify-center gap-1.5 text-text-light-secondary dark:text-text-dark-secondary">
                                            <Package className="h-3.5 w-3.5" />
                                            <span>{category.productCount}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {editingIndex !== index && (
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-8 w-8 text-text-light-secondary dark:text-text-dark-secondary hover:text-primary"
                                                    onClick={() => handleStartEdit(index, category.name)}
                                                    disabled={loading === category.name}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-8 w-8 text-text-light-secondary dark:text-text-dark-secondary hover:text-red-500"
                                                    onClick={() => handleDelete(category.name, category.productCount)}
                                                    disabled={loading === category.name}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}
