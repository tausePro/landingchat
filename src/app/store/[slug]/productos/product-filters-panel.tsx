"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Search, X, SlidersHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"

interface ProductFiltersPanelProps {
    /** Categorias disponibles del catalogo activo del tenant. */
    availableCategories: string[]
    /** Categorias actualmente seleccionadas (lower-case). */
    activeCategories: string[]
    /** Texto de busqueda actual. */
    activeSearch: string
    /** Precio minimo activo (null = sin filtro). */
    activeMinPrice: number | null
    /** Precio maximo activo (null = sin filtro). */
    activeMaxPrice: number | null
    /** Rango disponible en el catalogo (para placeholders). */
    availableMinPrice: number | null
    availableMaxPrice: number | null
    /** Color primario del tenant para destacar el panel. */
    primaryColor: string
    /** Codigo de moneda ISO (CO P, USD, etc.) usado solo para display de placeholders. */
    currencyCode: string
}

/**
 * v1.14.5: panel de filtros del storefront /productos.
 *
 * Estado en URL via searchParams (Next.js App Router):
 *   - q: texto de busqueda
 *   - categorias: lista separada por comas
 *   - min_price / max_price: rango numerico
 *
 * Cada cambio fuerza un `router.replace` con scroll:false para que la pagina
 * server-side re-renderice con los nuevos productos. Usa `useTransition` para
 * indicar estado de carga visualmente sin bloquear el UI.
 *
 * Mobile: panel colapsable con boton toggle. Desktop: sidebar siempre visible.
 */
