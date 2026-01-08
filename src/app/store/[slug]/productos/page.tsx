import { getStoreData } from "../actions"
import { StoreLayoutClient } from "../store-layout-client"
import { notFound } from "next/navigation"
import { headers } from "next/headers"
import { isSubdomain, getStoreLink } from "@/lib/utils/store-urls"
import { ProductCard } from "@/components/store/product-card"
import { CategoryTracker } from "@/components/analytics/category-tracker"

export default async function ProductsPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const data = await getStoreData(slug, 100)

    if (!data) return notFound()

    const { organization, products } = data

    // DEBUG: Log first product images
    if (products.length > 0) {
        console.log("DEBUG Product Images:", {
            name: products[0].name,
            image_url: products[0].image_url,
            images: products[0].images
        })
    }

    const primaryColor = organization.settings?.branding?.primaryColor || "#2b7cee"

    // Detectar si estamos en subdominio (server-side)
    const headersList = await headers()
    const hostname = headersList.get('host') || ''
    const isSub = isSubdomain(hostname)

    return (
        <StoreLayoutClient slug={slug} organization={organization} products={products}>
            {/* Track ViewCategory event */}
            <CategoryTracker categoryId="all-products" categoryName="Catálogo Completo" />
            
            <div className="container mx-auto px-4 py-12 min-h-[60vh]">
                <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Catálogo Completo</h1>
                        <p className="text-slate-500 mt-1">Explora todos nuestros productos y servicios</p>
                    </div>
                    <div className="text-sm text-slate-500">
                        Mostrando {products.length} resultados
                    </div>
                </div>

                {products.length === 0 ? (
                    <div className="text-center py-20 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <p className="text-slate-500 text-lg">No hay productos disponibles en este momento.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {products.map((product) => {
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


