"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ProductData, CreateProductData, createProduct, updateProduct, ConfigOption } from "../actions"
import { getBadges } from "../../badges/actions"
import { RichTextEditor } from "./rich-text-editor"
import { ImageUpload } from "./image-upload"
import { VariantsEditor } from "./variants-editor"
import { CategoriesInput } from "./categories-input"
import { ConfigurableOptionsEditor } from "./configurable-options-editor"

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
            const productData: CreateProductData = {
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
                is_active: isActive,
                is_subscription: subscriptionEnabled, // Use subscriptionEnabled instead
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
                badge_id: badgeId || undefined
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
                            <VariantsEditor variants={variants} onChange={setVariants} />
                        </div>
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
                </div>
            </div>
        </form>
    )
}
