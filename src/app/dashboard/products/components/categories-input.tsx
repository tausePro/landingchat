"use client"

import { useState, useEffect, useRef, KeyboardEvent } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getOrganizationCategories } from "../actions"

interface CategoriesInputProps {
    categories: string[]
    onChange: (categories: string[]) => void
}

export function CategoriesInput({ categories, onChange }: CategoriesInputProps) {
    const [inputValue, setInputValue] = useState("")
    const [suggestions, setSuggestions] = useState<Array<{ name: string; productCount: number }>>([])
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [highlightedIndex, setHighlightedIndex] = useState(-1)
    const wrapperRef = useRef<HTMLDivElement>(null)

    // Cargar categorías existentes de la organización
    useEffect(() => {
        getOrganizationCategories().then((result) => {
            if (result.success && result.data) {
                setSuggestions(result.data)
            }
        })
    }, [])

    // Cerrar dropdown al hacer click fuera
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setShowSuggestions(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const filteredSuggestions = suggestions.filter(
        (s) =>
            !categories.includes(s.name) &&
            s.name.toLowerCase().includes(inputValue.toLowerCase())
    )

    const handleAdd = (value?: string) => {
        const trimmed = (value || inputValue).trim()
        if (trimmed && !categories.includes(trimmed)) {
            onChange([...categories, trimmed])
            setInputValue("")
            setShowSuggestions(false)
            setHighlightedIndex(-1)
        }
    }

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault()
            if (highlightedIndex >= 0 && highlightedIndex < filteredSuggestions.length) {
                handleAdd(filteredSuggestions[highlightedIndex].name)
            } else {
                handleAdd()
            }
        } else if (e.key === "ArrowDown") {
            e.preventDefault()
            setHighlightedIndex((prev) =>
                prev < filteredSuggestions.length - 1 ? prev + 1 : prev
            )
        } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1))
        } else if (e.key === "Escape") {
            setShowSuggestions(false)
        }
    }

    const handleRemove = (categoryToRemove: string) => {
        onChange(categories.filter(cat => cat !== categoryToRemove))
    }

    return (
        <div className="space-y-2" ref={wrapperRef}>
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Input
                        value={inputValue}
                        onChange={(e) => {
                            setInputValue(e.target.value)
                            setShowSuggestions(true)
                            setHighlightedIndex(-1)
                        }}
                        onFocus={() => setShowSuggestions(true)}
                        onKeyDown={handleKeyDown}
                        placeholder="Buscar o crear categoría..."
                        className="w-full"
                    />
                    {showSuggestions && (inputValue || filteredSuggestions.length > 0) && (
                        <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                            {filteredSuggestions.map((suggestion, index) => (
                                <button
                                    key={suggestion.name}
                                    type="button"
                                    onClick={() => handleAdd(suggestion.name)}
                                    className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-accent transition-colors ${
                                        index === highlightedIndex ? "bg-accent" : ""
                                    }`}
                                >
                                    <span>{suggestion.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                        {suggestion.productCount} prod.
                                    </span>
                                </button>
                            ))}
                            {inputValue.trim() &&
                                !suggestions.some(
                                    (s) => s.name.toLowerCase() === inputValue.trim().toLowerCase()
                                ) && (
                                    <button
                                        type="button"
                                        onClick={() => handleAdd()}
                                        className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-accent transition-colors border-t border-border"
                                    >
                                        + Crear &ldquo;{inputValue.trim()}&rdquo;
                                    </button>
                                )}
                        </div>
                    )}
                </div>
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleAdd()}
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
