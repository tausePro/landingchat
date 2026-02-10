"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"

interface CategoryFilterProps {
    categories: string[]
    activeCategory: string | null
    primaryColor: string
}

export function CategoryFilter({ categories, activeCategory, primaryColor }: CategoryFilterProps) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const handleCategoryClick = (category: string | null) => {
        const params = new URLSearchParams(searchParams.toString())
        if (category) {
            params.set("categoria", category.toLowerCase())
        } else {
            params.delete("categoria")
        }
        const query = params.toString()
        router.push(query ? `?${query}` : ".", { scroll: false })
    }

    return (
        <div className="flex flex-wrap gap-2 mb-8">
            {/* Botón "Todos" */}
            <button
                onClick={() => handleCategoryClick(null)}
                className={cn(
                    "px-4 py-2 rounded-full text-sm font-medium transition-colors border",
                    !activeCategory
                        ? "text-white border-transparent"
                        : "text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                )}
                style={!activeCategory ? { backgroundColor: primaryColor } : undefined}
            >
                Todos
            </button>

            {/* Botones por categoría */}
            {categories.map((category) => {
                const isActive = activeCategory?.toLowerCase() === category.toLowerCase()
                return (
                    <button
                        key={category}
                        onClick={() => handleCategoryClick(category)}
                        className={cn(
                            "px-4 py-2 rounded-full text-sm font-medium transition-colors border",
                            isActive
                                ? "text-white border-transparent"
                                : "text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                        )}
                        style={isActive ? { backgroundColor: primaryColor } : undefined}
                    >
                        {category}
                    </button>
                )
            })}
        </div>
    )
}
