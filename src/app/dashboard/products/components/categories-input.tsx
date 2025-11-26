"use client"

import { useState, KeyboardEvent } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface CategoriesInputProps {
    categories: string[]
    onChange: (categories: string[]) => void
}

export function CategoriesInput({ categories, onChange }: CategoriesInputProps) {
    const [inputValue, setInputValue] = useState("")

    const handleAdd = () => {
        const trimmed = inputValue.trim()
        if (trimmed && !categories.includes(trimmed)) {
            onChange([...categories, trimmed])
            setInputValue("")
        }
    }

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault()
            handleAdd()
        }
    }

    const handleRemove = (categoryToRemove: string) => {
        onChange(categories.filter(cat => cat !== categoryToRemove))
    }

    return (
        <div className="space-y-2">
            <div className="flex gap-2">
                <Input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ej: Ropa, Tecnología..."
                    className="flex-1"
                />
                <Button
                    type="button"
                    variant="outline"
                    onClick={handleAdd}
                    disabled={!inputValue.trim()}
                >
                    Agregar
                </Button>
            </div>
            {categories.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                    {categories.map((category) => (
                        <Badge
                            key={category}
                            variant="secondary"
                            className="pl-3 pr-1 py-1"
                        >
                            <span>{category}</span>
                            <button
                                type="button"
                                onClick={() => handleRemove(category)}
                                className="ml-1 hover:text-red-500 focus:outline-none"
                            >
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        </Badge>
                    ))}
                </div>
            )}
        </div>
    )
}
