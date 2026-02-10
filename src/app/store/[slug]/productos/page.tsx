import { getStoreData } from "../actions"
import { StoreLayoutClient } from "../store-layout-client"
import { notFound } from "next/navigation"
import { headers } from "next/headers"
import { isSubdomain, getStoreLink } from "@/lib/utils/store-urls"
import { ProductCard } from "@/components/store/product-card"
import { CategoryTracker } from "@/components/analytics/category-tracker"
import { CategoryFilter } from "./category-filter"

interface ProductsPageProps {
    params: Promise<{ slug: string }>
    searchParams: Promise<{ categoria?: string }>
}

export default async function ProductsPage({ params, searchParams }: ProductsPageProps) {
    const { slug } = await params
    const { categoria } = await searchParams
    const data = await getStoreData(slug, 100)

    if (!data) return notFound()

    const { organization, products } = data

    const primaryColor = organization.settings?.branding?.primaryColor || "#2b7cee"

    // Detectar si estamos en subdominio (server-side)
    const headersList = await headers()
    const hostname = headersList.get('host') || ''
    const isSub = isSubdomain(hostname)

    // Obtener categorías únicas de los productos (categories es text[] en la BD)
    const categoriesSet = new Set<string>()
    products.forEach((p: any) => {
        if (Array.isArray(p.categories)) {
            p.categories.forEach((c: string) => {
                if (c && c.trim()) categoriesSet.add(c.trim())
            })
        } else if (p.categories && typeof p.categories === 'string') {
            if (p.categories.trim()) categoriesSet.add(p.categories.trim())
        }
    })
    const categories = Array.from(categoriesSet).sort()

    // Filtrar por categoría si se especifica (case-insensitive)
    const filteredProducts = categoria
        ? products.filter((p: any) => {
            const pCats = Array.isArray(p.categories) ? p.categories : [p.categories].filter(Boolean)
            return pCats.some((c: string) => c.toLowerCase() === categoria.toLowerCase())
        })
        : products

    // Título dinámico
    const categoryTitle = categoria
        ? categories.find(c => c.toLowerCase() === categoria.toLowerCase()) || categoria
        : null

    return (
        <StoreLayoutClient slug={slug} organization={organization} products={products}>
            {/* Track ViewCategory event */}
            <CategoryTracker
                categoryId={categoria || "all-products"}
                categoryName={categoryTitle || "Catálogo Completo"}
            />

            <div className="container mx-auto px-4 py-12 min-h-[60vh]">
                <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">
                            {categoryTitle || "Catálogo Completo"}
                        </h1>
                        <p className="text-slate-500 mt-1">
                            {categoryTitle
                                ? `Productos en ${categoryTitle}`
                                : "Explora todos nuestros productos y servicios"
                            }
                        </p>
                    </div>
                    <div className="text-sm text-slate-500">
                        Mostrando {filteredProducts.length} resultados
                    </div>
                </div>

                {/* Filtros de categoría */}
                {categories.length > 1 && (
                    <CategoryFilter
                        categories={categories}
                        activeCategory={categoria || null}
                        primaryColor={primaryColor}
                    />
                )}

                {filteredProducts.length === 0 ? (
                    <div className="text-center py-20 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <p className="text-slate-500 text-lg">
                            {categoria
                                ? "No hay productos en esta categoría."
                                : "No hay productos disponibles en este momento."
                            }
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredProducts.map((product: any) => {
                            const productUrl = getStoreLink(`/producto/${product.slug || product.id}`, isSub, slug)

                            return (
                                <ProductCard
                                    key={product.id}
                                    product={product}
                                    productUrl={productUrl}
                                    primaryColor={primaryColor}
                                />
                            )
                        })}
                    </div>
                )}
            </div>
        </StoreLayoutClient>
    )
}
