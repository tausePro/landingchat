"use client"

import Image from "next/image"
import { useState, useEffect, useRef, useCallback } from "react"
import { Search, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useDebounce } from "use-debounce"
import { useIsSubdomain } from "@/hooks/use-is-subdomain"
import { getStoreLink } from "@/lib/utils/store-urls"
import { useTracking } from "@/components/analytics/tracking-provider"

interface SmartSearchProps {
    slug: string
    onStartChat: (query?: string) => void
    primaryColor: string
    placeholder?: string
    visualVariant?: "default" | "glass"
}

interface Product {
    id: string
    name: string
    price: number
    image_url?: string
    slug?: string
}

export function SmartSearch({ slug, onStartChat, primaryColor, placeholder = "¿Qué estás buscando hoy?", visualVariant = "default" }: SmartSearchProps) {
    const [query, setQuery] = useState("")
    const [debouncedQuery] = useDebounce(query, 300)
    const [results, setResults] = useState<Product[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [showResults, setShowResults] = useState(false)
    const searchRef = useRef<HTMLDivElement>(null)
    const isSubdomain = useIsSubdomain()
    const { trackSearch } = useTracking()

    const searchProducts = useCallback(async (searchQuery: string) => {
        setIsLoading(true)
        try {
            const response = await fetch(`/api/store/${slug}/products?search=${encodeURIComponent(searchQuery)}&limit=6`)
            if (response.ok) {
                const data = await response.json()
                const products = data.products || []
                setResults(products)
                setShowResults(true)
                
                // Track Search event en Meta Pixel
                const contentIds = products.map((p: Product) => p.id)
                trackSearch(searchQuery, contentIds)
            }
        } catch (error) {
            console.error('Error searching products:', error)
        } finally {
            setIsLoading(false)
        }
    }, [slug, trackSearch])

    // Buscar productos cuando cambie la query
    useEffect(() => {
        if (debouncedQuery.trim().length > 2) {
            searchProducts(debouncedQuery)
        } else {
            setResults([])
            setShowResults(false)
        }
    }, [debouncedQuery, searchProducts])

    // Cerrar resultados al hacer click fuera
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowResults(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (query.trim()) {
            // Si hay resultados, mostrarlos; si no, abrir chat
            if (results.length === 0) {
                onStartChat(query)
            }
        }
    }

    const handleChatWithQuery = () => {
        onStartChat(query)
        setShowResults(false)
        setQuery("")
    }

    const isGlassVariant = visualVariant === "glass"

    return (
        <div ref={searchRef} className="relative mx-4 flex-1 max-w-md">
            <form onSubmit={handleSubmit} className="relative">
                <div className="relative">
                    <Search className={`absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 ${isGlassVariant ? "text-slate-400" : "text-gray-400"}`} />
                    <Input
                        type="text"
                        placeholder={placeholder}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onFocus={() => {
                            if (results.length > 0) setShowResults(true)
                        }}
                        className={isGlassVariant
                            ? "h-12 rounded-full border-white/60 bg-white/70 pl-10 pr-4 text-sm text-slate-700 shadow-[0_12px_32px_rgba(15,23,42,0.08)] backdrop-blur-xl placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-offset-0"
                            : "h-10 rounded-full border-gray-300 pl-10 pr-4 focus:border-transparent focus:ring-2 focus:ring-primary"
                        }
                        style={{ 
                            '--tw-ring-color': primaryColor,
                            borderColor: showResults ? primaryColor : undefined
                        } as React.CSSProperties}
                    />
                </div>
            </form>

            {/* Resultados de búsqueda */}
            {showResults && (
                <div className={isGlassVariant
                    ? "absolute left-0 right-0 top-full z-50 mt-3 max-h-96 overflow-y-auto rounded-[28px] border border-white/70 bg-white/82 shadow-[0_28px_90px_rgba(15,23,42,0.18)] backdrop-blur-2xl"
                    : "absolute top-full left-0 right-0 mt-2 z-50 max-h-96 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg"
                }>
                    {isLoading ? (
                        <div className={`p-4 text-center ${isGlassVariant ? "text-slate-500" : "text-gray-500"}`}>
                            Buscando...
                        </div>
                    ) : results.length > 0 ? (
                        <>
                            <div className={isGlassVariant ? "border-b border-white/60 p-4" : "border-b border-gray-100 p-3"}>
                                <h3 className={isGlassVariant ? "text-sm font-semibold text-slate-900" : "text-sm font-medium text-gray-900"}>Productos encontrados</h3>
                            </div>
                            <div className="p-2 space-y-2">
                                {results.map((product) => {
                                    const productUrl = getStoreLink(`/producto/${product.slug || product.id}`, isSubdomain, slug)
                                    return (
                                    <a
                                        key={product.id}
                                        href={productUrl}
                                        className={isGlassVariant
                                            ? "flex cursor-pointer items-center gap-3 rounded-2xl p-3 transition-colors hover:bg-white/70"
                                            : "flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-gray-50"
                                        }
                                        onClick={() => {
                                            setShowResults(false)
                                            setQuery("")
                                        }}
                                    >
                                        {product.image_url && (
                                            <div className={isGlassVariant ? "relative h-14 w-14 overflow-hidden rounded-2xl border border-white/60 bg-white/70" : "relative h-12 w-12 overflow-hidden rounded-lg"}>
                                                <Image
                                                    src={product.image_url}
                                                    alt={product.name}
                                                    fill
                                                    sizes={isGlassVariant ? "56px" : "48px"}
                                                    className="object-cover"
                                                />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className={isGlassVariant ? "truncate text-sm font-semibold text-slate-900" : "truncate text-sm font-medium text-gray-900"}>{product.name}</p>
                                            <p className={isGlassVariant ? "text-sm text-slate-500" : "text-sm text-gray-500"}>
                                                {new Intl.NumberFormat('es-CO', {
                                                    style: 'currency',
                                                    currency: 'COP',
                                                    minimumFractionDigits: 0
                                                }).format(product.price)}
                                            </p>
                                        </div>
                                    </a>
                                    )
                                })}
                            </div>
                            {query.trim() && (
                                <div className={isGlassVariant ? "border-t border-white/60 p-4" : "border-t border-gray-100 p-3"}>
                                    <Button
                                        onClick={handleChatWithQuery}
                                        variant="outline"
                                        size="sm"
                                        className={isGlassVariant
                                            ? "flex w-full items-center gap-2 rounded-full border-white/70 bg-white/70 font-medium text-slate-700 backdrop-blur hover:bg-white"
                                            : "flex w-full items-center gap-2"
                                        }
                                    >
                                        <MessageCircle className="w-4 h-4" />
                                        Pregúntale al asistente sobre &ldquo;{query}&rdquo;
                                    </Button>
                                </div>
                            )}
                        </>
                    ) : query.trim().length > 2 ? (
                        <div className="p-4 text-center">
                            <p className={isGlassVariant ? "mb-3 text-slate-500" : "mb-3 text-gray-500"}>No encontramos productos para &ldquo;{query}&rdquo;</p>
                            <Button
                                onClick={handleChatWithQuery}
                                size="sm"
                                style={{ backgroundColor: primaryColor }}
                                className={isGlassVariant ? "mx-auto flex items-center gap-2 rounded-full px-5 shadow-lg" : "flex items-center gap-2"}
                            >
                                <MessageCircle className="w-4 h-4" />
                                Pregúntale al asistente
                            </Button>
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    )
}