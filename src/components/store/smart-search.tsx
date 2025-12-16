"use client"

import { useState, useEffect, useRef } from "react"
import { Search, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ProductCard } from "@/components/store/product-card"
import { useDebounce } from "use-debounce"
import { useIsSubdomain } from "@/hooks/use-is-subdomain"
import { getStoreLink } from "@/lib/utils/store-urls"

interface SmartSearchProps {
    slug: string
    onStartChat: (query?: string) => void
    primaryColor: string
    placeholder?: string
}

interface Product {
    id: string
    name: string
    price: number
    image_url?: string
    slug?: string
}

export function SmartSearch({ slug, onStartChat, primaryColor, placeholder = "¿Qué estás buscando hoy?" }: SmartSearchProps) {
    const [query, setQuery] = useState("")
    const [debouncedQuery] = useDebounce(query, 300)
    const [results, setResults] = useState<Product[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [showResults, setShowResults] = useState(false)
    const searchRef = useRef<HTMLDivElement>(null)
    const isSubdomain = useIsSubdomain()

    // Buscar productos cuando cambie la query
    useEffect(() => {
        if (debouncedQuery.trim().length > 2) {
            searchProducts(debouncedQuery)
        } else {
            setResults([])
            setShowResults(false)
        }
    }, [debouncedQuery])

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

    const searchProducts = async (searchQuery: string) => {
        setIsLoading(true)
        try {
            const response = await fetch(`/api/store/${slug}/products?search=${encodeURIComponent(searchQuery)}&limit=6`)
            if (response.ok) {
                const data = await response.json()
                setResults(data.products || [])
                setShowResults(true)
            }
        } catch (error) {
            console.error('Error searching products:', error)
        } finally {
            setIsLoading(false)
        }
    }

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

    return (
        <div ref={searchRef} className="relative flex-1 max-w-md mx-4">
            <form onSubmit={handleSubmit} className="relative">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <Input
                        type="text"
                        placeholder={placeholder}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onFocus={() => {
                            if (results.length > 0) setShowResults(true)
                        }}
                        className="pl-10 pr-4 h-10 rounded-full border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent"
                        style={{ 
                            '--tw-ring-color': primaryColor,
                            borderColor: showResults ? primaryColor : undefined
                        } as React.CSSProperties}
                    />
                </div>
            </form>

            {/* Resultados de búsqueda */}
            {showResults && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                    {isLoading ? (
                        <div className="p-4 text-center text-gray-500">
                            Buscando...
                        </div>
                    ) : results.length > 0 ? (
                        <>
                            <div className="p-3 border-b border-gray-100">
                                <h3 className="text-sm font-medium text-gray-900">Productos encontrados</h3>
                            </div>
                            <div className="p-2 space-y-2">
                                {results.map((product) => {
                                    const productUrl = getStoreLink(`/producto/${product.slug || product.id}`, isSubdomain, slug)
                                    return (
                                    <a
                                        key={product.id}
                                        href={productUrl}
                                        className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                                        onClick={() => {
                                            setShowResults(false)
                                            setQuery("")
                                        }}
                                    >
                                        {product.image_url && (
                                            <img 
                                                src={product.image_url} 
                                                alt={product.name}
                                                className="w-12 h-12 object-cover rounded-lg"
                                            />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                                            <p className="text-sm text-gray-500">
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
                                <div className="p-3 border-t border-gray-100">
                                    <Button
                                        onClick={handleChatWithQuery}
                                        variant="outline"
                                        size="sm"
                                        className="w-full flex items-center gap-2"
                                    >
                                        <MessageCircle className="w-4 h-4" />
                                        Pregúntale al asistente sobre "{query}"
                                    </Button>
                                </div>
                            )}
                        </>
                    ) : query.trim().length > 2 ? (
                        <div className="p-4 text-center">
                            <p className="text-gray-500 mb-3">No encontramos productos para "{query}"</p>
                            <Button
                                onClick={handleChatWithQuery}
                                size="sm"
                                style={{ backgroundColor: primaryColor }}
                                className="flex items-center gap-2"
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