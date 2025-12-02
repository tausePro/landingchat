"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export interface ConfigOption {
    name: string
    type: 'text' | 'select' | 'number' | 'color'
    required: boolean
    placeholder?: string
    max_length?: number
    choices?: string[]
    min?: number
    max?: number
    default?: any
    affects_preview?: boolean // Si esta opción afecta la previsualización
}

interface ConfigurableOptionsEditorProps {
    options: ConfigOption[]
    onChange: (options: ConfigOption[]) => void
}

export function ConfigurableOptionsEditor({ options, onChange }: ConfigurableOptionsEditorProps) {
    const [editingIndex, setEditingIndex] = useState<number | null>(null)

    const addOption = () => {
        const newOption: ConfigOption = {
            name: "",
            type: "text",
            required: true,
            affects_preview: false
        }
        onChange([...options, newOption])
        setEditingIndex(options.length)
    }

    const updateOption = (index: number, updates: Partial<ConfigOption>) => {
        const updated = [...options]
        updated[index] = { ...updated[index], ...updates }
        onChange(updated)
    }

    const removeOption = (index: number) => {
        onChange(options.filter((_, i) => i !== index))
        if (editingIndex === index) setEditingIndex(null)
    }

    const moveOption = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return
        if (direction === 'down' && index === options.length - 1) return

        const newIndex = direction === 'up' ? index - 1 : index + 1
        const updated = [...options]
        const temp = updated[index]
        updated[index] = updated[newIndex]
        updated[newIndex] = temp
        onChange(updated)
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary">
                    Opciones de Personalización
                </h3>
                <Button type="button" onClick={addOption} size="sm" variant="outline">
                    <span className="material-symbols-outlined text-sm mr-1">add</span>
                    Agregar Opción
                </Button>
            </div>

            {options.length === 0 && (
                <div className="text-center py-8 text-text-light-secondary dark:text-text-dark-secondary text-sm">
                    No hay opciones configuradas. Agrega una opción para comenzar.
                </div>
            )}

            <div className="space-y-3">
                {options.map((option, index) => (
                    <div
                        key={index}
                        className="border border-border-light dark:border-border-dark rounded-lg p-4 bg-white dark:bg-gray-800"
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                                <Input
                                    placeholder="Nombre de la opción (ej: Texto Personalizado)"
                                    value={option.name}
                                    onChange={(e) => updateOption(index, { name: e.target.value })}
                                    className="font-medium"
                                />
                            </div>
                            <div className="flex items-center gap-1 ml-2">
                                <button
                                    type="button"
                                    onClick={() => moveOption(index, 'up')}
                                    disabled={index === 0}
                                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                >
                                    <span className="material-symbols-outlined text-sm">arrow_upward</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => moveOption(index, 'down')}
                                    disabled={index === options.length - 1}
                                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                >
                                    <span className="material-symbols-outlined text-sm">arrow_downward</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => removeOption(index)}
                                    className="p-1 text-red-400 hover:text-red-600"
                                >
                                    <span className="material-symbols-outlined text-sm">delete</span>
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs">Tipo</Label>
                                <select
                                    value={option.type}
                                    onChange={(e) => updateOption(index, { type: e.target.value as any })}
                                    className="form-select mt-1 w-full rounded-lg bg-background-light dark:bg-background-dark text-text-light-primary dark:text-text-dark-primary text-sm h-9 border border-border-light dark:border-border-dark"
                                >
                                    <option value="text">Texto</option>
                                    <option value="select">Selección</option>
                                    <option value="number">Número</option>
                                    <option value="color">Color</option>
                                </select>
                            </div>

                            <div className="flex items-center gap-4 pt-6">
                                <label className="flex items-center gap-2 text-xs cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={option.required}
                                        onChange={(e) => updateOption(index, { required: e.target.checked })}
                                        className="rounded"
                                    />
                                    Requerido
                                </label>
                                <label className="flex items-center gap-2 text-xs cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={option.affects_preview || false}
                                        onChange={(e) => updateOption(index, { affects_preview: e.target.checked })}
                                        className="rounded"
                                    />
                                    Afecta vista previa
                                </label>
                            </div>
                        </div>

                        {/* Type-specific fields */}
                        {option.type === 'text' && (
                            <div className="grid grid-cols-2 gap-3 mt-3">
                                <div>
                                    <Label className="text-xs">Placeholder</Label>
                                    <Input
                                        placeholder="Ej: Escribe tu texto aquí"
                                        value={option.placeholder || ""}
                                        onChange={(e) => updateOption(index, { placeholder: e.target.value })}
                                        className="mt-1 text-sm h-9"
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs">Longitud Máxima</Label>
                                    <Input
                                        type="number"
                                        placeholder="50"
                                        value={option.max_length || ""}
                                        onChange={(e) => updateOption(index, { max_length: parseInt(e.target.value) || undefined })}
                                        className="mt-1 text-sm h-9"
                                    />
                                </div>
                            </div>
                        )}

                        {option.type === 'select' && (
                            <div className="mt-3">
                                <Label className="text-xs">Opciones (separadas por coma)</Label>
                                <Input
                                    placeholder="Bordado, Estampado, Sublimado"
                                    value={option.choices?.join(', ') || ""}
                                    onChange={(e) => updateOption(index, {
                                        choices: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                                    })}
                                    className="mt-1 text-sm h-9"
                                />
                            </div>
                        )}

                        {option.type === 'number' && (
                            <div className="grid grid-cols-3 gap-3 mt-3">
                                <div>
                                    <Label className="text-xs">Mínimo</Label>
                                    <Input
                                        type="number"
                                        placeholder="1"
                                        value={option.min || ""}
                                        onChange={(e) => updateOption(index, { min: parseInt(e.target.value) || undefined })}
                                        className="mt-1 text-sm h-9"
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs">Máximo</Label>
                                    <Input
                                        type="number"
                                        placeholder="100"
                                        value={option.max || ""}
                                        onChange={(e) => updateOption(index, { max: parseInt(e.target.value) || undefined })}
                                        className="mt-1 text-sm h-9"
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs">Por Defecto</Label>
                                    <Input
                                        type="number"
                                        placeholder="1"
                                        value={option.default || ""}
                                        onChange={(e) => updateOption(index, { default: parseInt(e.target.value) || undefined })}
                                        className="mt-1 text-sm h-9"
                                    />
                                </div>
                            </div>
                        )}

                        {option.type === 'color' && (
                            <div className="mt-3">
                                <Label className="text-xs">Colores Disponibles (separados por coma)</Label>
                                <Input
                                    placeholder="Blanco, Negro, Dorado, Plateado"
                                    value={option.choices?.join(', ') || ""}
                                    onChange={(e) => updateOption(index, {
                                        choices: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                                    })}
                                    className="mt-1 text-sm h-9"
                                />
                                <p className="text-xs text-gray-500 mt-1">También puedes usar códigos hex: #FFFFFF, #000000</p>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
