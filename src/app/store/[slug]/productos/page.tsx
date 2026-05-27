import { getStoreData, getStorefrontProductsCatalog } from "../actions"
import { StoreLayoutClient } from "../store-layout-client"
import { notFound } from "next/navigation"
import { headers } from "next/headers"
import { isSubdomain, getStoreLink } from "@/lib/utils/store-urls"
import { ProductCard } from "@/components/store/product-card"
import { CategoryTracker } from "@/components/analytics/category-tracker"
import { ProductFiltersPanel } from "./product-filters-panel"

interface ProductsPageProps {
    params: Promise<{ slug: string }>
    searchParams: Promise<{
        // v1.14.5: nuevos params del panel de filtros
        q?: string
        categorias?: string
        min_price?: string
        max_price?: string
        // legacy (compat con URLs antiguas)
        categoria?: string
    }>
}

function parseCategoriesParam(value: string | undefined): string[] {
    if (!value) return []
    return value
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
}

function parseNumberParam(value: string | undefined): number | null {
    if (value === undefined || value === null) return null
    const trimmed = value.trim()
    if (trimmed.length === 0) return null
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

export default async function ProductsPage({ params, searchParams }: ProductsPageProps) {
    const { slug } = await params
    const sp = await searchParams

    // Compat con URL legacy ?categoria=X. Si no viene `categorias` plural,
    // usamos `categoria` singular como categoria activa unica.
    const legacyCategoria = sp.categoria?.trim()
    const categoriasFromUrl = parseCategoriesParam(sp.categorias)
    const activeCategories = categoriasFromUrl.length > 0
        ? categoriasFromUrl
        : legacyCategoria
            ? [legacyCategoria]
            : []

    const activeSearch = sp.q?.trim() || ""
    const activeMinPrice = parseNumberParam(sp.min_price)
    const activeMaxPrice = parseNumberParam(sp.max_price)

    const filters = {
        search: activeSearch.length > 0 ? activeSearch : null,
        categories: activeCategories.length > 0 ? activeCategories : null,
        minPrice: activeMinPrice,
        maxPrice: activeMaxPrice,
        limit: 100,
    }

    // Cargas en paralelo:
    //   - getStoreData: catalogo completo + organization para el layout
    //                   (StoreLayoutClient pasa products a ProductStoryTray etc.)
    //   - getStorefrontProductsCatalog: productos filtrados + facets
    const [data, catalog] = await Promise.all([
        getStoreData(slug, 100),
        getStorefrontProductsCatalog(slug, filters),
    ])

    if (!data) return notFound()

    const { organization, products: allProducts, badges } = data
    const filteredProducts = catalog?.products ?? []
    const facets = catalog?.facets ?? {
        categories: [],
        minPrice: null,
        maxPrice: null,
        productCount: 0,
    }

    const primaryColor = organization.settings?.branding?.primaryColor || "#2b7cee"
    const currencyCode = organization.currency_code || "COP"

    // Detectar si estamos en subdominio (server-side)
    const headersList = await headers()
    const hostname = headersList.get("host") || ""
    const isSub = isSubdomain(hostname)

    // Titulo dinamico segun los filtros activos.
    const hasActiveFilters =
        activeSearch.length > 0 ||
        activeCategories.length > 0 ||
        activeMinPrice !== null ||
        activeMaxPrice !== null

    const headingTitle = activeSearch.length > 0
        ? `Resultados para "${activeSearch}"`
        : activeCategories.length === 1
            ? activeCategories[0]
            : "Catálogo Completo"

    const headingSubtitle = activeSearch.length > 0
        ? `Encontramos ${filteredProducts.length} producto${filteredProducts.length === 1 ? "" : "s"} relacionado${filteredProducts.length === 1 ? "" : "s"}`
        : activeCategories.length === 1
            ? `Productos en ${activeCategories[0]}`
            : "Explora todos nuestros productos y servicios"

    // Telemetria: si hay 1 sola categoria activa la usamos como id; si no,
    // marcamos como busqueda o catalogo completo.
    const trackerCategoryId = activeSearch.length > 0
        ? `search:${activeSearch}`
        : activeCategories.length === 1
            ? activeCategories[0]
            : "all-products"

    return (
        <StoreLayoutClient slug={slug} organization={organization} products={allProducts} badges={badges}>
            <CategoryTracker
                categoryId={trackerCategoryId}
                categoryName={headingTitle}
            />

            <div className="container mx-auto px-4 py-12 min-h-[60vh]">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">{headingTitle}</h1>
                        <p className="text-slate-500 mt-1">{headingSubtitle}</p>
                    </div>
                    <div className="text-sm text-slate-500">
                        Mostrando {filteredProducts.length} resultados
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
                    <ProductFiltersPanel
                        availableCategories={facets.categories}
                        activeCategories={activeCategories}
                        activeSearch={activeSearch}
                        activeMinPrice={activeMinPrice}
                        activeMaxPrice={activeMaxPrice}
                        availableMinPrice={facets.minPrice}
                        availableMaxPrice={facets.maxPrice}
                        primaryColor={primaryColor}
                        currencyCode={currencyCode}
                    />

                    <div>
                        {filteredProducts.length === 0 ? (
                            <div className="text-center py-20 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                <p className="text-slate-500 text-lg">
                                    {hasActiveFilters
                                        ? "No encontramos productos con esos filtros. Intenta con otra combinación."
                                        : "No hay productos disponibles en este momento."
                                    }
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredProducts.map((product) => {
                                    const productUrl = getStoreLink(`/producto/${product.slug || product.id}`, isSub, slug)
                                    return (
                                        <ProductCard
                                            key={product.id}
                                            product={product}
                                            productUrl={productUrl}
                                            primaryColor={primaryColor}
                                            badges={badges}
                                        />
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </StoreLayoutClient>
    )
}
