"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"

interface BundleItem {
    product_id: string
    quantity: number
    variant?: string
}

interface ProductOption {
    id: string
    name: string
    price: number
    image_url?: string
}

interface BundleEditorProps {
    items: BundleItem[]
    onChange: (items: BundleItem[]) => void
    discountType: 'fixed' | 'percentage' | null
    discountValue: number
    onDiscountTypeChange: (type: 'fixed' | 'percentage' | null) => void
    onDiscountValueChange: (value: number) => void
    organizationId: string
}

export function BundleEditor({
    items,
    onChange,
    discountType,
    discountValue,
    onDiscountTypeChange,
    onDiscountValueChange,
    organizationId
}: BundleEditorProps) {
    const [products, setProducts] = useState<ProductOption[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedProductId, setSelectedProductId] = useState("")
    const [selectedProductDetails, setSelectedProductDetails] = useState<Map<string, ProductOption>>(new Map())

    // Fetch products for selection
    useEffect(() => {
        const fetchProducts = async () => {
            const supabase = createClient()
            const { data } = await supabase
                .from("products")
                .select("id, name, price, image_url")
                .eq("organization_id", organizationId)
                .eq("is_active", true)
                .eq("is_bundle", false) // No incluir otros bundles
                .order("name")

            if (data) {
                setProducts(data)
                // Build lookup map
                const map = new Map<string, ProductOption>()
                data.forEach(p => map.set(p.id, p))
                setSelectedProductDetails(map)
            }
            setLoading(false)
        }
        fetchProducts()
    }, [organizationId])

    const handleAddProduct = () => {
        if (!selectedProductId) return

        // Check if already added
        if (items.some(item => item.product_id === selectedProductId)) {
            alert("Este producto ya está en el bundle")
            return
        }

        onChange([...items, { product_id: selectedProductId, quantity: 1 }])
        setSelectedProductId("")
    }

    const handleRemoveProduct = (productId: string) => {
        onChange(items.filter(item => item.product_id !== productId))
    }

    const handleQuantityChange = (productId: string, quantity: number) => {
        onChange(items.map(item =>
            item.product_id === productId
                ? { ...item, quantity: Math.max(1, quantity) }
                : item
        ))
    }

    // Calculate totals
    const subtotal = items.reduce((sum, item) => {
        const product = selectedProductDetails.get(item.product_id)
        return sum + (product ? product.price * item.quantity : 0)
    }, 0)

    const discount = discountType === 'fixed'
        ? discountValue
        : discountType === 'percentage'
            ? subtotal * (discountValue / 100)
            : 0

    const total = Math.max(0, subtotal - discount)

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
        }).format(amount)
    }

    if (loading) {
        return <div className="text-center py-4 text-text-light-secondary dark:text-text-dark-secondary">Cargando productos...</div>
    }

    return (
        <div className="space-y-6">
            {/* Product Selector */}
            <div className="space-y-2">
                <Label>Agregar Producto al Bundle</Label>
                <div className="flex gap-2">
                    <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                        <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Seleccionar producto..." />
                        </SelectTrigger>
                        <SelectContent>
                            {products.map(product => (
                                <SelectItem key={product.id} value={product.id}>
                                    {product.name} - {formatCurrency(product.price)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button type="button" onClick={handleAddProduct} disabled={!selectedProductId}>
                        <span className="material-symbols-outlined text-lg mr-1">add</span>
                        Agregar
                    </Button>
                </div>
            </div>

            {/* Items List */}
            {items.length > 0 ? (
                <div className="space-y-3">
                    <Label>Productos en el Bundle ({items.length})</Label>
                    <div className="border border-border-light dark:border-border-dark rounded-lg divide-y divide-border-light dark:divide-border-dark">
                        {items.map(item => {
                            const product = selectedProductDetails.get(item.product_id)
                            if (!product) return null

                            return (
                                <div key={item.product_id} className="flex items-center gap-4 p-3">
                                    {product.image_url && (
                                        <img
                                            src={product.image_url}
                                            alt={product.name}
                                            className="w-12 h-12 object-cover rounded"
                                        />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-text-light-primary dark:text-text-dark-primary truncate">
                                            {product.name}
                                        </p>
                                        <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary">
                                            {formatCurrency(product.price)} c/u
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="number"
                                            min="1"
                                            value={item.quantity}
                                            onChange={(e) => handleQuantityChange(item.product_id, parseInt(e.target.value) || 1)}
                                            className="w-20 text-center"
                                        />
                                        <span className="text-sm text-text-light-secondary dark:text-text-dark-secondary">
                                            = {formatCurrency(product.price * item.quantity)}
                                        </span>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleRemoveProduct(item.product_id)}
                                            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                                        >
                                            <span className="material-symbols-outlined">delete</span>
                                        </Button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            ) : (
                <div className="text-center py-8 border-2 border-dashed border-border-light dark:border-border-dark rounded-lg">
                    <span className="material-symbols-outlined text-4xl text-text-light-secondary dark:text-text-dark-secondary mb-2">inventory_2</span>
                    <p className="text-text-light-secondary dark:text-text-dark-secondary">
                        Agrega productos para crear el bundle
                    </p>
                </div>
            )}

            {/* Discount Configuration */}
            {items.length > 0 && (
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Tipo de Descuento</Label>
                        <Select
                            value={discountType || "none"}
                            onValueChange={(v) => onDiscountTypeChange(v === 'none' ? null : v as 'fixed' | 'percentage')}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Sin descuento</SelectItem>
                                <SelectItem value="fixed">Monto fijo</SelectItem>
                                <SelectItem value="percentage">Porcentaje</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {discountType && (
                        <div className="space-y-2">
                            <Label>
                                Valor del Descuento {discountType === 'percentage' ? '(%)' : '($)'}
                            </Label>
                            <Input
                                type="number"
                                min="0"
                                max={discountType === 'percentage' ? 100 : undefined}
                                value={discountValue}
                                onChange={(e) => onDiscountValueChange(parseFloat(e.target.value) || 0)}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Price Summary */}
            {items.length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-text-light-secondary dark:text-text-dark-secondary">Subtotal (productos por separado)</span>
                        <span>{formatCurrency(subtotal)}</span>
                    </div>
                    {discount > 0 && (
                        <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                            <span>Descuento del bundle</span>
                            <span>-{formatCurrency(discount)}</span>
                        </div>
                    )}
                    <div className="flex justify-between font-bold text-lg pt-2 border-t border-border-light dark:border-border-dark">
                        <span>Precio Final del Bundle</span>
                        <span className="text-primary">{formatCurrency(total)}</span>
                    </div>
                    {discount > 0 && (
                        <p className="text-xs text-green-600 dark:text-green-400 text-center">
                            ¡El cliente ahorra {formatCurrency(discount)} comprando este bundle!
                        </p>
                    )}
                </div>
            )}
        </div>
    )
}
