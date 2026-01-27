"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createProduct, updateProduct } from "../actions"
import { ProductData, CreateProductInput, ConfigOption, PriceTier } from "@/types/product"
import { getBadges } from "../../badges/actions"
import { RichTextEditor } from "./rich-text-editor"
import { ImageUpload } from "./image-upload"
import { VariantsEditor } from "./variants-editor"
import { CategoriesInput } from "./categories-input"
import { ConfigurableOptionsEditor } from "./configurable-options-editor"
import { BundleEditor } from "./bundle-editor"
import { PriceTiersEditor } from "./price-tiers-editor"
import { BundleItem } from "@/types/product"
import { enhanceProductDescription } from "../ai-actions"

interface ProductFormProps {
    organizationId: string
    initialData?: ProductData
    isEditing?: boolean
}

export function ProductForm({ organizationId, initialData, isEditing = false }: ProductFormProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)

    // Form state
    const [name, setName] = useState(initialData?.name || "")
    const [description, setDescription] = useState(initialData?.description || "")
    const [sku, setSku] = useState(initialData?.sku || "")
    const [stock, setStock] = useState(initialData?.stock?.toString() || "0")
    const [price, setPrice] = useState(initialData?.price?.toString() || "")
    const [salePrice, setSalePrice] = useState(initialData?.sale_price?.toString() || "")
    const [images, setImages] = useState<string[]>(initialData?.images || [])
    const [categories, setCategories] = useState<string[]>(initialData?.categories || [])
    const [variants, setVariants] = useState<Array<{ type: string; values: string[] }>>(initialData?.variants || [])
    const [isSubscription, setIsSubscription] = useState(initialData?.is_subscription ?? false)
    const [isConfigurable, setIsConfigurable] = useState(initialData?.is_configurable ?? false)
    const [isActive, setIsActive] = useState(initialData?.is_active ?? true)

    // Subscription configuration state
    const [subscriptionEnabled, setSubscriptionEnabled] = useState(initialData?.subscription_config?.enabled ?? false)
    const [subscriptionPrice, setSubscriptionPrice] = useState(initialData?.subscription_config?.price?.toString() || "")
    const [subscriptionInterval, setSubscriptionInterval] = useState<'day' | 'week' | 'month' | 'year'>(initialData?.subscription_config?.interval || 'month')
    const [subscriptionIntervalCount, setSubscriptionIntervalCount] = useState(initialData?.subscription_config?.interval_count?.toString() || "1")
    const [subscriptionTrialDays, setSubscriptionTrialDays] = useState(initialData?.subscription_config?.trial_days?.toString() || "")
    const [subscriptionDiscount, setSubscriptionDiscount] = useState(initialData?.subscription_config?.discount_percentage?.toString() || "")

    // Configurable product state
    const [configurableOptions, setConfigurableOptions] = useState<ConfigOption[]>(initialData?.configurable_options || [])

    // Marketing state
    const [badgeId, setBadgeId] = useState(initialData?.badge_id || "")
    const [badges, setBadges] = useState<any[]>([])

    // Bundle state
    const [isBundle, setIsBundle] = useState(initialData?.is_bundle ?? false)
    const [bundleItems, setBundleItems] = useState<BundleItem[]>(initialData?.bundle_items || [])
    const [bundleDiscountType, setBundleDiscountType] = useState<'fixed' | 'percentage' | null>(initialData?.bundle_discount_type || null)
    const [bundleDiscountValue, setBundleDiscountValue] = useState(initialData?.bundle_discount_value ?? 0)

    // Price tiers state (precios por cantidad/mayoreo)
    const [hasQuantityPricing, setHasQuantityPricing] = useState(initialData?.has_quantity_pricing ?? false)
    const [priceTiers, setPriceTiers] = useState<PriceTier[]>(initialData?.price_tiers || [])

    const [minimumQuantity, setMinimumQuantity] = useState<number | undefined>(initialData?.minimum_quantity)

    // Tax state
    const [taxRate, setTaxRate] = useState<string>(initialData?.tax_rate !== undefined && initialData?.tax_rate !== null ? initialData.tax_rate.toString() : "")

    // AI Enhancement state
    const [isEnhancing, setIsEnhancing] = useState(false)

    // SEO state
    const [metaTitle, setMetaTitle] = useState(initialData?.meta_title || "")
    const [metaDescription, setMetaDescription] = useState(initialData?.meta_description || "")
    const [keywords, setKeywords] = useState<string[]>(initialData?.keywords || [])
    const [showSeoSection, setShowSeoSection] = useState(false)

    // Load badges
    useEffect(() => {
        async function loadBadges() {
            const badgesList = await getBadges()
            setBadges(badgesList)
        }
        loadBadges()
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!name.trim() || !price) {
            alert("El nombre y el precio son requeridos")
            return
        }

        setLoading(true)
        try {
            const productData: CreateProductInput = {
                name: name.trim(),
                description: description.trim() || undefined,
                price: parseFloat(price),
                sale_price: salePrice ? parseFloat(salePrice) : undefined,
                stock: parseInt(stock) || 0,
                sku: sku.trim() || undefined,
                images,
                image_url: images[0], // Primary image
                categories,
                variants: variants.filter(v => v.type && v.values.length > 0),
                options: [], // Required by schema
                is_active: isActive,
                is_subscription: subscriptionEnabled,
                is_configurable: isConfigurable,
                configurable_options: isConfigurable ? configurableOptions : undefined,
                subscription_config: subscriptionEnabled ? {
                    enabled: true,
                    price: parseFloat(subscriptionPrice),
                    interval: subscriptionInterval,
                    interval_count: parseInt(subscriptionIntervalCount) || 1,
                    trial_days: subscriptionTrialDays ? parseInt(subscriptionTrialDays) : undefined,
                    discount_percentage: subscriptionDiscount ? parseFloat(subscriptionDiscount) : undefined
                } : undefined,
                badge_id: badgeId || undefined,
                // Bundle fields
                is_bundle: isBundle,
                bundle_items: isBundle ? bundleItems : [],
                bundle_discount_type: isBundle ? bundleDiscountType : undefined,
                bundle_discount_value: isBundle ? bundleDiscountValue : 0,
                // Precios escalonados (mayoreo)
                has_quantity_pricing: hasQuantityPricing,
                price_tiers: hasQuantityPricing ? priceTiers : undefined,
                minimum_quantity: hasQuantityPricing ? minimumQuantity : undefined,

                // Tax override
                tax_rate: taxRate !== "" ? parseFloat(taxRate) : undefined,
                // SEO fields
                meta_title: metaTitle.trim() || undefined,
                meta_description: metaDescription.trim() || undefined,
                keywords: keywords.length > 0 ? keywords : undefined,
            }

            let result
            if (isEditing && initialData?.id) {
                result = await updateProduct(initialData.id, productData)
            } else {
                result = await createProduct(productData)
            }

            if (result && !result.success) {
                throw new Error(result.error || "Error desconocido")
            }

            router.push("/dashboard/products")
        } catch (error: any) {
            console.error("Form submit error:", error)
            alert(`Error: ${error.message}`)
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex min-w-72 flex-col">
                    <h1 className="text-text-light-primary dark:text-text-dark-primary text-3xl font-bold tracking-tight">
                        {isEditing ? "Editar Producto" : "Añadir Nuevo Producto"}
                    </h1>
                    <p className="text-text-light-secondary dark:text-text-dark-secondary text-base font-normal leading-normal mt-1">
                        {isEditing ? "Edita los detalles de tu producto." : "Completa los detalles para añadir un nuevo producto a tu tienda."}
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/products" className="flex h-10 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark px-4 text-sm font-medium text-text-light-primary dark:text-text-dark-primary hover:bg-background-light dark:hover:bg-background-dark">
                        <span className="truncate">Cancelar</span>
                    </Link>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex h-10 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg bg-primary px-4 text-white text-sm font-bold shadow-sm hover:bg-primary/90 disabled:opacity-50"
                    >
                        <span className="material-symbols-outlined text-lg">save</span>
                        <span className="truncate">{loading ? "Guardando..." : "Guardar Producto"}</span>
                    </button>
                </div>
            </div>

            <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 flex flex-col gap-8">
                    {/* General Info */}
                    <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6">
                        <h2 className="text-lg font-semibold text-text-light-primary dark:text-text-dark-primary">Información General</h2>
                        <div className="mt-6 grid grid-cols-1 gap-6">
                            <div>
                                <label className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary" htmlFor="product-name">Nombre del Producto</label>
                                <input
                                    className="form-input mt-2 w-full rounded-lg bg-background-light dark:bg-background-dark text-text-light-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-primary border-transparent placeholder:text-text-light-secondary dark:placeholder:text-text-dark-secondary"
                                    id="product-name"
                                    placeholder="Ej: Camiseta Conversacional Pro"
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary" htmlFor="product-description">Descripción</label>
                                <div className="mt-2">
                                    <RichTextEditor
                                        value={description}
                                        onChange={setDescription}
                                        placeholder="Describe tu producto..."
                                    />
                                </div>
                                {/* AI Enhancement Button */}
                                <button
                                    type="button"
                                    disabled={isEnhancing || !name.trim()}
                                    onClick={async () => {
                                        if (!name.trim()) {
                                            alert("Primero ingresa el nombre del producto")
                                            return
                                        }
                                        setIsEnhancing(true)
                                        try {
                                            const result = await enhanceProductDescription({
                                                name: name.trim(),
                                                description: description.trim() || undefined,
                                                category: categories[0],
                                                price: parseFloat(price) || 0
                                            })
                                            if (result.success) {
                                                // Solo actualizar descripción si la IA generó una nueva
                                                // (cuando la descripción original era corta o inexistente)
                                                if (result.data.description) {
                                                    setDescription(result.data.description)
                                                }
                                                // Rellenar campos SEO automáticamente
                                                setMetaTitle(result.data.meta_title)
                                                setMetaDescription(result.data.meta_description)
                                                setKeywords(result.data.keywords)
                                                // Mostrar sección SEO para que el usuario vea los campos
                                                setShowSeoSection(true)
                                            } else {
                                                alert(`Error: ${result.error}`)
                                            }
                                        } catch (error: any) {
                                            alert(`Error: ${error.message}`)
                                        } finally {
                                            setIsEnhancing(false)
                                        }
                                    }}
                                    className="mt-2 flex items-center gap-2 text-sm text-primary hover:text-primary/80 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <span className="material-symbols-outlined text-lg">
                                        {isEnhancing ? 'sync' : 'auto_awesome'}
                                    </span>
                                    {isEnhancing ? 'Mejorando...' : '✨ Mejorar con IA'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Inventory & Pricing */}
                    <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6">
                        <h2 className="text-lg font-semibold text-text-light-primary dark:text-text-dark-primary">Inventario y Precios</h2>
                        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary" htmlFor="product-sku">SKU</label>
                                <input
                                    className="form-input mt-2 w-full rounded-lg bg-background-light dark:bg-background-dark text-text-light-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-primary border-transparent placeholder:text-text-light-secondary dark:placeholder:text-text-dark-secondary"
                                    id="product-sku"
                                    placeholder="LC-TS-001"
                                    type="text"
                                    value={sku}
                                    onChange={e => setSku(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary" htmlFor="product-stock">Stock</label>
                                <input
                                    className="form-input mt-2 w-full rounded-lg bg-background-light dark:bg-background-dark text-text-light-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-primary border-transparent placeholder:text-text-light-secondary dark:placeholder:text-text-dark-secondary"
                                    id="product-stock"
                                    placeholder="100"
                                    type="number"
                                    value={stock}
                                    onChange={e => setStock(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary" htmlFor="product-price">Precio (COP)</label>
                                <div className="relative mt-2">
                                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-text-light-secondary dark:text-text-dark-secondary">$</span>
                                    <input
                                        className="form-input w-full rounded-lg bg-background-light dark:bg-background-dark text-text-light-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-primary border-transparent placeholder:text-text-light-secondary dark:placeholder:text-text-dark-secondary pl-7"
                                        id="product-price"
                                        placeholder="29990"
                                        type="number"
                                        step="100"
                                        value={price}
                                        onChange={e => setPrice(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary" htmlFor="product-sale-price">Precio de Oferta (COP)</label>
                                <div className="relative mt-2">
                                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-text-light-secondary dark:text-text-dark-secondary">$</span>
                                    <input
                                        className="form-input w-full rounded-lg bg-background-light dark:bg-background-dark text-text-light-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-primary border-transparent placeholder:text-text-light-secondary dark:placeholder:text-text-dark-secondary pl-7"
                                        id="product-sale-price"
                                        placeholder="24990"
                                        type="number"
                                        step="100"
                                        value={salePrice}
                                        onChange={e => setSalePrice(e.target.value)}
                                    />
                                </div>
                                <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary mt-1">Opcional. Se mostrará tachado el precio original.</p>
                            </div>
                        </div>
                    </div>

                    {/* Advanced Options */}
                    <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6">
                        <h2 className="text-lg font-semibold text-text-light-primary dark:text-text-dark-primary">Opciones Avanzadas</h2>
                        <div className="mt-6 flex flex-col gap-4">
                            {/* Bundle/Combo Toggle */}
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary flex items-center gap-2">
                                            <span className="material-symbols-outlined text-primary">inventory_2</span>
                                            Bundle/Combo
                                        </h3>
                                        <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary mt-1">
                                            Agrupa varios productos en un combo con descuento.
                                        </p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={isBundle}
                                            onChange={e => {
                                                setIsBundle(e.target.checked)
                                                // Reset subscription if enabling bundle
                                                if (e.target.checked) {
                                                    setSubscriptionEnabled(false)
                                                }
                                            }}
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/50 dark:peer-focus:ring-primary/80 rounded-full peer dark:bg-border-dark peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                                    </label>
                                </div>

                                {/* Bundle Editor */}
                                {isBundle && (
                                    <div className="mt-4 p-4 bg-background-light dark:bg-background-dark rounded-lg border border-primary/20">
                                        <BundleEditor
                                            items={bundleItems}
                                            onChange={setBundleItems}
                                            discountType={bundleDiscountType}
                                            discountValue={bundleDiscountValue}
                                            onDiscountTypeChange={setBundleDiscountType}
                                            onDiscountValueChange={setBundleDiscountValue}
                                            organizationId={organizationId}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="border-t border-border-light dark:border-border-dark"></div>

                            {/* Precios por Cantidad Toggle */}
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary flex items-center gap-2">
                                            <span className="material-symbols-outlined text-primary">price_change</span>
                                            Precios por Cantidad
                                        </h3>
                                        <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary mt-1">
                                            Configura precios diferenciados para compras al por mayor.
                                        </p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={hasQuantityPricing}
                                            onChange={e => setHasQuantityPricing(e.target.checked)}
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/50 dark:peer-focus:ring-primary/80 rounded-full peer dark:bg-border-dark peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                                    </label>
                                </div>

                                {/* Price Tiers Editor */}
                                {hasQuantityPricing && (
                                    <div className="mt-4 p-4 bg-background-light dark:bg-background-dark rounded-lg border border-primary/20">
                                        <PriceTiersEditor
                                            tiers={priceTiers}
                                            onChange={setPriceTiers}
                                            minimumQuantity={minimumQuantity}
                                            onMinimumQuantityChange={setMinimumQuantity}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="border-t border-border-light dark:border-border-dark"></div>

                            {/* Subscription Toggle */}
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary">Vender por Suscripción</h3>
                                        <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary mt-1">Permite a los clientes suscribirse a este producto.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={subscriptionEnabled}
                                            onChange={e => setSubscriptionEnabled(e.target.checked)}
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/50 dark:peer-focus:ring-primary/80 rounded-full peer dark:bg-border-dark peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                                    </label>
                                </div>

                                {/* Subscription Configuration Fields */}
                                {subscriptionEnabled && (
                                    <div className="mt-4 p-4 bg-background-light dark:bg-background-dark rounded-lg border border-border-light dark:border-border-dark space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary">Precio de Suscripción (COP)</label>
                                                <div className="relative mt-2">
                                                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-text-light-secondary dark:text-text-dark-secondary">$</span>
                                                    <input
                                                        className="form-input w-full rounded-lg bg-white dark:bg-gray-800 text-text-light-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-primary border border-border-light dark:border-border-dark placeholder:text-text-light-secondary dark:placeholder:text-text-dark-secondary pl-7"
                                                        placeholder="45000"
                                                        type="number"
                                                        step="100"
                                                        value={subscriptionPrice}
                                                        onChange={e => setSubscriptionPrice(e.target.value)}
                                                        required={subscriptionEnabled}
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary">Periodicidad</label>
                                                <select
                                                    className="form-select mt-2 w-full rounded-lg bg-white dark:bg-gray-800 text-text-light-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-primary border border-border-light dark:border-border-dark h-10"
                                                    value={subscriptionInterval}
                                                    onChange={e => setSubscriptionInterval(e.target.value as any)}
                                                >
                                                    <option value="day">Diario</option>
                                                    <option value="week">Semanal</option>
                                                    <option value="month">Mensual</option>
                                                    <option value="year">Anual</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary">Cada cuántos</label>
                                                <input
                                                    className="form-input mt-2 w-full rounded-lg bg-white dark:bg-gray-800 text-text-light-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-primary border border-border-light dark:border-border-dark placeholder:text-text-light-secondary dark:placeholder:text-text-dark-secondary"
                                                    placeholder="1"
                                                    type="number"
                                                    min="1"
                                                    value={subscriptionIntervalCount}
                                                    onChange={e => setSubscriptionIntervalCount(e.target.value)}
                                                />
                                                <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary mt-1">Ej: "2" para cada 2 meses</p>
                                            </div>

                                            <div>
                                                <label className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary">Días de prueba gratis (opcional)</label>
                                                <input
                                                    className="form-input mt-2 w-full rounded-lg bg-white dark:bg-gray-800 text-text-light-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-primary border border-border-light dark:border-border-dark placeholder:text-text-light-secondary dark:placeholder:text-text-dark-secondary"
                                                    placeholder="7"
                                                    type="number"
                                                    min="0"
                                                    value={subscriptionTrialDays}
                                                    onChange={e => setSubscriptionTrialDays(e.target.value)}
                                                />
                                            </div>

                                            <div className="md:col-span-2">
                                                <label className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary">Descuento vs Precio Único (%, opcional)</label>
                                                <input
                                                    className="form-input mt-2 w-full rounded-lg bg-white dark:bg-gray-800 text-text-light-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-primary border border-border-light dark:border-border-dark placeholder:text-text-light-secondary dark:placeholder:text-text-dark-secondary"
                                                    placeholder="10"
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    step="0.1"
                                                    value={subscriptionDiscount}
                                                    onChange={e => setSubscriptionDiscount(e.target.value)}
                                                />
                                                <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary mt-1">Se mostrará como "Ahorra X%" en el storefront</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="border-t border-border-light dark:border-border-dark"></div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary">Producto Configurable</h3>
                                    <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary mt-1">Permite personalizar el producto a través del Agente.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={isConfigurable}
                                        onChange={e => setIsConfigurable(e.target.checked)}
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/50 dark:peer-focus:ring-primary/80 rounded-full peer dark:bg-border-dark peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                                </label>
                            </div>

                            {/* Configurable Options Editor */}
                            {isConfigurable && (
                                <div className="mt-6 p-4 bg-background-light dark:bg-background-dark rounded-lg border border-border-light dark:border-border-dark">
                                    <ConfigurableOptionsEditor
                                        options={configurableOptions}
                                        onChange={setConfigurableOptions}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Attributes & Variants */}
                    <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6">
                        <h2 className="text-lg font-semibold text-text-light-primary dark:text-text-dark-primary">Atributos y Variantes</h2>
                        <div className="mt-6">
                            <VariantsEditor variants={variants} onChange={setVariants} productImages={images} />
                        </div>
                    </div>

                    {/* SEO Section - Collapsible */}
                    <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6">
                        <button
                            type="button"
                            onClick={() => setShowSeoSection(!showSeoSection)}
                            className="w-full flex items-center justify-between"
                        >
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">search</span>
                                <h2 className="text-lg font-semibold text-text-light-primary dark:text-text-dark-primary">SEO y Posicionamiento</h2>
                                {(metaTitle || metaDescription || keywords.length > 0) && (
                                    <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">
                                        Configurado
                                    </span>
                                )}
                            </div>
                            <span className={`material-symbols-outlined text-text-light-secondary transition-transform ${showSeoSection ? 'rotate-180' : ''}`}>
                                expand_more
                            </span>
                        </button>

                        {showSeoSection && (
                            <div className="mt-6 flex flex-col gap-6">
                                <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary">
                                    Optimiza cómo aparece tu producto en buscadores y redes sociales. Usa "Mejorar con IA" para generar automáticamente.
                                </p>

                                <div>
                                    <label className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary" htmlFor="meta-title">
                                        Título SEO
                                        <span className="ml-2 text-xs text-text-light-secondary">({metaTitle.length}/70)</span>
                                    </label>
                                    <input
                                        className="form-input mt-2 w-full rounded-lg bg-background-light dark:bg-background-dark text-text-light-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-primary border-transparent placeholder:text-text-light-secondary dark:placeholder:text-text-dark-secondary"
                                        id="meta-title"
                                        placeholder="Título optimizado para buscadores (máx 70 caracteres)"
                                        type="text"
                                        maxLength={70}
                                        value={metaTitle}
                                        onChange={e => setMetaTitle(e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary" htmlFor="meta-description">
                                        Meta Descripción
                                        <span className="ml-2 text-xs text-text-light-secondary">({metaDescription.length}/160)</span>
                                    </label>
                                    <textarea
                                        className="form-textarea mt-2 w-full rounded-lg bg-background-light dark:bg-background-dark text-text-light-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-primary border-transparent placeholder:text-text-light-secondary dark:placeholder:text-text-dark-secondary resize-none"
                                        id="meta-description"
                                        placeholder="Descripción que aparecerá en resultados de búsqueda (máx 160 caracteres)"
                                        rows={3}
                                        maxLength={160}
                                        value={metaDescription}
                                        onChange={e => setMetaDescription(e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary">
                                        Keywords
                                    </label>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {keywords.map((keyword, idx) => (
                                            <span
                                                key={idx}
                                                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm"
                                            >
                                                {keyword}
                                                <button
                                                    type="button"
                                                    onClick={() => setKeywords(keywords.filter((_, i) => i !== idx))}
                                                    className="hover:text-red-500"
                                                >
                                                    <span className="material-symbols-outlined text-sm">close</span>
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                    <input
                                        className="form-input mt-2 w-full rounded-lg bg-background-light dark:bg-background-dark text-text-light-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-primary border-transparent placeholder:text-text-light-secondary dark:placeholder:text-text-dark-secondary"
                                        placeholder="Escribe y presiona Enter para agregar"
                                        type="text"
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault()
                                                const input = e.currentTarget
                                                const value = input.value.trim()
                                                if (value && !keywords.includes(value)) {
                                                    setKeywords([...keywords, value])
                                                    input.value = ''
                                                }
                                            }
                                        }}
                                    />
                                </div>

                                {/* Preview */}
                                {(metaTitle || metaDescription) && (
                                    <div className="p-4 bg-background-light dark:bg-background-dark rounded-lg border border-border-light dark:border-border-dark">
                                        <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary mb-2">Vista previa en Google:</p>
                                        <div className="space-y-1">
                                            <p className="text-blue-600 dark:text-blue-400 text-lg font-medium truncate">
                                                {metaTitle || name || 'Título del producto'}
                                            </p>
                                            <p className="text-green-700 dark:text-green-500 text-sm">
                                                tutienda.com › producto
                                            </p>
                                            <p className="text-text-light-secondary dark:text-text-dark-secondary text-sm line-clamp-2">
                                                {metaDescription || 'La meta descripción aparecerá aquí...'}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-1 flex flex-col gap-8">
                    {/* Images */}
                    <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6">
                        <h2 className="text-lg font-semibold text-text-light-primary dark:text-text-dark-primary">Imágenes del Producto</h2>
                        <div className="mt-6">
                            <ImageUpload
                                organizationId={organizationId}
                                images={images}
                                onImagesChange={setImages}
                            />
                        </div>
                    </div>

                    {/* Organization */}
                    <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6">
                        <h2 className="text-lg font-semibold text-text-light-primary dark:text-text-dark-primary">Organización</h2>
                        <div className="mt-6 flex flex-col gap-6">
                            <div>
                                <label className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary" htmlFor="product-badge">Badge</label>
                                <select
                                    className="form-select mt-2 block w-full rounded-lg bg-background-light dark:bg-background-dark border-transparent focus:border-primary focus:ring-primary text-text-light-primary dark:text-text-dark-primary"
                                    id="product-badge"
                                    value={badgeId}
                                    onChange={e => setBadgeId(e.target.value)}
                                >
                                    <option value="">Sin badge</option>
                                    {badges.map(badge => (
                                        <option key={badge.id} value={badge.id}>
                                            {badge.display_text}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary mt-1">
                                    Badge que se mostrará en el producto
                                </p>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary">Categorías</label>
                                <div className="mt-2">
                                    <CategoriesInput
                                        categories={categories}
                                        onChange={setCategories}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary">Estado</label>
                                <div className="flex items-center justify-between mt-2">
                                    <p className="text-text-light-secondary dark:text-text-dark-secondary">Producto Activo</p>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={isActive}
                                            onChange={e => setIsActive(e.target.checked)}
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/50 dark:peer-focus:ring-primary/80 rounded-full peer dark:bg-border-dark peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tax Settings */}
                    <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6">
                        <h2 className="text-lg font-semibold text-text-light-primary dark:text-text-dark-primary">Impuestos</h2>
                        <div className="mt-6">
                            <label className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary">
                                Tasa de Impuesto (%)
                            </label>
                            <div className="relative mt-2">
                                <input
                                    className="form-input w-full rounded-lg bg-background-light dark:bg-background-dark text-text-light-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-primary border-transparent placeholder:text-text-light-secondary dark:placeholder:text-text-dark-secondary pr-8"
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    placeholder="Global"
                                    value={taxRate}
                                    onChange={e => setTaxRate(e.target.value)}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-light-secondary font-bold">%</span>
                            </div>
                            <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary mt-2">
                                Déjalo vacío para usar la configuración global de la tienda. <br />
                                <span className="text-primary cursor-pointer" onClick={() => setTaxRate("0")}>Clic aquí para 0% (Exento)</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </form>
    )
}
