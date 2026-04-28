"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"

interface Variant {
    type: string
    values: string[]
    hasPriceAdjustment?: boolean
    priceAdjustments?: Record<string, number> // Legacy field
    variantPrices?: Record<string, number>
    hasStockByVariant?: boolean
    stockByVariant?: Record<string, number> // { "S": 10, "M": 5, "L": 0 }
    hasImageMapping?: boolean
    images?: Record<string, string | string[]> // { "Rojo": ["url1", "url2"] } o legacy { "Rojo": "url" }
}

interface VariantsEditorProps {
    variants: Variant[]
    onChange: (variants: Variant[]) => void
    productImages: string[]
    basePrice: number
}

interface SellableVariantCombination {
    title: string
    key: string
}

function getVariantOptionKey(optionValues: Array<{ option_name: string; value: string }>): string {
    return optionValues.map((optionValue) => `${optionValue.option_name}:${optionValue.value}`).join("|")
}

function buildSellableVariantCombinations(variants: Variant[]): SellableVariantCombination[] {
    const configuredVariants = variants
        .map((variant) => ({
            type: variant.type.trim(),
            values: variant.values.map((value) => value.trim()).filter(Boolean),
        }))
        .filter((variant) => variant.type && variant.values.length > 0)

    if (configuredVariants.length === 0) {
        return []
    }

    return configuredVariants
        .reduce<Array<Array<{ option_name: string; value: string }>>>(
            (combinations, variant) => combinations.flatMap((combination) => (
                variant.values.map((value) => [
                    ...combination,
                    { option_name: variant.type, value },
                ])
            )),
            [[]],
        )
        .map((optionValues) => ({
            title: optionValues.map((optionValue) => optionValue.value).join(" / "),
            key: getVariantOptionKey(optionValues),
        }))
}

