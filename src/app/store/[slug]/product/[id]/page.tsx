import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { StoreLayoutClient } from "../../store-layout-client"
import { ProductCTAButton } from "./product-cta-button"

interface ProductDetailPageProps {
    params: Promise<{ slug: string; id: string }>
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
    const { slug, id } = await params

    const supabase = await createClient()

    // Get organization by slug
    const { data: organization } = await supabase
        .from("organizations")
        .select("*")
        .eq("slug", slug)
        .single()

    if (!organization) notFound()

    // Get product
    const { data: product } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .eq("organization_id", organization.id)
        .single()

    if (!product) notFound()

    const primaryColor = organization.settings?.branding?.primaryColor || "#2b7cee"
    const images = product.images || []
    const mainImage = images[0] || product.image_url || "/placeholder-product.png"

    return (
        <StoreLayoutClient slug={slug} organization={organization} products={[]} hideNavigation={true}>
            <div className="relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark font-display pb-24">
                {/* Custom Sticky Header */}
                <header className="fixed top-0 left-0 right-0 z-20 flex justify-between items-center px-4 py-3 bg-white/10 backdrop-blur-md">
                    <Link href={`/store/${slug}`} className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-slate-900 dark:text-white transition-colors">
                        <span className="material-symbols-outlined text-2xl">arrow_back</span>
                    </Link>
                    <div className="flex gap-2">
                        <button className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-slate-900 dark:text-white transition-colors">
                            <span className="material-symbols-outlined text-2xl">share</span>
                        </button>
                        <button className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-slate-900 dark:text-white transition-colors">
                            <span className="material-symbols-outlined text-2xl">favorite_border</span>
                        </button>
                    </div>
                </header>

                {/* Hero Image */}
                <div className="relative w-full h-[50vh] min-h-[400px]">
                    <Image
                        src={mainImage}
                        alt={product.name}
                        fill
                        className="object-cover"
                        priority
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                    {/* Carousel Indicators (Static for now) */}
                    {images.length > 1 && (
                        <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2">
                            {images.map((_: any, idx: number) => (
                                <div
                                    key={idx}
                                    className={`size-2 rounded-full ${idx === 0 ? 'bg-white' : 'bg-white/50'}`}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Product Info */}
                <div className="flex flex-col gap-2 pt-6 px-5 -mt-6 relative z-10 bg-background-light dark:bg-background-dark rounded-t-3xl">
                    <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-4" />

                    <h1 className="text-slate-900 dark:text-white text-3xl font-bold leading-tight tracking-tight">
                        {product.name}
                    </h1>

                    <h2 className="text-2xl font-bold" style={{ color: primaryColor }}>
                        {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(product.price)}
                    </h2>

                    <p className="text-slate-600 dark:text-slate-300 text-base leading-relaxed mt-2">
                        {product.description || "Sin descripción disponible."}
                    </p>

                    {/* Variants */}
                    {product.variants && product.variants.length > 0 && (
                        <div className="mt-6 space-y-5">
                            {product.variants.map((variant: any, idx: number) => (
                                <div key={idx}>
                                    <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-3">
                                        {variant.type}
                                    </h3>
                                    <div className="flex gap-3 flex-wrap">
                                        {variant.values.map((value: string, vIdx: number) => (
                                            <button
                                                key={vIdx}
                                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${vIdx === 0
                                                    ? 'text-white shadow-lg shadow-primary/30'
                                                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-slate-700 dark:text-slate-300'
                                                    }`}
                                                style={vIdx === 0 ? { backgroundColor: primaryColor } : {}}
                                            >
                                                {value}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Accordions */}
                    <div className="mt-8 space-y-2">
                        <details className="group border-b border-gray-200 dark:border-gray-800 pb-4">
                            <summary className="flex justify-between items-center cursor-pointer list-none py-2">
                                <span className="text-lg font-semibold text-slate-900 dark:text-white">Especificaciones</span>
                                <span className="material-symbols-outlined transform transition-transform duration-200 group-open:rotate-180">expand_more</span>
                            </summary>
                            <div className="mt-2 text-slate-600 dark:text-slate-400 text-sm">
                                <p>SKU: {product.id.slice(0, 8).toUpperCase()}</p>
                                <p>Stock: {product.stock > 0 ? 'Disponible' : 'Agotado'}</p>
                            </div>
                        </details>
                    </div>
                </div>

                {/* Sticky Footer CTA */}
                <ProductCTAButton slug={slug} productId={id} primaryColor={primaryColor} />
            </div>
        </StoreLayoutClient>
    )
}
