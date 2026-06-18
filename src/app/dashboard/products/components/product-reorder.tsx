"use client"

import { useState } from "react"
import { ArrowUp, ArrowDown, GripVertical, Save } from "lucide-react"
import { updateProductOrder } from "../actions"
import { toast } from "sonner"
import { formatCurrency as formatTenantCurrency } from "@/lib/utils"
import { type TenantLocaleContext, DEFAULT_TENANT_LOCALE } from "@/lib/i18n/tenant-locale"

interface Product {
    id: string
    name: string
    image_url?: string
    price: number
    display_order?: number
}

interface ProductReorderProps {
    products: Product[]
    primaryColor?: string
    tenantLocale?: TenantLocaleContext
}

export function ProductReorder({ products: initialProducts, primaryColor = "#3B82F6", tenantLocale = DEFAULT_TENANT_LOCALE }: ProductReorderProps) {
    const [products, setProducts] = useState<Product[]>(
        [...initialProducts].sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
    )
    const [saving, setSaving] = useState(false)
    const [hasChanges, setHasChanges] = useState(false)

    const moveProduct = (index: number, direction: 'up' | 'down') => {
        const newIndex = direction === 'up' ? index - 1 : index + 1
        if (newIndex < 0 || newIndex >= products.length) return

        const newProducts = [...products]
        ;[newProducts[index], newProducts[newIndex]] = [newProducts[newIndex], newProducts[index]]
        setProducts(newProducts)
        setHasChanges(true)
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const result = await updateProductOrder(products.map(p => p.id))
            if (result.success) {
                toast.success("Orden guardado correctamente")
                setHasChanges(false)
            } else {
                toast.error(result.error || "Error al guardar el orden")
            }
        } catch {
            toast.error("Error inesperado")
        } finally {
            setSaving(false)
        }
    }

    const formatPrice = (price: number) =>
        formatTenantCurrency(price, { currency: tenantLocale.currency, locale: tenantLocale.locale })

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary">
                    Arrastra o usa las flechas para cambiar el orden. Recuerda guardar.
                </p>
                <button
                    onClick={handleSave}
                    disabled={!hasChanges || saving}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white transition-all disabled:opacity-40"
                    style={{ backgroundColor: hasChanges ? primaryColor : '#9CA3AF' }}
                >
                    <Save className="w-4 h-4" />
                    {saving ? "Guardando..." : "Guardar Orden"}
                </button>
            </div>

            <div className="border border-border-light dark:border-border-dark rounded-xl overflow-hidden divide-y divide-border-light dark:divide-border-dark">
                {products.map((product, index) => (
                    <div
                        key={product.id}
                        className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                        <span className="text-xs font-bold text-text-light-secondary dark:text-text-dark-secondary w-6 text-center">
                            {index + 1}
                        </span>
                        <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
                        {product.image_url ? (
                            <div
                                className="w-10 h-10 rounded-lg bg-cover bg-center border border-gray-200 dark:border-gray-700 shrink-0"
                                style={{ backgroundImage: `url("${product.image_url}")` }}
                            />
                        ) : (
                            <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shrink-0 flex items-center justify-center">
                                <span className="material-symbols-outlined text-gray-400 text-lg">image</span>
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary truncate">
                                {product.name}
                            </p>
                            <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary">
                                {formatPrice(product.price)}
                            </p>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => moveProduct(index, 'up')}
                                disabled={index === 0}
                                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-20 transition-colors"
                                title="Subir"
                            >
                                <ArrowUp className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                            </button>
                            <button
                                onClick={() => moveProduct(index, 'down')}
                                disabled={index === products.length - 1}
                                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-20 transition-colors"
                                title="Bajar"
                            >
                                <ArrowDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {hasChanges && (
                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">warning</span>
                    Tienes cambios sin guardar
                </p>
            )}
        </div>
    )
}
