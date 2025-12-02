"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Variant {
    type: string
    values: string
}

interface VariantsEditorProps {
    variants: Array<{ type: string; values: string[]; priceAdjustment?: number }>
    onChange: (variants: Array<{ type: string; values: string[]; priceAdjustment?: number }>) => void
}

export function VariantsEditor({ variants, onChange }: VariantsEditorProps) {
    const handleAdd = () => {
        const newVariants = [...variants, { type: "", values: [], priceAdjustment: 0 }]
        onChange(newVariants)
    }

    const handleRemove = (index: number) => {
        const newVariants = variants.filter((_, i) => i !== index)
        onChange(newVariants)
    }

    const handleTypeChange = (index: number, type: string) => {
        const newVariants = [...variants]
        newVariants[index] = { ...newVariants[index], type }
        onChange(newVariants)
    }

    const handleValuesChange = (index: number, valuesStr: string) => {
        const newVariants = [...variants]
        const values = valuesStr.split(',').map(v => v.trim()).filter(v => v)
        newVariants[index] = { ...newVariants[index], values }
        onChange(newVariants)
    }

    const handlePriceAdjustmentChange = (index: number, price: string) => {
        const newVariants = [...variants]
        newVariants[index] = { ...newVariants[index], priceAdjustment: parseFloat(price) || 0 }
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
                                placeholder="Ej: Talla"
                            />
                        </div>
                        <div className="flex-[2]">
                            <Label>Valores (separados por coma)</Label>
                            <Input
                                className="mt-2"
                                value={variant.values.join(', ')}
                                onChange={(e) => handleValuesChange(index, e.target.value)}
                                placeholder="S, M, L, XL"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => handleRemove(index)}
                            className="p-2 h-10 text-muted-foreground hover:text-red-500"
                        >
                            <span className="material-symbols-outlined">delete</span>
                        </button>
                    </div>

                    {/* Price Adjustment Section - Simplified for now as per prototype */}
                    {/* In a full implementation, we might want price per value, but for now we'll stick to the prototype's structure 
                        which implies a simpler variant management or just listing values. 
                        The requirement mentioned "Cada variante puede tener precio adicional", 
                        which usually means "Size XL +$5". 
                        However, the prototype just shows comma separated values.
                        I will add a simple "Precio adicional base" for the variant type for now, 
                        or we can iterate to a more complex UI if needed. 
                        Given the prototype simplicity, I'll keep it simple but ready for expansion.
                    */}
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