export function VariantsEditor({ variants, onChange, productImages = [], basePrice }: VariantsEditorProps) {
    // Local state for input values (allows free typing)
    const [localValues, setLocalValues] = useState<string[]>(
        variants.map(v => v.values.join(', '))
    )

    const sellableVariantCombinations = useMemo(
        () => buildSellableVariantCombinations(variants),
        [variants],
    )
    const variantPricingEnabled = variants.some((variant) => variant.hasPriceAdjustment)
    const variantPrices = variants.find((variant) => variant.variantPrices)?.variantPrices ?? {}

    const handleAdd = () => {
        const newVariants = [...variants, { type: "", values: [], hasPriceAdjustment: false, priceAdjustments: {} }]
        setLocalValues([...localValues, ""])
        onChange(newVariants)
    }

    const handleRemove = (index: number) => {
        const newVariants = variants.filter((_, i) => i !== index)
        const newLocalValues = localValues.filter((_, i) => i !== index)
        setLocalValues(newLocalValues)
        onChange(newVariants)
    }

    const handleTypeChange = (index: number, type: string) => {
        const newVariants = [...variants]
        newVariants[index] = { ...newVariants[index], type }
        onChange(newVariants)
    }

    const handleLocalValueChange = (index: number, value: string) => {
        const newLocalValues = [...localValues]
        newLocalValues[index] = value
        setLocalValues(newLocalValues)
    }

    const commitValues = (index: number) => {
        const valuesStr = localValues[index] || ""
        const values = valuesStr.split(',').map(v => v.trim()).filter(v => v.length > 0)

        const newVariants = [...variants]
        newVariants[index] = { ...newVariants[index], values, priceAdjustments: {} }
        onChange(newVariants)

        const newLocalValues = [...localValues]
        newLocalValues[index] = values.join(', ')
        setLocalValues(newLocalValues)
    }

    const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            commitValues(index)
        }
    }

    const handleVariantPricingToggle = (enabled: boolean) => {
        const newVariants = variants.map((variant, index) => ({
            ...variant,
            hasPriceAdjustment: index === 0 ? enabled : false,
            variantPrices: index === 0 && enabled ? variant.variantPrices ?? {} : {},
            priceAdjustments: {},
        }))
        if (!newVariants[0]) {
            return
        }
        onChange(newVariants)
    }

    const handleVariantPriceChange = (combinationKey: string, price: string) => {
        const newVariants = variants.map((variant, index) => ({
            ...variant,
            hasPriceAdjustment: index === 0,
            priceAdjustments: {},
        }))
        if (!newVariants[0]) {
            return
        }

        const nextPrices = { ...(newVariants[0].variantPrices || {}) }
        const parsedPrice = Number(price)

        if (price.trim() === "" || !Number.isFinite(parsedPrice) || parsedPrice < 0) {
            delete nextPrices[combinationKey]
        } else {
            nextPrices[combinationKey] = parsedPrice
        }

        newVariants[0] = {
            ...newVariants[0],
            hasPriceAdjustment: true,
            variantPrices: nextPrices,
            priceAdjustments: {},
        }
        onChange(newVariants)
    }

    const formatCurrency = (price: number) => {
        return `$${price.toLocaleString()}`
    }

    const handleStockToggle = (index: number, enabled: boolean) => {
        const newVariants = [...variants]
        newVariants[index] = { ...newVariants[index], hasStockByVariant: enabled }
        if (!enabled) {
            newVariants[index].stockByVariant = {}
        } else {
            // Inicializar stock en 0 para cada valor
            const initialStock: Record<string, number> = {}
            newVariants[index].values.forEach(v => {
                initialStock[v] = newVariants[index].stockByVariant?.[v] || 0
            })
            newVariants[index].stockByVariant = initialStock
        }
        onChange(newVariants)
    }

    const handleStockChange = (variantIndex: number, valueName: string, stock: string) => {
        const newVariants = [...variants]
        const stockMap = { ...(newVariants[variantIndex].stockByVariant || {}) }
        stockMap[valueName] = parseInt(stock) || 0
        newVariants[variantIndex] = { ...newVariants[variantIndex], stockByVariant: stockMap }
        onChange(newVariants)
    }

    const handleImageMappingToggle = (index: number, enabled: boolean) => {
        const newVariants = [...variants]
        newVariants[index] = { ...newVariants[index], hasImageMapping: enabled }
        if (!enabled) {
            newVariants[index].images = {}
        }
        onChange(newVariants)
    }

    const handleImageSelect = (variantIndex: number, valueName: string, imageUrl: string) => {
        const newVariants = [...variants]
        const images = { ...(newVariants[variantIndex].images || {}) }

        // Normalizar a array
        const current = images[valueName]
        const currentArr: string[] = Array.isArray(current) ? [...current] : current ? [current] : []

        // Toggle: agregar o quitar
        const idx = currentArr.indexOf(imageUrl)
        if (idx >= 0) {
            currentArr.splice(idx, 1)
        } else {
            currentArr.push(imageUrl)
        }

        // Guardar como array (o eliminar si vacío)
        if (currentArr.length === 0) {
            delete images[valueName]
        } else {
            images[valueName] = currentArr
        }

        newVariants[variantIndex] = { ...newVariants[variantIndex], images }
        onChange(newVariants)
    }

    return (
        <div className="flex flex-col gap-6">
            {variants.map((variant, index) => (
                <div key={index} className="flex flex-col gap-4 p-4 border rounded-lg bg-background/50">
                    <div className="flex items-end gap-4">
                        <div className="flex-1">
                            <Label>Tipo de variante</Label>
                            <Input
                                className="mt-2"
                                value={variant.type}
                                onChange={(e) => handleTypeChange(index, e.target.value)}
                                placeholder="Ej: Talla, Color"
                            />
                        </div>
                        <div className="flex-[2]">
                            <Label>Valores (separados por coma)</Label>
                            <Input
                                className="mt-2"
                                value={localValues[index] || ""}
                                onChange={(e) => handleLocalValueChange(index, e.target.value)}
                                onBlur={() => commitValues(index)}
                                onKeyDown={(e) => handleKeyDown(e, index)}
                                placeholder="S, M, L, XL o Rojo, Azul, Verde"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => handleRemove(index)}
                            className="p-2 h-10 text-muted-foreground hover:text-red-500 transition-colors"
                        >
                            <span className="material-symbols-outlined">delete</span>
                        </button>
                    </div>

                    {/* Show parsed values as chips */}
                    {variant.values.length > 0 && (
                        <>
                            <div className="flex flex-wrap gap-2">
                                {variant.values.map((val, valIndex) => (
                                    <span
                                        key={valIndex}
                                        className="px-2 py-1 bg-primary/10 text-primary text-sm rounded-md flex items-center gap-1"
                                    >
                                        {val}
                                    </span>
                                ))}
                            </div>

                            {/* Stock by Variant Toggle */}
                            <div className="flex items-center gap-3 pt-2 border-t">
                                <Checkbox
                                    id={`stock-toggle-${index}`}
                                    checked={variant.hasStockByVariant || false}
                                    onCheckedChange={(checked) => handleStockToggle(index, checked as boolean)}
                                />
                                <Label htmlFor={`stock-toggle-${index}`} className="cursor-pointer text-sm font-normal">
                                    Inventario por variante
                                </Label>
                            </div>

                            {/* Stock Inputs per Value */}
                            {variant.hasStockByVariant && (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg">
                                    {variant.values.map((val) => {
                                        const stock = variant.stockByVariant?.[val] ?? 0
                                        return (
                                            <div key={val} className="flex flex-col gap-1">
                                                <Label className="text-xs text-muted-foreground">{val}</Label>
                                                <div className="relative">
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                                                        <span className="material-symbols-outlined text-sm">inventory_2</span>
                                                    </span>
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        className={`pl-8 h-8 text-sm ${stock === 0 ? 'border-red-300 dark:border-red-700' : ''}`}
                                                        value={stock}
                                                        onChange={(e) => handleStockChange(index, val, e.target.value)}
                                                        placeholder="0"
                                                    />
                                                </div>
                                            </div>
                                        )
                                    })}
                                    <p className="col-span-full text-xs text-muted-foreground mt-1">
                                        Unidades disponibles por cada valor. Las variantes con 0 se mostrarán como agotadas.
                                    </p>
                                </div>
                            )}

                            {/* Image Mapping Toggle */}
                            <div className="flex items-center gap-3 pt-2 border-t">
                                <Checkbox
                                    id={`image-toggle-${index}`}
                                    checked={variant.hasImageMapping || false}
                                    onCheckedChange={(checked) => handleImageMappingToggle(index, checked as boolean)}
                                />
                                <Label htmlFor={`image-toggle-${index}`} className="cursor-pointer text-sm font-normal">
                                    Esta variante cambia la imagen del producto
                                </Label>
                            </div>

                            {/* Image Selection per Value */}
                            {variant.hasImageMapping && (
                                <div className="flex flex-col gap-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                                    {productImages.length === 0 ? (
                                        <p className="text-sm text-yellow-600 dark:text-yellow-400">
                                            Debes subir imágenes al producto primero para poder asignarlas.
                                        </p>
                                    ) : (
                                        variant.values.map((val) => {
                                            const currentImgs = variant.images?.[val]
                                            const selectedArr: string[] = Array.isArray(currentImgs) ? currentImgs : currentImgs ? [currentImgs] : []
                                            return (
                                                <div key={val} className="flex flex-col gap-2">
                                                    <Label className="text-sm font-medium">
                                                        {val}
                                                        {selectedArr.length > 0 && (
                                                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                                                                ({selectedArr.length} {selectedArr.length === 1 ? 'imagen' : 'imágenes'})
                                                            </span>
                                                        )}
                                                    </Label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {productImages.map((img, imgIdx) => {
                                                            const isSelected = selectedArr.includes(img)
                                                            return (
                                                                <div
                                                                    key={imgIdx}
                                                                    onClick={() => handleImageSelect(index, val, img)}
                                                                    className={`
                                                                        relative w-12 h-12 rounded-md overflow-hidden cursor-pointer border-2 transition-all
                                                                        ${isSelected
                                                                            ? 'border-primary ring-2 ring-primary/20'
                                                                            : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                                                                        }
                                                                    `}
                                                                >
                                                                    <Image
                                                                        src={img}
                                                                        alt={`Opción para ${val}`}
                                                                        fill
                                                                        sizes="48px"
                                                                        className="object-cover"
                                                                    />
                                                                    {isSelected && (
                                                                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                                                            <span className="material-symbols-outlined text-white text-sm font-bold shadow-sm">check</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )
                                        })
                                    )}
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Selecciona las imágenes que corresponden a cada valor. Puedes elegir varias por color.
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            ))}
            {sellableVariantCombinations.length > 0 && (
                <div className="flex flex-col gap-4 p-4 border rounded-lg bg-background/50">
                    <div className="flex items-center gap-3">
                        <Checkbox
                            id="variant-pricing-toggle"
                            checked={variantPricingEnabled}
                            onCheckedChange={(checked) => handleVariantPricingToggle(checked as boolean)}
                        />
                        <Label htmlFor="variant-pricing-toggle" className="cursor-pointer text-sm font-normal">
                            Definir precio por variante vendible
                        </Label>
                    </div>

                    {variantPricingEnabled && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                            {sellableVariantCombinations.map((combination) => (
                                <div key={combination.key} className="flex flex-col gap-1">
                                    <Label className="text-xs text-muted-foreground">{combination.title}</Label>
                                    <div className="relative">
                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                                        <Input
                                            type="number"
                                            min="0"
                                            className="pl-6 h-8 text-sm"
                                            value={variantPrices[combination.key] ?? ""}
                                            onChange={(e) => handleVariantPriceChange(combination.key, e.target.value)}
                                            placeholder={basePrice > 0 ? String(basePrice) : "0"}
                                        />
                                    </div>
                                </div>
                            ))}
                            <p className="col-span-full text-xs text-muted-foreground mt-1">
                                Cada combinación es una variante vendible con precio absoluto. Si dejas un campo vacío se usará el precio base actual: {formatCurrency(basePrice)}.
                            </p>
                        </div>
                    )}
                </div>
            )}
            <Button
                type="button"
                variant="outline"
                onClick={handleAdd}
                className="w-full border-2 border-dashed"
            >
                <span className="material-symbols-outlined mr-2">add_circle</span>
                Añadir otra variante
            </Button>
        </div>
    )
}
