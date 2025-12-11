import { getStoreData } from "../actions"
import { StoreLayoutClient } from "../store-layout-client"
import { notFound } from "next/navigation"
import { CheckCircle2, ArrowRight } from "lucide-react"
import Link from "next/link"
import { headers } from "next/headers"
import { isSubdomain, getStoreLink } from "@/lib/utils/store-urls"

// Helper to strip HTML tags from description
function stripHtml(html: string | null | undefined): string {
    if (!html) return ""
    return html
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
        .replace(/&amp;/g, '&') // Replace &amp; with &
        .replace(/&lt;/g, '<') // Replace &lt; with <
        .replace(/&gt;/g, '>') // Replace &gt; with >
        .replace(/&quot;/g, '"') // Replace &quot; with "
        .replace(/\s+/g, ' ') // Collapse multiple spaces
        .trim()
}

export default async function ProductsPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const data = await getStoreData(slug, 100)

    if (!data) return notFound()

    const { organization, products } = data
    const primaryColor = organization.settings?.branding?.primaryColor || "#2b7cee"

    // Detectar si estamos en subdominio (server-side)
    const headersList = await headers()
    const hostname = headersList.get('host') || ''
    const isSub = isSubdomain(hostname)

    return (
        <StoreLayoutClient slug={slug} organization={organization} products={products}>
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
                                <div key={product.id} className="group relative bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col">
                                    <Link href={productUrl} className="block relative aspect-square rounded-xl overflow-hidden bg-slate-50 mb-4">
                                        {product.image_url ? (
                                            <img
                                                src={product.image_url}
                                                alt={product.name}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                <CheckCircle2 className="w-12 h-12" />
                                            </div>
                                        )}
                                        {/* Quick View Overlay (Optional) */}
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                                    </Link>

                                    <div className="flex-1 flex flex-col">
                                        <Link href={productUrl}>
                                            <h3 className="font-bold text-slate-900 mb-1 group-hover:text-blue-600 transition-colors line-clamp-1">
                                                {product.name}
                                            </h3>
                                        </Link>
                                        <p className="text-sm text-slate-500 mb-4 line-clamp-2 flex-1">
                                            {stripHtml(product.description) || "Sin descripción"}
                                        </p>

                                        <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50">
                                            <span className="font-bold text-lg" style={{ color: primaryColor }}>
                                                {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(product.price)}
                                            </span>
                                            <Link
                                                href={productUrl}
                                                className="p-2 rounded-full hover:bg-slate-50 text-slate-400 hover:text-blue-600 transition-colors"
                                            >
                                                <ArrowRight className="w-5 h-5" />
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </StoreLayoutClient>
    )
}
