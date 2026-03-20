"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { updateOrganization } from "../actions"
import type { Organization, OrganizationSettingsOverrides } from "@/types"
import type { StorefrontHeroSliderProduct } from "@/types/storefront"

const SLOT_COUNT = 3

interface CompleteTemplateFeaturedProductsEditorProps {
    organization: Pick<Organization, "id" | "name" | "slug"> & {
        settings?: OrganizationSettingsOverrides | null
    }
}

function getCompleteTemplateConfig(settings?: OrganizationSettingsOverrides | null): Record<string, unknown> {
    const storefrontSettings = (settings?.storefront as Record<string, unknown> | undefined) ?? {}
    const templateConfig = (storefrontSettings.templateConfig as Record<string, unknown> | undefined) ?? {}
    return (templateConfig.complete as Record<string, unknown> | undefined) ?? {}
}

function getFeaturedProductIds(settings?: OrganizationSettingsOverrides | null): string[] {
    const completeTemplateConfig = getCompleteTemplateConfig(settings)
    const featuredProductIds = completeTemplateConfig.featuredProductIds

    if (!Array.isArray(featuredProductIds)) {
        return []
    }

    return Array.from(
        new Set(
            featuredProductIds.filter((productId): productId is string => typeof productId === "string" && productId.length > 0)
        )
    ).slice(0, SLOT_COUNT)
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

function createEmptySelectedProducts(): Array<StorefrontHeroSliderProduct | null> {
    return Array.from({ length: SLOT_COUNT }, () => null)
}

function createEmptySearchTerms(): Record<number, string> {
    return Object.fromEntries(Array.from({ length: SLOT_COUNT }, (_, index) => [index, ""])) as Record<number, string>
}

export function CompleteTemplateFeaturedProductsEditor({ organization }: CompleteTemplateFeaturedProductsEditorProps) {
    const router = useRouter()
    const initialFeaturedProductIds = useMemo(() => getFeaturedProductIds(organization.settings), [organization.settings])
    const selectedProductIdsKey = useMemo(() => initialFeaturedProductIds.join("|"), [initialFeaturedProductIds])

    const [baseProducts, setBaseProducts] = useState<StorefrontHeroSliderProduct[]>([])
    const [searchResults, setSearchResults] = useState<Record<number, StorefrontHeroSliderProduct[]>>({})
    const [selectedProducts, setSelectedProducts] = useState<Array<StorefrontHeroSliderProduct | null>>(createEmptySelectedProducts)
    const [searchTerms, setSearchTerms] = useState<Record<number, string>>(createEmptySearchTerms)
    const [loadingProducts, setLoadingProducts] = useState<Record<number, boolean>>({})
    const [isLoadingBaseProducts, setIsLoadingBaseProducts] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        setSearchResults({})
        setSearchTerms(createEmptySearchTerms())
        setSelectedProducts(createEmptySelectedProducts())
    }, [initialFeaturedProductIds])

    useEffect(() => {
        const loadInitialProducts = async () => {
            setIsLoadingBaseProducts(true)

            try {
                const baseResponse = await fetch(`/api/store/${organization.slug}/products?limit=12`)
                const baseData = await baseResponse.json() as { products?: StorefrontHeroSliderProduct[] }
                setBaseProducts(Array.isArray(baseData.products) ? baseData.products : [])

                if (initialFeaturedProductIds.length === 0) {
                    setSelectedProducts(createEmptySelectedProducts())
                    return
                }

                const selectedResponse = await fetch(`/api/store/${organization.slug}/products?ids=${initialFeaturedProductIds.join(",")}&limit=${initialFeaturedProductIds.length}`)
                const selectedData = await selectedResponse.json() as { products?: StorefrontHeroSliderProduct[] }
                const selectedMap = new Map(
                    (Array.isArray(selectedData.products) ? selectedData.products : []).map((product) => [product.id, product])
                )

                setSelectedProducts(
                    Array.from({ length: SLOT_COUNT }, (_, index) => {
                        const productId = initialFeaturedProductIds[index]
                        return productId ? selectedMap.get(productId) ?? null : null
                    })
                )
            } catch (error) {
                console.error("Error loading complete template featured products:", error)
            } finally {
                setIsLoadingBaseProducts(false)
            }
        }

        void loadInitialProducts()
    }, [initialFeaturedProductIds, organization.slug, selectedProductIdsKey])

    const selectedProductIds = useMemo(
        () => selectedProducts
            .filter((product): product is StorefrontHeroSliderProduct => product !== null)
            .map((product) => product.id),
        [selectedProducts]
    )

    const handleSearchProducts = async (slotIndex: number) => {
        const searchValue = searchTerms[slotIndex]?.trim() ?? ""
        const params = new URLSearchParams({ limit: "8" })

        if (searchValue) {
            params.set("search", searchValue)
        }

        setLoadingProducts((current) => ({ ...current, [slotIndex]: true }))

        try {
            const response = await fetch(`/api/store/${organization.slug}/products?${params.toString()}`)
            const data = await response.json() as { products?: StorefrontHeroSliderProduct[] }
            setSearchResults((current) => ({
                ...current,
                [slotIndex]: Array.isArray(data.products) ? data.products : [],
            }))
        } catch (error) {
            console.error("Error searching products for complete-v2 featured band:", error)
        } finally {
            setLoadingProducts((current) => ({ ...current, [slotIndex]: false }))
        }
    }

    const handleSelectProduct = (slotIndex: number, product: StorefrontHeroSliderProduct) => {
        setSelectedProducts((current) => current.map((currentProduct, index) => (
            index === slotIndex ? product : currentProduct
        )))
    }

    const handleClearProduct = (slotIndex: number) => {
        setSelectedProducts((current) => {
            const remainingProducts = current.filter((product, index) => index !== slotIndex && product !== null)
            return [...remainingProducts, ...Array.from({ length: SLOT_COUNT - remainingProducts.length }, () => null)]
        })
    }

    const handleSave = async () => {
        setIsSaving(true)

        try {
            const currentSettings = (organization.settings ?? {}) as OrganizationSettingsOverrides
            const storefrontSettings = (currentSettings.storefront as Record<string, unknown> | undefined) ?? {}
            const templateConfig = (storefrontSettings.templateConfig as Record<string, unknown> | undefined) ?? {}
            const completeTemplateConfig = (templateConfig.complete as Record<string, unknown> | undefined) ?? {}
            const featuredProductIds = Array.from(new Set(selectedProductIds)).slice(0, SLOT_COUNT)

            const updatedSettings = {
                ...currentSettings,
                storefront: {
                    ...storefrontSettings,
                    templateConfig: {
                        ...templateConfig,
                        complete: {
                            ...completeTemplateConfig,
                            featuredProductIds,
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
            console.error("Error saving complete-v2 featured products:", error)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="rounded-xl border border-border-light bg-card-light shadow-sm dark:border-border-dark dark:bg-card-dark">
            <div className="border-b border-border-light p-6 dark:border-border-dark">
                <div className="space-y-1">
                    <h2 className="text-lg font-semibold">Productos destacados complete-v2</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Define hasta 3 productos para el bloque editorial debajo del hero. El orden controla la tarjeta principal y las secundarias.
                    </p>
                </div>
            </div>

            <div className="space-y-6 p-6">
                {Array.from({ length: SLOT_COUNT }, (_, slotIndex) => {
                    const selectedProduct = selectedProducts[slotIndex]
                    const isSearching = loadingProducts[slotIndex] ?? false
                    const options = (searchResults[slotIndex] ?? baseProducts).filter((product) => {
                        const isSelectedElsewhere = selectedProducts.some(
                            (currentProduct, currentIndex) => currentIndex !== slotIndex && currentProduct?.id === product.id
                        )

                        return !isSelectedElsewhere
                    })

                    return (
                        <div key={`complete-v2-featured-slot-${slotIndex}`} className="rounded-2xl border border-border-light p-5 dark:border-border-dark">
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div>
                                    <h3 className="text-base font-semibold">Producto destacado {slotIndex + 1}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {slotIndex === 0 ? "Este aparece como tarjeta principal del bloque." : "Aparece como tarjeta secundaria dentro del mismo bloque."}
                                    </p>
                                </div>
                                {selectedProduct ? (
                                    <Button type="button" variant="outline" size="sm" onClick={() => handleClearProduct(slotIndex)}>
                                        Quitar selección
                                    </Button>
                                ) : (
                                    <div className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                                        Sin producto asignado
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 flex flex-col gap-3 md:flex-row">
                                <Input
                                    value={searchTerms[slotIndex] ?? ""}
                                    onChange={(event) => setSearchTerms((current) => ({
                                        ...current,
                                        [slotIndex]: event.target.value,
                                    }))}
                                    placeholder="Buscar por nombre o descripción"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => void handleSearchProducts(slotIndex)}
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
                                    const isSelected = product.id === selectedProduct?.id

                                    return (
                                        <button
                                            key={product.id}
                                            type="button"
                                            onClick={() => handleSelectProduct(slotIndex, product)}
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
                    )
                })}

                <div className="rounded-2xl bg-background-light px-4 py-4 text-sm text-gray-500 dark:bg-background-dark dark:text-gray-400">
                    Hoy tienes {selectedProductIds.length} de {SLOT_COUNT} posiciones ocupadas. Si dejas menos de 3, el storefront completa el resto con el orden automático del catálogo.
                </div>

                <div className="flex justify-end">
                    <Button onClick={() => void handleSave()} disabled={isSaving}>
                        {isSaving ? "Guardando..." : "Guardar productos destacados"}
                    </Button>
                </div>
            </div>
        </div>
    )
}