export function ProductFiltersPanel({
    availableCategories,
    activeCategories,
    activeSearch,
    activeMinPrice,
    activeMaxPrice,
    availableMinPrice,
    availableMaxPrice,
    primaryColor,
    currencyCode,
}: ProductFiltersPanelProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [isPending, startTransition] = useTransition()
    const [isMobileOpen, setIsMobileOpen] = useState(false)

    // Estado local para el input de busqueda (debounced).
    const [searchInput, setSearchInput] = useState(activeSearch)
    const [minPriceInput, setMinPriceInput] = useState<string>(
        activeMinPrice !== null ? String(activeMinPrice) : "",
    )
    const [maxPriceInput, setMaxPriceInput] = useState<string>(
        activeMaxPrice !== null ? String(activeMaxPrice) : "",
    )

    // Sync inputs con URL si cambian externamente (ej. boton "limpiar").
    useEffect(() => {
        setSearchInput(activeSearch)
    }, [activeSearch])

    useEffect(() => {
        setMinPriceInput(activeMinPrice !== null ? String(activeMinPrice) : "")
    }, [activeMinPrice])

    useEffect(() => {
        setMaxPriceInput(activeMaxPrice !== null ? String(activeMaxPrice) : "")
    }, [activeMaxPrice])

    function pushParams(updates: Record<string, string | null>) {
        const params = new URLSearchParams(searchParams.toString())
        for (const [key, value] of Object.entries(updates)) {
            if (value === null || value === "") {
                params.delete(key)
            } else {
                params.set(key, value)
            }
        }
        // Limpiar param legacy `categoria` (singular) cuando se usa el nuevo
        // panel; ya migramos a `categorias` (plural, multi).
        params.delete("categoria")
        const query = params.toString()
        startTransition(() => {
            router.replace(query ? `?${query}` : ".", { scroll: false })
        })
    }

    function applySearch(value: string) {
        const trimmed = value.trim()
        pushParams({ q: trimmed.length > 0 ? trimmed : null })
    }

    function toggleCategory(category: string) {
        // v1.15.1: preserva el casing real de availableCategories (que viene
        // de la RPC storefront_facets con el casing original de DB). Antes
        // se forzaba lowercase y rompia el filtro `overlaps()` case-sensitive
        // de Postgres en listProductsWithVariants.
        //
        // Para dedup contra activeCategories (que pueden venir lowercase de
        // URLs legacy generadas por header-editor.tsx) hacemos comparison
        // case-insensitive pero guardamos el casing canonico.
        const isAlreadyActive = activeCategories.some(
            (c) => c.toLowerCase() === category.toLowerCase(),
        )
        const next = isAlreadyActive
            ? activeCategories.filter(
                  (c) => c.toLowerCase() !== category.toLowerCase(),
              )
            : [...activeCategories.filter((c) => c.toLowerCase() !== category.toLowerCase()), category]
        pushParams({ categorias: next.length > 0 ? next.join(",") : null })
    }

    function applyPriceRange() {
        const minNum = Number(minPriceInput)
        const maxNum = Number(maxPriceInput)

        const sanitizedMin = minPriceInput.trim().length > 0 && Number.isFinite(minNum) && minNum >= 0
            ? String(minNum)
            : null
        const sanitizedMax = maxPriceInput.trim().length > 0 && Number.isFinite(maxNum) && maxNum >= 0
            ? String(maxNum)
            : null

        pushParams({
            min_price: sanitizedMin,
            max_price: sanitizedMax,
        })
    }

    function clearAll() {
        setSearchInput("")
        setMinPriceInput("")
        setMaxPriceInput("")
        pushParams({
            q: null,
            categorias: null,
            min_price: null,
            max_price: null,
        })
    }

    const activeCount =
        (activeSearch ? 1 : 0) +
        activeCategories.length +
        (activeMinPrice !== null ? 1 : 0) +
        (activeMaxPrice !== null ? 1 : 0)

    const priceFormatter = new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: currencyCode || "COP",
        maximumFractionDigits: 0,
    })

    const placeholderMin = availableMinPrice !== null
        ? `Desde ${priceFormatter.format(availableMinPrice)}`
        : "Min"
    const placeholderMax = availableMaxPrice !== null
        ? `Hasta ${priceFormatter.format(availableMaxPrice)}`
        : "Max"

    const panelContent = (
        <div className="flex flex-col gap-6">
            {/* Busqueda */}
            <div>
                <label htmlFor="storefront-search-input" className="text-sm font-semibold text-slate-900 mb-2 block">
                    Buscar
                </label>
                <form
                    onSubmit={(e) => {
                        e.preventDefault()
                        applySearch(searchInput)
                    }}
                    className="relative"
                >
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                        id="storefront-search-input"
                        type="search"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onBlur={() => {
                            if (searchInput !== activeSearch) {
                                applySearch(searchInput)
                            }
                        }}
                        placeholder="Que estas buscando?"
                        className="w-full pl-9 pr-9 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:border-transparent transition"
                        style={{ ["--tw-ring-color" as string]: primaryColor }}
                        aria-label="Buscar productos"
                    />
                    {searchInput.length > 0 && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearchInput("")
                                applySearch("")
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-slate-100"
                            aria-label="Limpiar busqueda"
                        >
                            <X className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                    )}
                </form>
            </div>

            {/* Categorias */}
            {availableCategories.length > 0 && (
                <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-2">Categorias</h3>
                    <ul className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                        {availableCategories.map((category) => {
                            const isActive = activeCategories.some(
                                (c) => c.toLowerCase() === category.toLowerCase(),
                            )
                            return (
                                <li key={category}>
                                    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:text-slate-900">
                                        <input
                                            type="checkbox"
                                            checked={isActive}
                                            onChange={() => toggleCategory(category)}
                                            className="w-4 h-4 rounded border-slate-300 cursor-pointer"
                                            style={isActive ? { accentColor: primaryColor } : undefined}
                                        />
                                        <span className="capitalize">{category}</span>
                                    </label>
                                </li>
                            )
                        })}
                    </ul>
                </div>
            )}

            {/* Rango de precio */}
            <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-2">Precio</h3>
                <div className="flex items-center gap-2">
                    <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={minPriceInput}
                        onChange={(e) => setMinPriceInput(e.target.value)}
                        onBlur={applyPriceRange}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault()
                                applyPriceRange()
                            }
                        }}
                        placeholder={placeholderMin}
                        className="w-full px-2 py-1.5 text-sm rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-offset-0"
                        style={{ ["--tw-ring-color" as string]: primaryColor }}
                        aria-label="Precio minimo"
                    />
                    <span className="text-slate-400 text-sm">-</span>
                    <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={maxPriceInput}
                        onChange={(e) => setMaxPriceInput(e.target.value)}
                        onBlur={applyPriceRange}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault()
                                applyPriceRange()
                            }
                        }}
                        placeholder={placeholderMax}
                        className="w-full px-2 py-1.5 text-sm rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-offset-0"
                        style={{ ["--tw-ring-color" as string]: primaryColor }}
                        aria-label="Precio maximo"
                    />
                </div>
            </div>

            {/* Limpiar */}
            {activeCount > 0 && (
                <button
                    type="button"
                    onClick={clearAll}
                    className="text-xs font-medium text-slate-500 hover:text-slate-900 self-start underline-offset-2 hover:underline"
                >
                    Limpiar filtros ({activeCount})
                </button>
            )}

            {isPending && (
                <p className="text-xs text-slate-400 italic" role="status">
                    Actualizando...
                </p>
            )}
        </div>
    )

    return (
        <>
            {/* Mobile: boton toggle + panel colapsable */}
            <div className="md:hidden mb-4">
                <button
                    type="button"
                    onClick={() => setIsMobileOpen((prev) => !prev)}
                    className={cn(
                        "w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition",
                        isMobileOpen
                            ? "border-slate-300 bg-slate-50 text-slate-900"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                    )}
                    aria-expanded={isMobileOpen}
                    aria-controls="storefront-filters-mobile-panel"
                >
                    <span className="flex items-center gap-2">
                        <SlidersHorizontal className="w-4 h-4" />
                        Filtros
                        {activeCount > 0 && (
                            <span
                                className="ml-1 inline-flex items-center justify-center text-xs font-semibold w-5 h-5 rounded-full text-white"
                                style={{ backgroundColor: primaryColor }}
                            >
                                {activeCount}
                            </span>
                        )}
                    </span>
                    <span className="text-xs text-slate-400">{isMobileOpen ? "Cerrar" : "Abrir"}</span>
                </button>
                {isMobileOpen && (
                    <div
                        id="storefront-filters-mobile-panel"
                        className="mt-3 p-4 bg-white rounded-xl border border-slate-200"
                    >
                        {panelContent}
                    </div>
                )}
            </div>

            {/* Desktop: sidebar fijo */}
            <aside className="hidden md:block sticky top-24 self-start">
                <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base font-bold text-slate-900">Filtros</h2>
                        {activeCount > 0 && (
                            <span
                                className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                                style={{ backgroundColor: primaryColor }}
                            >
                                {activeCount}
                            </span>
                        )}
                    </div>
                    {panelContent}
                </div>
            </aside>
        </>
    )
}
