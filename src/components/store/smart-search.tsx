"use client"

import {
    Fragment,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Search, MessageCircle, ArrowRight, Sparkles } from "lucide-react"
import { useDebounce } from "use-debounce"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useIsSubdomain } from "@/hooks/use-is-subdomain"
import { getStoreLink } from "@/lib/utils/store-urls"
import { useTracking } from "@/components/analytics/tracking-provider"
import { buildHighlightSegments } from "@/lib/storefront/highlight-match"
import type { VariantPriceRange } from "@/types/product"

import styles from "./smart-search.module.css"

type DropdownState = "closed" | "opening" | "open" | "closing"

const DROPDOWN_CLOSE_DURATION_MS = 150

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
    price_range?: VariantPriceRange
    image_url?: string
    slug?: string
}

interface SuggestionRow {
    id: string
    name: string
    similarity: number
}

const SEARCH_LIMIT = 12
const SUGGESTIONS_LIMIT = 5
const MIN_QUERY_LENGTH = 2

const currencyFormatter = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
})

function HighlightedText({ text, query }: { text: string; query: string }) {
    const segments = useMemo(
        () => buildHighlightSegments(text, query),
        [text, query],
    )
    return (
        <>
            {segments.map((segment, idx) => (
                <Fragment key={idx}>
                    {segment.isMatch ? (
                        <mark className="bg-yellow-100 text-slate-900 font-semibold rounded px-0.5">
                            {segment.text}
                        </mark>
                    ) : (
                        segment.text
                    )}
                </Fragment>
            ))}
        </>
    )
}

function ResultSkeleton() {
    return (
        <div
            role="status"
            aria-label="Buscando productos"
            className="px-3 py-2 space-y-2"
        >
            {[0, 1, 2].map((i) => (
                <div
                    key={i}
                    className="flex items-center gap-3 p-2 rounded-lg animate-pulse"
                >
                    <div className="w-12 h-12 rounded-lg bg-slate-200" />
                    <div className="flex-1 min-w-0 space-y-2">
                        <div className="h-3 w-3/4 bg-slate-200 rounded" />
                        <div className="h-3 w-1/3 bg-slate-100 rounded" />
                    </div>
                </div>
            ))}
        </div>
    )
}

