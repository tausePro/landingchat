"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"

interface VariantValue {
    name: string
    priceAdjustment: number
}

interface Variant {
    type: string
    values: string[]
    hasPriceAdjustment?: boolean
    priceAdjustments?: Record<string, number> // { "S": 0, "XL": 5000 }
    hasImageMapping?: boolean
    images?: Record<string, string> // { "Rojo": "url_to_red_image", "Azul": "url_to_blue_image" }
}

interface VariantsEditorProps {
    variants: Variant[]
    onChange: (variants: Variant[]) => void
    productImages: string[]
}

export function VariantsEditor({ variants, onChange, productImages = [] }: VariantsEditorProps) {
    // Local state for input values (allows free typing)
    const [localValues, setLocalValues] = useState<string[]>(
        variants.map(v => v.values.join(', '))
    )

    // Sync local state when variants prop changes externally
    useEffect(() => {
        setLocalValues(variants.map(v => v.values.join(', ')))
    }, [variants.length])

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
        // Preserve existing price adjustments for values that still exist
        const oldAdjustments = newVariants[index].priceAdjustments || {}
        const newAdjustments: Record<string, number> = {}
        values.forEach(v => {
            newAdjustments[v] = oldAdjustments[v] || 0
        })

        newVariants[index] = { ...newVariants[index], values, priceAdjustments: newAdjustments }
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

    const handlePriceToggle = (index: number, enabled: boolean) => {
        const newVariants = [...variants]
        newVariants[index] = { ...newVariants[index], hasPriceAdjustment: enabled }
        if (!enabled) {
            // Reset all price adjustments to 0 when disabled
            const resetAdjustments: Record<string, number> = {}
            newVariants[index].values.forEach(v => {
                resetAdjustments[v] = 0
            })
            newVariants[index].priceAdjustments = resetAdjustments
        }
        onChange(newVariants)
    }

    const handlePriceChange = (variantIndex: number, valueName: string, price: string) => {
        const newVariants = [...variants]
        const adjustments = { ...(newVariants[variantIndex].priceAdjustments || {}) }
        adjustments[valueName] = parseFloat(price) || 0
        newVariants[variantIndex] = { ...newVariants[variantIndex], priceAdjustments: adjustments }
        onChange(newVariants)
    }

    const formatPrice = (price: number) => {
        if (price === 0) return ""
        return price > 0 ? `+$${price.toLocaleString()}` : `-$${Math.abs(price).toLocaleString()}`
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

        // Toggle selection: if already selected, remove it
        if (images[valueName] === imageUrl) {
            delete images[valueName]
        } else {
            images[valueName] = imageUrl
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
                                        {variant.hasPriceAdjustment && variant.priceAdjustments?.[val] !== 0 && (
                                            <span className="text-xs opacity-70">
                                                {formatPrice(variant.priceAdjustments?.[val] || 0)}
                                            </span>
                                        )}
                                    </span>
                                ))}
                            </div>

                            {/* Price Adjustment Toggle */}
                            <div className="flex items-center gap-3 pt-2 border-t">
                                <Checkbox
                                    id={`price-toggle-${index}`}
                                    checked={variant.hasPriceAdjustment || false}
                                    onCheckedChange={(checked) => handlePriceToggle(index, checked as boolean)}
                                />
                                <Label htmlFor={`price-toggle-${index}`} className="cursor-pointer text-sm font-normal">
                                    Esta variante afecta el precio
                                </Label>
                            </div>

                            {/* Price Inputs per Value */}
                            {variant.hasPriceAdjustment && (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                                    {variant.values.map((val) => (
                                        <div key={val} className="flex flex-col gap-1">
                                            <Label className="text-xs text-muted-foreground">{val}</Label>
                                            <div className="relative">
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">+$</span>
                                                <Input
                                                    type="number"
                                                    className="pl-8 h-8 text-sm"
                                                    value={variant.priceAdjustments?.[val] || ""}
                                                    onChange={(e) => handlePriceChange(index, val, e.target.value)}
                                                    placeholder="0"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                    <p className="col-span-full text-xs text-muted-foreground mt-1">
                                        Ej: XL +$5,000 se suma al precio base
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
                                        variant.values.map((val) => (
                                            <div key={val} className="flex flex-col gap-2">
                                                <Label className="text-sm font-medium">{val}</Label>
                                                <div className="flex flex-wrap gap-2">
                                                    {productImages.map((img, imgIdx) => {
                                                        const isSelected = variant.images?.[val] === img
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
                                                                <img
                                                                    src={img}
                                                                    alt={`Opción para ${val}`}
                                                                    className="w-full h-full object-cover"
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
                                        ))
                                    )}
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Selecciona la imagen que corresponde a cada valor de la variante.
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            ))}
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
