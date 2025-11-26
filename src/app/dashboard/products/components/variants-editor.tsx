"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Variant {
    type: string
    values: string
}

interface VariantsEditorProps {
    variants: Array<{ type: string; values: string[] }>
    onChange: (variants: Array<{ type: string; values: string[] }>) => void
}

export function VariantsEditor({ variants, onChange }: VariantsEditorProps) {
    // Convert to internal format (values as comma-separated string)
    const internalVariants: Variant[] = variants.map(v => ({
        type: v.type,
        values: v.values.join(', ')
    }))

    const handleAdd = () => {
        const newVariants = [...variants, { type: "", values: [] }]
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

    return (
        <div className="flex flex-col gap-6">
            {variants.map((variant, index) => (
                <div key={index} className="flex items-end gap-4">
                    <div className="flex-1">
                        {index === 0 && <Label>Tipo de variante</Label>}
                        <Input
                            className="mt-2"
                            value={variant.type}
                            onChange={(e) => handleTypeChange(index, e.target.value)}
                            placeholder="Ej: Talla"
                        />
                    </div>
                    <div className="flex-1">
                        {index === 0 && <Label>Valores (separados por coma)</Label>}
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
