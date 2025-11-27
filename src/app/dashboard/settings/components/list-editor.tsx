"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, GripVertical } from "lucide-react"

interface ListItem {
    id: string
    title: string
    description?: string
    icon?: string
}

interface ListEditorProps {
    items: ListItem[]
    onItemsChange: (items: ListItem[]) => void
    title: string
    description?: string
    maxItems?: number
    itemLabel?: string
}

export function ListEditor({
    items = [],
    onItemsChange,
    title,
    description,
    maxItems = 6,
    itemLabel = "Elemento"
}: ListEditorProps) {
    const handleAddItem = () => {
        if (items.length >= maxItems) return

        const newItem: ListItem = {
            id: Math.random().toString(36).substring(7),
            title: "",
            description: ""
        }

        onItemsChange([...items, newItem])
    }

    const handleRemoveItem = (index: number) => {
        const newItems = [...items]
        newItems.splice(index, 1)
        onItemsChange(newItems)
    }

    const handleUpdateItem = (index: number, field: keyof ListItem, value: string) => {
        const newItems = [...items]
        newItems[index] = { ...newItems[index], [field]: value }
        onItemsChange(newItems)
    }

    return (
        <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark shadow-sm">
            <div className="p-6 border-b border-border-light dark:border-border-dark flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-semibold">{title}</h2>
                    {description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {description}
                        </p>
                    )}
                </div>
                <Button
                    onClick={handleAddItem}
                    disabled={items.length >= maxItems}
                    size="sm"
                    variant="outline"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar {itemLabel}
                </Button>
            </div>
            <div className="p-6 space-y-6">
                {items.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 border-2 border-dashed rounded-lg">
                        No hay elementos configurados. Agrega uno para empezar.
                    </div>
                ) : (
                    items.map((item, index) => (
                        <div key={item.id} className="flex gap-4 items-start bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-100 dark:border-gray-800">
                            <div className="mt-3 text-gray-400 cursor-move">
                                <GripVertical className="w-5 h-5" />
                            </div>
                            <div className="flex-1 space-y-4">
                                <div>
                                    <Label className="text-xs text-gray-500 mb-1.5 block">
                                        Título
                                    </Label>
                                    <Input
                                        value={item.title}
                                        onChange={(e) => handleUpdateItem(index, "title", e.target.value)}
                                        placeholder={`Título del ${itemLabel.toLowerCase()}`}
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs text-gray-500 mb-1.5 block">
                                        Descripción
                                    </Label>
                                    <Textarea
                                        value={item.description}
                                        onChange={(e) => handleUpdateItem(index, "description", e.target.value)}
                                        placeholder={`Descripción del ${itemLabel.toLowerCase()}`}
                                        rows={2}
                                    />
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                onClick={() => handleRemoveItem(index)}
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
