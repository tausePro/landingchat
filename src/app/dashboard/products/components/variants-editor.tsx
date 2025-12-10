"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface VariantsEditorProps {
    variants: Array<{ type: string; values: string[]; priceAdjustment?: number }>
    onChange: (variants: Array<{ type: string; values: string[]; priceAdjustment?: number }>) => void
}

export function VariantsEditor({ variants, onChange }: VariantsEditorProps) {
    // Local state for input values (allows free typing)
    const [localValues, setLocalValues] = useState<string[]>(
        variants.map(v => v.values.join(', '))
    )

    // Sync local state when variants prop changes externally
    useEffect(() => {
        setLocalValues(variants.map(v => v.values.join(', ')))
    }, [variants.length]) // Only sync when number of variants changes

    const handleAdd = () => {
        const newVariants = [...variants, { type: "", values: [], priceAdjustment: 0 }]
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

    // Update local input value (does not trigger parent onChange)
    const handleLocalValueChange = (index: number, value: string) => {
        const newLocalValues = [...localValues]
        newLocalValues[index] = value
        setLocalValues(newLocalValues)
    }

    // Parse and commit values to parent state (on blur or Enter)
    const commitValues = (index: number) => {
        const valuesStr = localValues[index] || ""
        // Split by comma, trim whitespace, filter empty
        const values = valuesStr.split(',').map(v => v.trim()).filter(v => v.length > 0)

        const newVariants = [...variants]
        newVariants[index] = { ...newVariants[index], values }
        onChange(newVariants)

        // Update local value to normalized format
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
                            <p className="text-xs text-muted-foreground mt-1">
                                Presiona Enter o haz clic afuera para confirmar
                            </p>
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
                        <div className="flex flex-wrap gap-2">
                            {variant.values.map((val, valIndex) => (
                                <span
                                    key={valIndex}
                                    className="px-2 py-1 bg-primary/10 text-primary text-sm rounded-md"
                                >
                                    {val}
                                </span>
                            ))}
                        </div>
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