export function SmartSearch({
    slug,
    onStartChat,
    primaryColor,
    placeholder = "¿Qué estás buscando hoy?",
}: SmartSearchProps) {
    const [query, setQuery] = useState("")
    const [debouncedQuery] = useDebounce(query, 250)
    const [results, setResults] = useState<Product[]>([])
    const [suggestions, setSuggestions] = useState<SuggestionRow[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [showResults, setShowResults] = useState(false)
    const [dropdownState, setDropdownState] = useState<DropdownState>("closed")
    const [selectedIndex, setSelectedIndex] = useState(-1)
    const [hasSearchedOnce, setHasSearchedOnce] = useState(false)

    const searchRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const isSubdomain = useIsSubdomain()
    const router = useRouter()
    const { trackSearch } = useTracking()

    const trimmedQuery = debouncedQuery.trim()
    const isQueryActionable = trimmedQuery.length >= MIN_QUERY_LENGTH

    const productsResultsLink = useMemo(() => {
        if (!trimmedQuery) return ""
        return getStoreLink(
            `/productos?q=${encodeURIComponent(trimmedQuery)}`,
            isSubdomain,
            slug,
        )
    }, [trimmedQuery, isSubdomain, slug])

    const fetchSuggestions = useCallback(
        async (rawQuery: string, abortSignal: AbortSignal) => {
            try {
                const response = await fetch(
                    `/api/store/${slug}/search-suggestions?q=${encodeURIComponent(rawQuery)}&limit=${SUGGESTIONS_LIMIT}`,
                    { signal: abortSignal },
                )
                if (!response.ok) return [] as SuggestionRow[]
                const data = await response.json()
                if (!Array.isArray(data?.suggestions)) return [] as SuggestionRow[]
                return data.suggestions as SuggestionRow[]
            } catch (error) {
                if ((error as { name?: string })?.name === "AbortError") {
                    return null
                }
                console.error("[SmartSearch] suggestions fetch failed:", error)
                return [] as SuggestionRow[]
            }
        },
        [slug],
    )

    const searchProducts = useCallback(
        async (rawQuery: string, abortSignal: AbortSignal) => {
            setIsLoading(true)
            try {
                const response = await fetch(
                    `/api/store/${slug}/products?search=${encodeURIComponent(rawQuery)}&limit=${SEARCH_LIMIT}`,
                    { signal: abortSignal },
                )
                if (!response.ok) {
                    setResults([])
                    setSuggestions([])
                    return
                }
                const data = await response.json()
                const products: Product[] = Array.isArray(data?.products)
                    ? data.products
                    : []
                setResults(products)
                setShowResults(true)
                setSelectedIndex(-1)
                setHasSearchedOnce(true)

                trackSearch(
                    rawQuery,
                    products.map((p) => p.id),
                )

                // Si no hay resultados exactos, pedir sugerencias fuzzy en paralelo
                if (products.length === 0) {
                    const suggestionList = await fetchSuggestions(
                        rawQuery,
                        abortSignal,
                    )
                    if (suggestionList === null) return // aborted
                    setSuggestions(suggestionList)
                } else {
                    setSuggestions([])
                }
            } catch (error) {
                if ((error as { name?: string })?.name === "AbortError") return
                console.error("[SmartSearch] search failed:", error)
                setResults([])
                setSuggestions([])
            } finally {
                setIsLoading(false)
            }
        },
        [slug, trackSearch, fetchSuggestions],
    )

    useEffect(() => {
        const controller = new AbortController()

        if (trimmedQuery.length >= MIN_QUERY_LENGTH) {
            searchProducts(trimmedQuery, controller.signal)
        } else {
            setResults([])
            setSuggestions([])
            setShowResults(false)
            setSelectedIndex(-1)
            setHasSearchedOnce(false)
        }

        return () => controller.abort()
    }, [trimmedQuery, searchProducts])

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                searchRef.current &&
                !searchRef.current.contains(event.target as Node)
            ) {
                setShowResults(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () =>
            document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    // Orquesta la transición menu-dropdown del catálogo transitions-motion.
    // closed -> opening -> open al abrir (rAF para que el estilo inicial se aplique antes del transition).
    // open -> closing -> closed al cerrar (timeout = --dropdown-close-dur del CSS).
    useEffect(() => {
        if (showResults) {
            if (dropdownState === "closed" || dropdownState === "closing") {
                setDropdownState("opening")
                const rafId = requestAnimationFrame(() => {
                    setDropdownState("open")
                })
                return () => cancelAnimationFrame(rafId)
            }
            return undefined
        }
        if (dropdownState === "open" || dropdownState === "opening") {
            setDropdownState("closing")
            const timer = window.setTimeout(() => {
                setDropdownState("closed")
            }, DROPDOWN_CLOSE_DURATION_MS)
            return () => window.clearTimeout(timer)
        }
        return undefined
    }, [showResults, dropdownState])

    const closeAndReset = useCallback(() => {
        setShowResults(false)
        setQuery("")
        setSelectedIndex(-1)
    }, [])

    const handleChatWithQuery = useCallback(() => {
        onStartChat(query)
        closeAndReset()
    }, [onStartChat, query, closeAndReset])

    const handleSelectProduct = useCallback(
        (product: Product) => {
            const url = getStoreLink(
                `/producto/${product.slug || product.id}`,
                isSubdomain,
                slug,
            )
            closeAndReset()
            router.push(url)
        },
        [closeAndReset, isSubdomain, router, slug],
    )

    const handleSelectSuggestion = useCallback(
        (suggestion: SuggestionRow) => {
            // En lugar de navegar al producto, llenar el input con el nombre
            // sugerido para que el usuario vea los resultados completos.
            setQuery(suggestion.name)
            inputRef.current?.focus()
        },
        [],
    )

    const handleKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLInputElement>) => {
            if (!showResults || isLoading) return

            if (event.key === "Escape") {
                event.preventDefault()
                setShowResults(false)
                inputRef.current?.blur()
                return
            }

            if (event.key === "ArrowDown") {
                event.preventDefault()
                setSelectedIndex((prev) => {
                    const next = prev + 1
                    return next >= results.length ? 0 : next
                })
                return
            }

            if (event.key === "ArrowUp") {
                event.preventDefault()
                setSelectedIndex((prev) => {
                    const next = prev - 1
                    return next < 0 ? results.length - 1 : next
                })
                return
            }

            if (event.key === "Enter") {
                event.preventDefault()
                if (selectedIndex >= 0 && results[selectedIndex]) {
                    handleSelectProduct(results[selectedIndex])
                } else if (results.length > 0 && productsResultsLink) {
                    closeAndReset()
                    router.push(productsResultsLink)
                } else if (trimmedQuery && results.length === 0) {
                    handleChatWithQuery()
                }
            }
        },
        [
            showResults,
            isLoading,
            results,
            selectedIndex,
            handleSelectProduct,
            productsResultsLink,
            closeAndReset,
            router,
            trimmedQuery,
            handleChatWithQuery,
        ],
    )

    const showFooterCta =
        results.length > 0 &&
        productsResultsLink &&
        results.length >= SEARCH_LIMIT
    const showEmptyWithSuggestions =
        hasSearchedOnce &&
        !isLoading &&
        results.length === 0 &&
        suggestions.length > 0
    const showEmptyNoSuggestions =
        hasSearchedOnce &&
        !isLoading &&
        results.length === 0 &&
        suggestions.length === 0

    return (
        <div ref={searchRef} className={`${styles.container} relative flex-1 max-w-md mx-4`}>
            <form
                onSubmit={(event) => {
                    event.preventDefault()
                    if (trimmedQuery && results.length === 0 && !isLoading) {
                        handleChatWithQuery()
                    } else if (trimmedQuery && results.length > 0 && productsResultsLink) {
                        closeAndReset()
                        router.push(productsResultsLink)
                    }
                }}
                className="relative"
            >
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 pointer-events-none" />
                    <Input
                        ref={inputRef}
                        type="text"
                        placeholder={placeholder}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onFocus={() => {
                            if (
                                results.length > 0 ||
                                hasSearchedOnce ||
                                isLoading
                            ) {
                                setShowResults(true)
                            }
                        }}
                        onKeyDown={handleKeyDown}
                        role="combobox"
                        aria-expanded={showResults}
                        aria-controls="smart-search-results"
                        aria-autocomplete="list"
                        aria-activedescendant={
                            selectedIndex >= 0
                                ? `smart-search-item-${selectedIndex}`
                                : undefined
                        }
                        className="pl-10 pr-4 h-10 rounded-full border-slate-300 focus:ring-2 focus:border-transparent"
                        style={
                            {
                                "--tw-ring-color": primaryColor,
                                borderColor: showResults
                                    ? primaryColor
                                    : undefined,
                            } as React.CSSProperties
                        }
                    />
                </div>
            </form>

            {dropdownState !== "closed" && (
                <div
                    id="smart-search-results"
                    role="listbox"
                    data-state={dropdownState}
                    aria-hidden={dropdownState === "closing"}
                    className={`${styles.dropdown} absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-[28rem] overflow-y-auto`}
                >
                    {isLoading && <ResultSkeleton />}

                    {!isLoading && results.length > 0 && (
                        <>
                            <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                                    {results.length === SEARCH_LIMIT
                                        ? `Más de ${SEARCH_LIMIT} resultados`
                                        : `${results.length} ${results.length === 1 ? "producto encontrado" : "productos encontrados"}`}
                                </p>
                                <kbd className="hidden sm:inline-flex items-center gap-1 text-[10px] text-slate-400">
                                    <span className="font-mono">↑↓</span>
                                    para navegar
                                </kbd>
                            </div>
                            <div className="p-2">
                                {results.map((product, idx) => {
                                    const productUrl = getStoreLink(
                                        `/producto/${product.slug || product.id}`,
                                        isSubdomain,
                                        slug,
                                    )
                                    const priceLabel = product.price_range
                                        ?.has_range
                                        ? `${currencyFormatter.format(product.price_range.min_price)} - ${currencyFormatter.format(product.price_range.max_price)}`
                                        : currencyFormatter.format(product.price)
                                    const isSelected = idx === selectedIndex
                                    return (
                                        <a
                                            key={product.id}
                                            id={`smart-search-item-${idx}`}
                                            href={productUrl}
                                            role="option"
                                            aria-selected={isSelected}
                                            onMouseEnter={() =>
                                                setSelectedIndex(idx)
                                            }
                                            onClick={(e) => {
                                                e.preventDefault()
                                                handleSelectProduct(product)
                                            }}
                                            className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                                                isSelected
                                                    ? "bg-slate-100"
                                                    : "hover:bg-slate-50"
                                            }`}
                                        >
                                            <div className="w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-slate-100">
                                                {product.image_url && (
                                                    <Image
                                                        src={product.image_url}
                                                        alt={product.name}
                                                        width={48}
                                                        height={48}
                                                        className="w-12 h-12 object-cover"
                                                    />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-900 truncate">
                                                    <HighlightedText
                                                        text={product.name}
                                                        query={trimmedQuery}
                                                    />
                                                </p>
                                                <p className="text-sm text-slate-500">
                                                    {priceLabel}
                                                </p>
                                            </div>
                                            <ArrowRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                                        </a>
                                    )
                                })}
                            </div>
                            <div className="border-t border-slate-100 p-2 space-y-1.5">
                                {showFooterCta && (
                                    <a
                                        href={productsResultsLink}
                                        onClick={(e) => {
                                            e.preventDefault()
                                            closeAndReset()
                                            router.push(productsResultsLink)
                                        }}
                                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                                        style={{ color: primaryColor }}
                                    >
                                        <span>
                                            Ver todos los resultados de &quot;
                                            {trimmedQuery}&quot;
                                        </span>
                                        <ArrowRight className="w-4 h-4" />
                                    </a>
                                )}
                                {trimmedQuery && (
                                    <Button
                                        onClick={handleChatWithQuery}
                                        variant="outline"
                                        size="sm"
                                        className="w-full flex items-center gap-2 justify-center"
                                    >
                                        <MessageCircle className="w-4 h-4" />
                                        Pregúntale al asistente sobre &quot;
                                        {trimmedQuery}&quot;
                                    </Button>
                                )}
                            </div>
                        </>
                    )}

                    {showEmptyWithSuggestions && (
                        <div className="p-4">
                            <div className="flex items-start gap-2 mb-3">
                                <Sparkles
                                    className="w-4 h-4 mt-0.5 flex-shrink-0"
                                    style={{ color: primaryColor }}
                                />
                                <p className="text-sm text-slate-700">
                                    No hay resultados exactos para &quot;
                                    {trimmedQuery}&quot;. ¿Quizás buscabas?
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-1.5 mb-3">
                                {suggestions.map((suggestion) => (
                                    <button
                                        key={suggestion.id}
                                        type="button"
                                        onClick={() =>
                                            handleSelectSuggestion(suggestion)
                                        }
                                        className="px-3 py-1 text-xs rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                                    >
                                        {suggestion.name}
                                    </button>
                                ))}
                            </div>
                            {trimmedQuery && (
                                <Button
                                    onClick={handleChatWithQuery}
                                    size="sm"
                                    style={{ backgroundColor: primaryColor }}
                                    className="w-full flex items-center gap-2 justify-center text-white"
                                >
                                    <MessageCircle className="w-4 h-4" />
                                    Pregúntale al asistente
                                </Button>
                            )}
                        </div>
                    )}

                    {showEmptyNoSuggestions && (
                        <div className="p-4 text-center">
                            <p className="text-sm text-slate-600 mb-3">
                                No encontramos productos para &quot;
                                {trimmedQuery}&quot;
                            </p>
                            <Button
                                onClick={handleChatWithQuery}
                                size="sm"
                                style={{ backgroundColor: primaryColor }}
                                className="flex items-center gap-2 mx-auto text-white"
                            >
                                <MessageCircle className="w-4 h-4" />
                                Pregúntale al asistente
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
