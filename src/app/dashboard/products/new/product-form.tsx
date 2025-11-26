"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { createProduct } from "../actions"
import { RichTextEditor } from "../components/rich-text-editor"
import { ImageUpload } from "../components/image-upload"
import { VariantsEditor } from "../components/variants-editor"
import { CategoriesInput } from "../components/categories-input"

interface ProductFormProps {
    organizationId: string
}

export function ProductForm({ organizationId }: ProductFormProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)

    // Form state
    const [name, setName] = useState("")
    const [description, setDescription] = useState("")
    const [sku, setSku] = useState("")
    const [stock, setStock] = useState("0")
    const [price, setPrice] = useState("")
    const [images, setImages] = useState<string[]>([])
    const [categories, setCategories] = useState<string[]>([])
    const [variants, setVariants] = useState<Array<{ type: string; values: string[] }>>([])
    const [isActive, setIsActive] = useState(true)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!name.trim() || !price) {
            alert("El nombre y el precio son requeridos")
            return
        }

        setLoading(true)
        try {
            await createProduct({
                name: name.trim(),
                description: description.trim() || undefined,
                price: parseFloat(price),
                stock: parseInt(stock) || 0,
                sku: sku.trim() || undefined,
                images,
                image_url: images[0], // Primary image
                categories,
                variants: variants.filter(v => v.type && v.values.length > 0),
                is_active: isActive
            })

            router.push("/dashboard/products")
        } catch (error: any) {
            alert(`Error: ${error.message}`)
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit}>
            <div className="p-8">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                    <div className="flex min-w-72 flex-col">
                        <h1 className="text-3xl font-bold tracking-tight">Añadir Nuevo Producto</h1>
                        <p className="text-muted-foreground mt-1">
                            Completa los detalles para añadir un nuevo producto a tu tienda.
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <Button type="button" variant="outline" asChild>
                            <Link href="/dashboard/products">Cancelar</Link>
                        </Button>
                        <Button type="submit" disabled={loading}>
                            <span className="material-symbols-outlined mr-2">save</span>
                            {loading ? "Guardando..." : "Guardar Producto"}
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content - Left Column (2/3) */}
                    <div className="lg:col-span-2 flex flex-col gap-8">
                        {/* General Information */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Información General</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div>
                                    <Label htmlFor="product-name">Nombre del Producto</Label>
                                    <Input
                                        id="product-name"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Ej: Camiseta Conversacional Pro"
                                        className="mt-2"
                                        required
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="product-description">Descripción</Label>
                                    <div className="mt-2">
                                        <RichTextEditor
                                            value={description}
                                            onChange={setDescription}
                                            placeholder="Describe tu producto..."
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Inventory and Pricing */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Inventario y Precios</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <Label htmlFor="product-sku">SKU</Label>
                                        <Input
                                            id="product-sku"
                                            value={sku}
                                            onChange={(e) => setSku(e.target.value)}
                                            placeholder="LC-TS-001"
                                            className="mt-2"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="product-stock">Stock</Label>
                                        <Input
                                            id="product-stock"
                                            type="number"
                                            value={stock}
                                            onChange={(e) => setStock(e.target.value)}
                                            placeholder="100"
                                            min="0"
                                            className="mt-2"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="product-price">Precio (COP)</Label>
                                        <div className="relative mt-2">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                                $
                                            </span>
                                            <Input
                                                id="product-price"
                                                type="number"
                                                value={price}
                                                onChange={(e) => setPrice(e.target.value)}
                                                placeholder="29990"
                                                min="0"
                                                step="100"
                                                className="pl-7"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Attributes and Variants */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Atributos y Variantes</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <VariantsEditor variants={variants} onChange={setVariants} />
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sidebar - Right Column (1/3) */}
                    <div className="lg:col-span-1 flex flex-col gap-8">
                        {/* Product Images */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Imágenes del Producto</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ImageUpload
                                    organizationId={organizationId}
                                    images={images}
                                    onImagesChange={setImages}
                                />
                            </CardContent>
                        </Card>

                        {/* Organization */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Organización</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div>
                                    <Label>Categorías</Label>
                                    <div className="mt-2">
                                        <CategoriesInput
                                            categories={categories}
                                            onChange={setCategories}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <Label>Estado</Label>
                                    <div className="flex items-center justify-between mt-2">
                                        <p className="text-muted-foreground">Producto Activo</p>
                                        <Switch
                                            checked={isActive}
                                            onCheckedChange={setIsActive}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </form>
    )
}
