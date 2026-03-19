"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ImageUploader } from "@/components/ui/image-uploader"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { updateOrganization } from "../actions"
import type { Organization, OrganizationSettingsOverrides } from "@/types"
import {
    normalizeHeroSliderConfig,
    type StorefrontHeroSliderConfig,
    type StorefrontHeroSliderProduct,
} from "@/types/storefront"

interface HeroSliderEditorProps {
    organization: Pick<Organization, "id" | "name" | "slug"> & {
        settings?: OrganizationSettingsOverrides | null
    }
}

function getCompleteTemplateConfig(settings?: OrganizationSettingsOverrides | null): Record<string, unknown> {
    const storefrontSettings = (settings?.storefront as Record<string, unknown> | undefined) ?? {}
    const templateConfig = (storefrontSettings.templateConfig as Record<string, unknown> | undefined) ?? {}
    return (templateConfig.complete as Record<string, unknown> | undefined) ?? {}
}

function formatPrice(value: number | string | null | undefined): string {
    if (value === null || value === undefined || value === "") {
        return "Sin precio"
    }

    const parsedValue = typeof value === "number" ? value : Number(value)

    if (Number.isNaN(parsedValue)) {
        return "Sin precio"
    }

    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: 0,
    }).format(parsedValue)
}

function stripHtml(value: string | null | undefined): string {
    if (!value) {
        return ""
    }

    return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

export function HeroSliderEditor({ organization }: HeroSliderEditorProps) {
    const router = useRouter()
    const initialSliderConfig = useMemo(() => {
        const completeTemplateConfig = getCompleteTemplateConfig(organization.settings)
        return normalizeHeroSliderConfig(completeTemplateConfig.heroSlider)
    }, [organization.settings])
    const selectedProductIdsKey = useMemo(
        () => initialSliderConfig.slides.map((slide) => slide.productId).join("|"),
        [initialSliderConfig]
    )

    const [sliderConfig, setSliderConfig] = useState<StorefrontHeroSliderConfig>(initialSliderConfig)
    const [baseProducts, setBaseProducts] = useState<StorefrontHeroSliderProduct[]>([])
    const [searchResults, setSearchResults] = useState<Record<string, StorefrontHeroSliderProduct[]>>({})
    const [selectedProducts, setSelectedProducts] = useState<Record<string, StorefrontHeroSliderProduct | null>>({})
    const [searchTerms, setSearchTerms] = useState<Record<string, string>>(() => (
        Object.fromEntries(initialSliderConfig.slides.map((slide) => [slide.id, ""]))
    ))
    const [loadingProducts, setLoadingProducts] = useState<Record<string, boolean>>({})
    const [isLoadingBaseProducts, setIsLoadingBaseProducts] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        setSliderConfig(initialSliderConfig)
        setSearchTerms(Object.fromEntries(initialSliderConfig.slides.map((slide) => [slide.id, ""])))
        setSearchResults({})
        setSelectedProducts({})
    }, [initialSliderConfig])

    useEffect(() => {
        const loadInitialProducts = async () => {
            setIsLoadingBaseProducts(true)

            try {
                const baseResponse = await fetch(`/api/store/${organization.slug}/products?limit=12`)
                const baseData = await baseResponse.json() as { products?: StorefrontHeroSliderProduct[] }
                setBaseProducts(Array.isArray(baseData.products) ? baseData.products : [])

                const selectedIds = initialSliderConfig.slides
                    .map((slide) => slide.productId)
                    .filter((productId): productId is string => productId.length > 0)

                if (selectedIds.length === 0) {
                    setSelectedProducts({})
                    return
                }

                const selectedResponse = await fetch(`/api/store/${organization.slug}/products?ids=${selectedIds.join(",")}&limit=${selectedIds.length}`)
                const selectedData = await selectedResponse.json() as { products?: StorefrontHeroSliderProduct[] }
                const selectedMap = new Map(
                    (Array.isArray(selectedData.products) ? selectedData.products : []).map((product) => [product.id, product])
                )

                setSelectedProducts(
                    Object.fromEntries(
                        initialSliderConfig.slides.map((slide) => [slide.id, slide.productId ? selectedMap.get(slide.productId) ?? null : null])
                    )
                )
            } catch (error) {
                console.error("Error loading hero slider products:", error)
            } finally {
                setIsLoadingBaseProducts(false)
            }
        }

        void loadInitialProducts()
    }, [organization.slug, initialSliderConfig.slides, selectedProductIdsKey])

    const updateSlide = <K extends keyof StorefrontHeroSliderConfig["slides"][number]>(
        slideIndex: number,
        field: K,
        value: StorefrontHeroSliderConfig["slides"][number][K]
    ) => {
        setSliderConfig((currentConfig) => ({
            ...currentConfig,
            slides: currentConfig.slides.map((slide, index) => (
                index === slideIndex ? { ...slide, [field]: value } : slide
            )),
        }))
    }

    const handleSearchProducts = async (slideId: string) => {
        const searchValue = searchTerms[slideId]?.trim() ?? ""
        const params = new URLSearchParams({ limit: "8" })

        if (searchValue) {
            params.set("search", searchValue)
        }

        setLoadingProducts((current) => ({ ...current, [slideId]: true }))

        try {
            const response = await fetch(`/api/store/${organization.slug}/products?${params.toString()}`)
            const data = await response.json() as { products?: StorefrontHeroSliderProduct[] }
            setSearchResults((current) => ({
                ...current,
                [slideId]: Array.isArray(data.products) ? data.products : [],
            }))
        } catch (error) {
            console.error("Error searching products for hero slider:", error)
        } finally {
            setLoadingProducts((current) => ({ ...current, [slideId]: false }))
        }
    }

    const handleSelectProduct = (slideIndex: number, product: StorefrontHeroSliderProduct) => {
        const slideId = sliderConfig.slides[slideIndex]?.id

        if (!slideId) {
            return
        }

        updateSlide(slideIndex, "productId", product.id)
        setSelectedProducts((current) => ({
            ...current,
            [slideId]: product,
        }))
    }

    const handleClearProduct = (slideIndex: number) => {
        const slideId = sliderConfig.slides[slideIndex]?.id

        if (!slideId) {
            return
        }

        updateSlide(slideIndex, "productId", "")
        setSelectedProducts((current) => ({
            ...current,
            [slideId]: null,
        }))
    }

    const handleSave = async () => {
        setIsSaving(true)

        try {
            const currentSettings = (organization.settings ?? {}) as OrganizationSettingsOverrides
            const storefrontSettings = (currentSettings.storefront as Record<string, unknown> | undefined) ?? {}
            const templateConfig = (storefrontSettings.templateConfig as Record<string, unknown> | undefined) ?? {}
            const completeTemplateConfig = (templateConfig.complete as Record<string, unknown> | undefined) ?? {}

            const updatedSettings = {
                ...currentSettings,
                storefront: {
                    ...storefrontSettings,
                    templateConfig: {
                        ...templateConfig,
                        complete: {
                            ...completeTemplateConfig,
                            heroSlider: sliderConfig,
                        },
                    },
                },
            } as OrganizationSettingsOverrides

            await updateOrganization({
                name: organization.name,
                slug: organization.slug,
                settings: updatedSettings,
            })

            router.refresh()
        } catch (error) {
            console.error("Error saving hero slider settings:", error)
        } finally {
            setIsSaving(false)
        }
    }

    const productsBySlide = useMemo(() => {
        return Object.fromEntries(
            sliderConfig.slides.map((slide) => {
                const options = Object.prototype.hasOwnProperty.call(searchResults, slide.id)
                    ? (searchResults[slide.id] ?? [])
                    : baseProducts
                const selectedProduct = selectedProducts[slide.id]
                const uniqueProducts = new Map<string, StorefrontHeroSliderProduct>()

                if (selectedProduct) {
                    uniqueProducts.set(selectedProduct.id, selectedProduct)
                }

                options.forEach((product) => {
                    uniqueProducts.set(product.id, product)
                })

                return [slide.id, Array.from(uniqueProducts.values())]
            })
        ) as Record<string, StorefrontHeroSliderProduct[]>
    }, [baseProducts, searchResults, selectedProducts, sliderConfig.slides])

    return (
        <div className="rounded-xl border border-border-light bg-card-light shadow-sm dark:border-border-dark dark:bg-card-dark">
            <div className="border-b border-border-light p-6 dark:border-border-dark">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1">
                        <h2 className="text-lg font-semibold">Hero slider mixto</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Configura 3 slides editoriales y vincula cada uno a un producto real del catálogo para la plantilla complete.
                        </p>
                    </div>
                    <div className="flex items-center gap-3 rounded-full border border-border-light px-4 py-2 dark:border-border-dark">
                        <span className="text-sm font-medium">Activar slider</span>
                        <Switch
                            checked={sliderConfig.enabled}
                            onCheckedChange={(checked) => setSliderConfig((current) => ({ ...current, enabled: checked }))}
                        />
                    </div>
                </div>
            </div>

            <div className="space-y-6 p-6">
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-border-light p-4 dark:border-border-dark">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="font-medium">Rotación automática</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Cambia de slide automáticamente en el storefront público.
                                </p>
                            </div>
                            <Switch
                                checked={sliderConfig.autoRotate}
                                onCheckedChange={(checked) => setSliderConfig((current) => ({ ...current, autoRotate: checked }))}
                            />
                        </div>
                    </div>

                    <div className="rounded-xl border border-border-light p-4 dark:border-border-dark">
                        <Label htmlFor="hero-slider-interval" className="text-sm font-medium">
                            Intervalo de rotación
                        </Label>
                        <div className="mt-2 flex items-center gap-3">
                            <Input
                                id="hero-slider-interval"
                                type="number"
                                min={3}
                                max={12}
                                value={Math.round(sliderConfig.intervalMs / 1000)}
                                onChange={(event) => {
                                    const nextValue = Number.parseInt(event.target.value, 10)
                                    if (Number.isNaN(nextValue)) {
                                        return
                                    }

                                    setSliderConfig((current) => ({
                                        ...current,
                                        intervalMs: Math.min(12000, Math.max(3000, nextValue * 1000)),
                                    }))
                                }}
                            />
                            <span className="text-sm text-gray-500 dark:text-gray-400">segundos</span>
                        </div>
                    </div>
                </div>

                {sliderConfig.slides.map((slide, slideIndex) => {
                    const selectedProduct = selectedProducts[slide.id]
                    const options = productsBySlide[slide.id] ?? []
                    const isSearching = loadingProducts[slide.id] ?? false

                    return (
                        <div key={slide.id} className="rounded-2xl border border-border-light p-5 dark:border-border-dark">
                            <div className="mb-5 flex items-center justify-between gap-4">
                                <div>
                                    <h3 className="text-base font-semibold">Slide {slideIndex + 1}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        Cada slide necesita una imagen editorial y un producto vinculado para mostrarse en el hero.
                                    </p>
                                </div>
                                <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                                    {selectedProduct ? "Producto vinculado" : "Pendiente por vincular"}
                                </div>
                            </div>

                            <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
                                <div className="space-y-2">
                                    <Label>Imagen editorial</Label>
                                    <ImageUploader
                                        currentImageUrl={slide.imageUrl}
                                        onImageUploaded={(imageUrl) => updateSlide(slideIndex, "imageUrl", imageUrl)}
                                        folder={`storefront/hero-slider/${slide.id}`}
                                        maxSizeMB={5}
                                    />
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <Label htmlFor={`hero-slider-eyebrow-${slide.id}`}>Eyebrow</Label>
                                        <Input
                                            id={`hero-slider-eyebrow-${slide.id}`}
                                            value={slide.eyebrow}
                                            onChange={(event) => updateSlide(slideIndex, "eyebrow", event.target.value)}
                                            placeholder="Ej: Selección curada"
                                            className="mt-2"
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor={`hero-slider-title-${slide.id}`}>Título</Label>
                                        <Input
                                            id={`hero-slider-title-${slide.id}`}
                                            value={slide.title}
                                            onChange={(event) => updateSlide(slideIndex, "title", event.target.value)}
                                            placeholder="Título principal del slide"
                                            className="mt-2"
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor={`hero-slider-description-${slide.id}`}>Descripción</Label>
                                        <Textarea
                                            id={`hero-slider-description-${slide.id}`}
                                            value={slide.description}
                                            onChange={(event) => updateSlide(slideIndex, "description", event.target.value)}
                                            placeholder="Describe el contexto editorial y el beneficio comercial"
                                            rows={4}
                                            className="mt-2"
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor={`hero-slider-cta-${slide.id}`}>Texto CTA</Label>
                                        <Input
                                            id={`hero-slider-cta-${slide.id}`}
                                            value={slide.ctaText}
                                            onChange={(event) => updateSlide(slideIndex, "ctaText", event.target.value)}
                                            placeholder="Ej: Ver producto"
                                            className="mt-2"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 rounded-2xl bg-background-light p-4 dark:bg-background-dark">
                                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <h4 className="font-semibold">Producto vinculado</h4>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            Busca en tu catálogo y selecciona el producto real que acompañará este slide.
                                        </p>
                                    </div>
                                    {selectedProduct && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleClearProduct(slideIndex)}
                                        >
                                            Quitar vínculo
                                        </Button>
                                    )}
                                </div>

                                <div className="mt-4 flex flex-col gap-3 md:flex-row">
                                    <Input
                                        value={searchTerms[slide.id] ?? ""}
                                        onChange={(event) => setSearchTerms((current) => ({
                                            ...current,
                                            [slide.id]: event.target.value,
                                        }))}
                                        placeholder="Buscar por nombre o descripción"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => void handleSearchProducts(slide.id)}
                                        disabled={isSearching}
                                    >
                                        {isSearching ? "Buscando..." : "Buscar"}
                                    </Button>
                                </div>

                                {selectedProduct && (
                                    <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                                        <div className="flex flex-col gap-4 md:flex-row md:items-center">
                                            <div
                                                className="h-20 w-20 rounded-xl bg-cover bg-center bg-no-repeat"
                                                style={{ backgroundImage: selectedProduct.image_url ? `url(${selectedProduct.image_url})` : undefined }}
                                            />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-semibold text-primary">Producto seleccionado</p>
                                                <p className="truncate text-base font-semibold">{selectedProduct.name}</p>
                                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                                    {formatPrice(selectedProduct.sale_price ?? selectedProduct.price)}
                                                </p>
                                                {selectedProduct.description && (
                                                    <p className="mt-2 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
                                                        {stripHtml(selectedProduct.description)}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="mt-4 grid gap-3 md:grid-cols-2">
                                    {options.map((product) => {
                                        const isSelected = product.id === slide.productId

                                        return (
                                            <button
                                                key={product.id}
                                                type="button"
                                                onClick={() => handleSelectProduct(slideIndex, product)}
                                                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                                                    isSelected
                                                        ? "border-primary bg-primary/5"
                                                        : "border-border-light hover:border-primary/40 hover:bg-background-light dark:border-border-dark dark:hover:bg-background-dark"
                                                }`}
                                            >
                                                <div
                                                    className="h-16 w-16 rounded-lg bg-cover bg-center bg-no-repeat"
                                                    style={{ backgroundImage: product.image_url ? `url(${product.image_url})` : undefined }}
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-semibold">{product.name}</p>
                                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                        {formatPrice(product.sale_price ?? product.price)}
                                                    </p>
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>

                                {!isLoadingBaseProducts && options.length === 0 && (
                                    <div className="mt-4 rounded-xl border border-dashed border-border-light px-4 py-6 text-sm text-gray-500 dark:border-border-dark dark:text-gray-400">
                                        No encontramos productos para esta búsqueda. Prueba otro término o revisa si ya tienes catálogo publicado.
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}

                <div className="flex justify-end">
                    <Button onClick={() => void handleSave()} disabled={isSaving}>
                        {isSaving ? "Guardando..." : "Guardar slider"}
                    </Button>
                </div>
            </div>
        </div>
    )
}
