"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { deleteProduct } from "../actions"
import { ProductData } from "@/types/product"

interface ProductListProps {
    products: ProductData[]
}

export function ProductList({ products }: ProductListProps) {
    const router = useRouter()
    const [searchQuery, setSearchQuery] = useState("")
    const [statusFilter, setStatusFilter] = useState("all")

    const handleDelete = async (id: string, name: string) => {
        if (confirm(`¿Estás seguro de eliminar "${name}"?`)) {
            const result = await deleteProduct(id)
            if (result.success) {
                router.refresh()
            } else {
                alert(`Error: ${result.error}`)
            }
        }
    }

    const filteredProducts = products.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            product.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            product.sku?.toLowerCase().includes(searchQuery.toLowerCase())

        const matchesStatus = statusFilter === "all" ||
            (statusFilter === "active" && product.stock > 0) ||
            (statusFilter === "out_of_stock" && product.stock === 0)

        return matchesSearch && matchesStatus
    })

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(price)
    }

    const getProductImage = (product: ProductData) => {
        // Use first image from images array, fallback to image_url, then placeholder
        const imageUrl = product.images?.[0] || product.image_url
        return imageUrl || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Crect fill='%23e2e8f0' width='400' height='400'/%3E%3Ctext fill='%2394a3b8' x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='48'%3E?%3C/text%3E%3C/svg%3E"
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Productos</h2>
                    <p className="text-muted-foreground">
                        Administra el catálogo de tu tienda
                    </p>
                </div>
                <Button asChild>
                    <Link href="/dashboard/products/new">
                        <span className="material-symbols-outlined mr-2">add_circle</span>
                        Nuevo Producto
                    </Link>
                </Button>
            </div>

            <div className="flex items-center gap-4">
                <div className="relative flex-1">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        search
                    </span>
                    <Input
                        placeholder="Buscar productos..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="active">En Stock</SelectItem>
                        <SelectItem value="out_of_stock">Agotados</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-lg bg-slate-50 dark:bg-slate-900/50">
                    <div className="size-16 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-4">
                        <span className="material-symbols-outlined text-3xl text-indigo-600 dark:text-indigo-400">inventory_2</span>
                    </div>
                    <h3 className="text-lg font-semibold mb-2">
                        {searchQuery || statusFilter !== "all" ? "No se encontraron productos" : "No tienes productos"}
                    </h3>
                    <p className="text-muted-foreground text-center max-w-sm mb-6">
                        {searchQuery || statusFilter !== "all"
                            ? "Prueba con otros términos de búsqueda o filtros"
                            : "Comienza agregando productos a tu catálogo"}
                    </p>
                    {!searchQuery && statusFilter === "all" && (
                        <Button asChild>
                            <Link href="/dashboard/products/new">
                                Crear mi primer Producto
                            </Link>
                        </Button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredProducts.map((product) => (
                        <Card key={product.id} className="overflow-hidden group hover:shadow-lg transition-shadow">
                            <CardHeader className="p-0">
                                <div className="relative aspect-square bg-slate-100 dark:bg-slate-900">
                                    <img
                                        src={getProductImage(product)}
                                        alt={product.name}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Crect fill='%23e2e8f0' width='400' height='400'/%3E%3Ctext fill='%2394a3b8' x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='48'%3E?%3C/text%3E%3C/svg%3E"
                                        }}
                                    />
                                    <div className="absolute top-2 right-2">
                                        <Badge variant={product.stock > 0 ? "default" : "secondary"}>
                                            {product.stock > 0 ? "En Stock" : "Agotado"}
                                        </Badge>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-4 space-y-2">
                                <div className="min-h-[3rem]">
                                    <h3 className="font-semibold line-clamp-2">{product.name}</h3>
                                </div>
                                {product.description && (
                                    <p className="text-sm text-muted-foreground line-clamp-2">
                                        {product.description}
                                    </p>
                                )}
                                <div className="flex items-center justify-between pt-2">
                                    <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                                        {formatPrice(product.price)}
                                    </p>
                                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                        <span className="material-symbols-outlined text-sm">inventory</span>
                                        <span>{product.stock}</span>
                                    </div>
                                </div>
                                {product.sku && (
                                    <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                                )}
                            </CardContent>
                            <CardFooter className="p-4 pt-0 gap-2">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    asChild
                                >
                                    <Link href={`/dashboard/products/${product.id}/edit`}>
                                        <span className="material-symbols-outlined mr-2 text-sm">edit</span>
                                        Editar
                                    </Link>
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDelete(product.id, product.name)}
                                >
                                    <span className="material-symbols-outlined text-sm text-red-500">delete</span>
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
